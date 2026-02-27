/**
 * POST /api/admin/menu/bulk
 *
 * Accepts an array of confirmed menu items and batch-writes them to Firestore.
 * Used after the admin reviews AI-parsed items and clicks "Confirm & Add All".
 *
 * Request body: { items: Array<{ name, price, category }> }
 * Response:     { success: true, count: number, ids: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdmin } from "@/lib/admin-auth";

interface BulkMenuItem {
    name: string;
    price: number;
    category: string;
}

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
    // SECURITY: Admin-only endpoint
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { items } = body as { items?: BulkMenuItem[] };

        // Validate input
        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "No items provided. Expected a non-empty array of menu items." },
                { status: 400 }
            );
        }

        // Validate each item has required fields
        for (const item of items) {
            if (!item.name || typeof item.price !== "number" || !item.category) {
                return NextResponse.json(
                    { error: `Invalid item data: each item must have name (string), price (number), and category (string)` },
                    { status: 400 }
                );
            }
        }

        // Batch write all items to Firestore
        const batch = adminDb.batch();
        const ids: string[] = [];
        const now = new Date().toISOString();

        for (const item of items) {
            const docRef = adminDb.collection("menuItems").doc();
            ids.push(docRef.id);

            batch.set(docRef, {
                name: item.name.trim(),
                price: Math.max(0, item.price),
                category: item.category,
                available: true,       // Default: available
                quantity: 50,           // Default: 50 units
                preparationTime: 0,
                description: "",
                createdAt: now,
                updatedAt: now,
            });
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            count: ids.length,
            ids,
        });
    } catch (error) {
        console.error("Failed to bulk-create menu items:", error);
        return NextResponse.json(
            { error: "Failed to create menu items" },
            { status: 500 }
        );
    }
}
