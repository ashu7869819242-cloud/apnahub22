/**
 * Stock Manager authentication helpers.
 * 
 * SECURITY: Uses properly signed JWTs with STOCK_MANAGER_SECRET (8h expiry).
 * Mirrors the admin-auth.ts pattern for consistency.
 * - signStockManagerToken() creates a signed JWT
 * - verifyStockManager() extracts + verifies the JWT from the Authorization header
 */

import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

interface StockManagerPayload {
    role: "stock_manager";
    username: string;
}

/**
 * Create a signed JWT for an authenticated stock manager.
 */
export function signStockManagerToken(username: string): string {
    const secret = process.env.STOCK_MANAGER_SECRET;
    if (!secret) {
        throw new Error("STOCK_MANAGER_SECRET not configured");
    }

    return jwt.sign(
        { role: "stock_manager", username } as StockManagerPayload,
        secret,
        { expiresIn: "8h" }
    );
}

/**
 * Verify the stock manager JWT from the Authorization: Bearer header.
 * Returns the decoded payload if valid, or null if invalid/missing.
 */
export function verifyStockManager(req: NextRequest): StockManagerPayload | null {
    const secret = process.env.STOCK_MANAGER_SECRET;
    if (!secret) return null;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, secret) as StockManagerPayload;
        if (decoded.role !== "stock_manager") return null;
        return decoded;
    } catch {
        return null;
    }
}
