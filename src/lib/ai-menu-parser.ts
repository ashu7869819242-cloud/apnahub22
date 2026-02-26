/**
 * AI Menu Parser — Extracts menu items from images using the AI Router.
 *
 * Uses runVisionAI() for automatic provider fallback:
 * Gemini Vision → Groq Vision → (text providers skipped for vision)
 *
 * Given a base64-encoded image of a menu (board, paper, screen, etc.),
 * this service sends it through the AI router and returns structured menu item data.
 */

import { runVisionAI } from "./aiRouter";

// ─── Types ──────────────────────────────────────

/** Parsed menu item returned by the AI vision model */
export interface ParsedMenuItem {
    name: string;
    price: number;
    category: "meals" | "snacks" | "beverages" | "desserts" | "other";
}

/** Valid categories for menu items */
const VALID_CATEGORIES = ["meals", "snacks", "beverages", "desserts", "other"] as const;

// ─── Prompt ─────────────────────────────────────

const EXTRACTION_PROMPT = `You are a food menu extraction AI. Analyze this image of a menu and extract all sellable food/drink items.

For EACH item, provide:
1. "name" — the food/drink item name (clean, properly capitalized)
2. "price" — the numeric price (number only, no currency symbols). If price is unclear, estimate reasonably.
3. "category" — one of: "meals", "snacks", "beverages", "desserts", "other"
   - meals: main dishes, thalis, rice items, combos, roti/bread with curry
   - snacks: samosa, sandwich, puff, chaat, fries, etc.
   - beverages: tea, coffee, juice, lassi, cold drinks, water, shakes
   - desserts: sweets, ice cream, kulfi, halwa, etc.
   - other: anything that doesn't clearly fit above
   - If the category is not clearly identifiable, default to "meals"

RULES:
- ONLY extract actual sellable food/drink items
- IGNORE decorative text, headings, restaurant names, slogans, phone numbers
- If text is unclear, use best semantic reasoning to infer the item name
- Prices should be numbers only (e.g., 50, not "₹50" or "Rs.50")
- Return ONLY a valid JSON array, no markdown, no explanation
- If no items are found, return an empty array []

Example output format:
[
  { "name": "Masala Dosa", "price": 60, "category": "meals" },
  { "name": "Cold Coffee", "price": 40, "category": "beverages" }
]`;

// ─── Parser Function ────────────────────────────

/**
 * Parse a menu image using the AI Router (auto-fallback across vision providers).
 *
 * @param base64Image - Base64-encoded image data (without the data:image/... prefix)
 * @param mimeType   - MIME type of the image (e.g., "image/jpeg", "image/png")
 * @returns Array of parsed menu items
 * @throws Error if all providers fail or response parsing fails
 */
export async function parseMenuImage(
    base64Image: string,
    mimeType: string
): Promise<ParsedMenuItem[]> {
    // Use the AI Router — automatic provider fallback + key rotation
    const aiResponse = await runVisionAI(base64Image, mimeType, EXTRACTION_PROMPT);

    if (!aiResponse.success) {
        throw new Error(aiResponse.error || "All AI vision providers failed");
    }

    console.log(`[MenuParser] Image parsed via ${aiResponse.provider}`);
    const text = aiResponse.data;

    // Extract JSON from the response — the model might wrap it in markdown code blocks
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.error("AI response did not contain valid JSON array:", text);
        throw new Error("Failed to parse AI response — no valid JSON array found");
    }

    const rawItems: unknown[] = JSON.parse(jsonMatch[0]);

    // Validate and sanitize each item
    const validItems: ParsedMenuItem[] = rawItems
        .filter((item): item is Record<string, unknown> => {
            return (
                typeof item === "object" &&
                item !== null &&
                typeof (item as Record<string, unknown>).name === "string" &&
                (item as Record<string, unknown>).name !== ""
            );
        })
        .map((item) => ({
            name: String(item.name).trim(),
            price: Math.max(0, Number(item.price) || 0),
            category: VALID_CATEGORIES.includes(item.category as typeof VALID_CATEGORIES[number])
                ? (item.category as ParsedMenuItem["category"])
                : "meals", // Default to "meals" if category is unclear
        }));

    return validItems;
}
