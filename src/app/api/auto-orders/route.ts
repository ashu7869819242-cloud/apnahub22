/**
 * GET /api/auto-orders — Fetch all auto-orders for a user
 * POST /api/auto-orders — Create a new auto-order
 * PATCH /api/auto-orders?id={id} — Update an auto-order (status, quantity, etc.)
 * DELETE /api/auto-orders?id={id} — Delete an auto-order
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    try {
        const snapshot = await adminDb.collection("auto-orders")
            .where("userId", "==", userId)
            .get();

        const autoOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ success: true, autoOrders });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch auto-orders" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const docRef = await adminDb.collection("auto-orders").add({
            ...data,
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true, id: docRef.id });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create auto-order" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    try {
        const data = await req.json();
        await adminDb.collection("auto-orders").doc(id).update({
            ...data,
            updatedAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update auto-order" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    try {
        await adminDb.collection("auto-orders").doc(id).delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete auto-order" }, { status: 500 });
    }
}
