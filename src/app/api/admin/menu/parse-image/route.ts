/**
 * POST /api/admin/menu/parse-image
 *
 * Accepts a base64-encoded image of a menu, sends it to Google Gemini Vision,
 * and returns an array of parsed menu items for admin review before saving.
 *
 * Request body: { image: string (base64), mimeType: string }
 * Response:     { items: ParsedMenuItem[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { parseMenuImage, type ParsedMenuItem } from "@/lib/ai-menu-parser";

export async function POST(req: NextRequest): Promise<NextResponse> {
    // SECURITY: Admin-only endpoint
    if (!verifyAdmin(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { image, mimeType } = body as { image?: string; mimeType?: string };

        // Validate required fields
        if (!image || !mimeType) {
            return NextResponse.json(
                { error: "Missing required fields: image (base64) and mimeType" },
                { status: 400 }
            );
        }

        // Validate mime type is an image
        if (!mimeType.startsWith("image/")) {
            return NextResponse.json(
                { error: "Invalid file type. Only image files are accepted." },
                { status: 400 }
            );
        }

        // Call Gemini Vision to parse the menu image
        const items: ParsedMenuItem[] = await parseMenuImage(image, mimeType);

        return NextResponse.json({ items, count: items.length });
    } catch (error) {
        console.error("Failed to parse menu image:", error);
        const message = error instanceof Error ? error.message : "Failed to parse menu image";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
