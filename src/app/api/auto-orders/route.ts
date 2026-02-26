/**
 * Auto Orders API — GET list + POST create
 *
 * GET  /api/auto-orders?userId=xxx  — Fetch all auto orders for the user
 * POST /api/auto-orders              — Create a new auto order
 *
 * Error handling: returns structured { success: false, error: string } for
 * every failure path so the frontend can display the real reason.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/user-auth";
import type { DayOfWeek, AutoOrderFrequency } from "@/types";

const VALID_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VALID_FREQUENCIES: AutoOrderFrequency[] = ["daily", "weekdays", "custom"];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── Helpers ────────────────────────────────────

function errorResponse(error: string, status: number) {
    return NextResponse.json({ success: false, error }, { status });
}

function classifyFirestoreError(error: unknown): { message: string; status: number } {
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes("PERMISSION_DENIED") || msg.includes("Missing or insufficient permissions")) {
        return { message: "Firestore permission denied — check security rules", status: 403 };
    }
    if (msg.includes("requires an index") || msg.includes("FAILED_PRECONDITION")) {
        return {
            message: "Firestore index required — please create the composite index for autoOrders(userId, createdAt). Check server logs for the direct link.",
            status: 500,
        };
    }
    if (msg.includes("NOT_FOUND")) {
        return { message: "Firestore collection or document not found", status: 404 };
    }
    if (msg.includes("UNAUTHENTICATED")) {
        return { message: "Firebase Admin authentication failed — check service account", status: 401 };
    }
    return { message: msg || "Internal server error", status: 500 };
}

// ─── GET /api/auto-orders?userId=xxx ────────────

export async function GET(req: NextRequest) {
    try {
        // 1. Auth check
        const uid = await getAuthenticatedUser(req);
        if (!uid) {
            console.warn("[AutoOrders GET] Missing or invalid Firebase token");
            return errorResponse("Unauthorized — invalid or missing auth token", 401);
        }

        // 2. Ownership check
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return errorResponse("Missing userId query parameter", 400);
        }

        if (userId !== uid) {
            console.warn(`[AutoOrders GET] IDOR attempt: token uid=${uid}, requested userId=${userId}`);
            return errorResponse("Forbidden — you can only view your own auto orders", 403);
        }

        // 3. Firestore query
        const snapshot = await adminDb
            .collection("autoOrders")
            .where("userId", "==", userId)
            .orderBy("createdAt", "desc")
            .get();

        const autoOrders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({ success: true, autoOrders });
    } catch (error) {
        const classified = classifyFirestoreError(error);
        console.error(`[AutoOrders GET] ${classified.status}: ${classified.message}`, error);
        return errorResponse(classified.message, classified.status);
    }
}

// ─── POST /api/auto-orders ─────────────────────

export async function POST(req: NextRequest) {
    try {
        // 1. Auth check
        const uid = await getAuthenticatedUser(req);
        if (!uid) {
            console.warn("[AutoOrders POST] Missing or invalid Firebase token");
            return errorResponse("Unauthorized — invalid or missing auth token", 401);
        }

        const { userId, itemId, quantity, time, frequency, customDays } = await req.json();

        // 2. Ownership check
        if (userId !== uid) {
            return errorResponse("Forbidden — userId does not match authenticated user", 403);
        }

        // 3. Validate required fields
        if (!itemId || !quantity || !time || !frequency) {
            return errorResponse("Missing required fields: itemId, quantity, time, frequency", 400);
        }

        if (quantity <= 0 || !Number.isInteger(quantity)) {
            return errorResponse("Quantity must be a positive integer", 400);
        }

        if (!TIME_REGEX.test(time)) {
            return errorResponse("Time must be in HH:MM format (24-hour)", 400);
        }

        if (!VALID_FREQUENCIES.includes(frequency)) {
            return errorResponse(`Invalid frequency: "${frequency}". Must be one of: ${VALID_FREQUENCIES.join(", ")}`, 400);
        }

        if (frequency === "custom") {
            if (!customDays || !Array.isArray(customDays) || customDays.length === 0) {
                return errorResponse("Custom days required when frequency is 'custom'", 400);
            }
            if (!customDays.every((d: string) => VALID_DAYS.includes(d as DayOfWeek))) {
                return errorResponse(`Invalid day in customDays. Valid days: ${VALID_DAYS.join(", ")}`, 400);
            }
        }

        // 4. Verify menu item exists
        const itemDoc = await adminDb.collection("menuItems").doc(itemId).get();
        if (!itemDoc.exists) {
            return errorResponse(`Menu item "${itemId}" not found`, 404);
        }

        const itemData = itemDoc.data()!;
        const now = new Date().toISOString();

        // 5. Create auto order
        const autoOrderRef = adminDb.collection("autoOrders").doc();
        await autoOrderRef.set({
            userId,
            itemId,
            itemName: itemData.name,
            itemPrice: itemData.price,
            quantity,
            time,
            frequency,
            ...(frequency === "custom" ? { customDays } : {}),
            status: "active",
            totalExecutions: 0,
            totalFailures: 0,
            createdAt: now,
            updatedAt: now,
        });

        return NextResponse.json({
            success: true,
            autoOrderId: autoOrderRef.id,
            message: "Auto order created successfully",
        });
    } catch (error) {
        const classified = classifyFirestoreError(error);
        console.error(`[AutoOrders POST] ${classified.status}: ${classified.message}`, error);
        return errorResponse(classified.message, classified.status);
    }
}
