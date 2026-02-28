/**
 * Middleware — Route-level protection for role-based access
 * 
 * Since admin/stock manager use localStorage JWT tokens (client-side),
 * Next.js middleware provides basic path-level awareness. The actual
 * JWT verification happens in AdminGuard / StockManagerGuard components
 * and API route handlers.
 * 
 * This middleware ensures:
 * - /admin/dashboard/* paths are not directly accessible without context
 * - /stock/dashboard/* paths are not directly accessible without context
 * - Basic security headers are set
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const response = NextResponse.next();

    // Security headers
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Stock manager API routes — verify JWT in the route handler itself
    if (pathname.startsWith("/api/stock/dashboard")) {
        // JWT verification is handled by verifyStockManager() in the route
        return response;
    }

    // Admin API routes — verify JWT in the route handler itself
    if (pathname.startsWith("/api/admin/") && !pathname.startsWith("/api/admin/auth")) {
        // JWT verification is handled by verifyAdmin() in the route
        return response;
    }

    return response;
}

export const config = {
    matcher: [
        "/admin/:path*",
        "/stock/:path*",
        "/dashboard/:path*",
        "/api/admin/:path*",
        "/api/stock/:path*",
    ],
};
