/**
 * Auto Order Execution (Cron) — Runs every minute via Vercel Cron
 *
 * PRODUCTION: Vercel Cron hits GET /api/auto-orders/execute every minute
 * LOCAL DEV:  Use /api/auto-orders/test-execute or scripts/dev-cron.js
 *
 * Auth: Vercel injects CRON_SECRET via header; local uses ?secret= query param
 *
 * The actual execution logic lives in @/lib/auto-order-engine so it can be
 * reused by the test endpoint and any future trigger.
 */

import { NextRequest, NextResponse } from "next/server";
import { executeAutoOrders } from "@/lib/auto-order-engine";

// ─── Force Node.js runtime (Firebase Admin SDK needs it) ───
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Auth ───────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.warn("[AutoOrder Cron] ⚠️ CRON_SECRET not set — running without auth (dev mode)");
        return true;
    }

    // Method 1: Vercel Cron production — sends secret via Authorization header
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;

    // Method 2: Local testing — pass as query param: ?secret=xxx
    const { searchParams } = new URL(req.url);
    if (searchParams.get("secret") === cronSecret) return true;

    return false;
}

// ─── Main handler ───────────────────────────────

export async function GET(req: NextRequest) {
    console.log(`\n[AutoOrder Cron] ⏰ Route handler invoked at ${new Date().toISOString()}`);

    // 1. Auth
    if (!verifyCronAuth(req)) {
        console.warn("[AutoOrder Cron] ❌ Unauthorized cron attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[AutoOrder Cron] ✅ Auth passed");

    // 2. Check for optional time override (for testing)
    const { searchParams } = new URL(req.url);
    const overrideTime = searchParams.get("time") || undefined;

    // 3. Delegate to reusable engine
    console.log("[AutoOrder Cron] 🚀 Delegating to auto-order engine...");
    const result = await executeAutoOrders(overrideTime);

    const status = result.success ? 200 : 500;
    console.log(`[AutoOrder Cron] 📤 Responding with status ${status}`);

    return NextResponse.json(result, { status });
}
