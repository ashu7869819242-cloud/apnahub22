/**
 * /api/stock/verify — Verify Stock Manager JWT
 *
 * GET — Returns { valid: true } if the JWT in the Authorization header is valid.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyStockManager } from "@/lib/stock-manager-auth";

export async function GET(req: NextRequest) {
    const manager = verifyStockManager(req);

    if (!manager) {
        return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({
        valid: true,
        username: manager.username,
    });
}
