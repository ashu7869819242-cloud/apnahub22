/**
 * Manual Auto-Order Test Endpoint (Development Only)
 *
 * GET /api/auto-orders/test-execute         — Execute for current IST time
 * GET /api/auto-orders/test-execute?time=14:30 — Execute for a specific time
 *
 * No auth required (dev-only). In production this returns 403.
 */

import { NextRequest, NextResponse } from "next/server";
import { executeAutoOrders } from "@/lib/auto-order-engine";

// Force Node.js runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    console.log(`\n[AutoOrder Test] 🧪 Manual test-execute invoked at ${new Date().toISOString()}`);

    // Block in production
    if (process.env.NODE_ENV === "production") {
        console.warn("[AutoOrder Test] ❌ Blocked — test endpoint is disabled in production");
        return NextResponse.json(
            { error: "Test endpoint is disabled in production" },
            { status: 403 }
        );
    }

    // Optional time override: ?time=HH:MM
    const { searchParams } = new URL(req.url);
    const overrideTime = searchParams.get("time") || undefined;

    if (overrideTime) {
        console.log(`[AutoOrder Test] ⏰ Using override time: ${overrideTime}`);
    }

    console.log("[AutoOrder Test] 🚀 Calling executeAutoOrders()...");
    const result = await executeAutoOrders(overrideTime);

    console.log("[AutoOrder Test] 📤 Result:", JSON.stringify(result, null, 2));

    return NextResponse.json({
        _testEndpoint: true,
        _note: "This endpoint is for development testing only",
        ...result,
    });
}
