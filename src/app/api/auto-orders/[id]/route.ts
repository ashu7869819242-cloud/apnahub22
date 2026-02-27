/**
 * Auto Orders [id] API — PATCH update + DELETE remove
 *
 * PATCH  /api/auto-orders/:id — Update fields or toggle pause/resume
 * DELETE /api/auto-orders/:id — Delete an auto order
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/user-auth";
import type { DayOfWeek, AutoOrderFrequency } from "@/types";

export const runtime = "nodejs";

const VALID_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VALID_FREQUENCIES: AutoOrderFrequency[] = ["daily", "weekdays", "custom"];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/auto-orders/:id
export async function PATCH(req: NextRequest, context: RouteContext) {
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    try {
        const docRef = adminDb.collection("autoOrders").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Auto order not found" }, { status: 404 });
        }

        if (docSnap.data()?.userId !== uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

        // Handle status toggle (pause/resume)
        if (body.status === "active" || body.status === "paused") {
            updates.status = body.status;
        }

        // Handle field updates
        if (body.quantity !== undefined) {
            if (body.quantity <= 0 || !Number.isInteger(body.quantity)) {
                return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
            }
            updates.quantity = body.quantity;
        }

        if (body.time !== undefined) {
            if (!TIME_REGEX.test(body.time)) {
                return NextResponse.json({ error: "Time must be in HH:MM format (24-hour)" }, { status: 400 });
            }
            updates.time = body.time;
        }

        if (body.frequency !== undefined) {
            if (!VALID_FREQUENCIES.includes(body.frequency)) {
                return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
            }
            updates.frequency = body.frequency;

            if (body.frequency === "custom") {
                if (!body.customDays || !Array.isArray(body.customDays) || body.customDays.length === 0) {
                    return NextResponse.json({ error: "Custom days required for custom frequency" }, { status: 400 });
                }
                if (!body.customDays.every((d: string) => VALID_DAYS.includes(d as DayOfWeek))) {
                    return NextResponse.json({ error: "Invalid day in customDays" }, { status: 400 });
                }
                updates.customDays = body.customDays;
            }
        }

        if (body.itemId !== undefined) {
            const itemDoc = await adminDb.collection("menuItems").doc(body.itemId).get();
            if (!itemDoc.exists) {
                return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
            }
            const itemData = itemDoc.data()!;
            updates.itemId = body.itemId;
            updates.itemName = itemData.name;
            updates.itemPrice = itemData.price;
        }

        await docRef.update(updates);

        return NextResponse.json({ success: true, message: "Auto order updated" });
    } catch (error) {
        console.error("Failed to update auto order:", error);
        const message = error instanceof Error ? error.message : "Failed to update auto order";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/auto-orders/:id
export async function DELETE(req: NextRequest, context: RouteContext) {
    const uid = await getAuthenticatedUser(req);
    if (!uid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    try {
        const docRef = adminDb.collection("autoOrders").doc(id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: "Auto order not found" }, { status: 404 });
        }

        if (docSnap.data()?.userId !== uid) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await docRef.delete();

        return NextResponse.json({ success: true, message: "Auto order deleted" });
    } catch (error) {
        console.error("Failed to delete auto order:", error);
        return NextResponse.json({ error: "Failed to delete auto order" }, { status: 500 });
    }
}
