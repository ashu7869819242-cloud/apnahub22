/**
 * /api/stock/auth — Stock Manager Login API
 *
 * POST — Validates username/password against env vars, returns signed JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { signStockManagerToken } from "@/lib/stock-manager-auth";

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        const validUsername = process.env.STOCK_MANAGER_USERNAME;
        const validPassword = process.env.STOCK_MANAGER_PASSWORD;

        if (!validUsername || !validPassword) {
            console.error("[StockAuth] STOCK_MANAGER credentials not configured");
            return NextResponse.json(
                { success: false, error: "Server configuration error" },
                { status: 500 }
            );
        }

        if (username !== validUsername || password !== validPassword) {
            return NextResponse.json(
                { success: false, error: "Invalid credentials" },
                { status: 401 }
            );
        }

        const token = signStockManagerToken(username);

        return NextResponse.json({
            success: true,
            token,
            message: "Stock Manager authenticated",
        });
    } catch (err) {
        console.error("[StockAuth] Login error:", err);
        return NextResponse.json(
            { success: false, error: "Authentication failed" },
            { status: 500 }
        );
    }
}
