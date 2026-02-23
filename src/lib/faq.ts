/**
 * FAQ Module — Static FAQ answers for the chatbot.
 *
 * If a user message matches a FAQ keyword pattern, the mapped answer
 * is returned directly without calling the LLM. For dynamic FAQs
 * (F02, F03), a flag is returned so the chat API can enrich the answer
 * with live menu data.
 */

interface FaqEntry {
    /** Keywords/phrases to match against (lowercase) */
    keywords: string[];
    /** Static answer, or null if dynamic */
    answer: string | null;
    /** If true, the chat API should handle this dynamically with menu data */
    dynamic?: "fastest_items" | "combo_suggestion";
}

const FAQ_MAP: FaqEntry[] = [
    // F01 — Available items
    {
        keywords: ["what items", "items available", "menu available", "kya available", "kya milega", "what is available", "available items", "what can i order", "what do you have"],
        answer: "You can check the live menu in the app. Only items marked as \"Available\" can be ordered. Head to the home page to see the full menu! 🍽️",
    },
    // F02 — Fastest items (dynamic)
    {
        keywords: ["fastest item", "quick item", "jaldi milega", "fast food", "quickest", "fastest", "quick order", "jaldi chahiye", "quick items"],
        answer: null,
        dynamic: "fastest_items",
    },
    // F03 — Combo suggestion (dynamic)
    {
        keywords: ["suggest combo", "combo suggest", "combo karo", "combo de do", "suggest a combo", "any combo", "combo available", "combo meal"],
        answer: null,
        dynamic: "combo_suggestion",
    },
    // F06 — Food preparation started
    {
        keywords: ["preparation starts", "preparation start", "food preparation", "once confirmed", "order modify", "can i modify", "change order after", "cancel after preparing"],
        answer: "Once your order is confirmed by the canteen and preparation starts, the order cannot be modified or cancelled. Please make sure your cart is correct before confirming! ✅",
    },
    // F10 — Cannot collect order
    {
        keywords: ["cannot collect", "can't collect", "friend collect", "roommate collect", "someone else collect", "not able to collect", "who can collect"],
        answer: "If you cannot collect your ready order, you can assign a friend or roommate to collect it on your behalf. Just share your Order ID with them! 🤝",
    },
    // F13 — Wallet credit expiry
    {
        keywords: ["wallet expire", "credit expire", "balance expire", "wallet expiry", "does wallet", "wallet credit expire", "paisa expire"],
        answer: "No, your wallet credit does not expire. Your balance stays safe until you use it! 💰",
    },
    // F20 — Contact for issues
    {
        keywords: ["contact for issue", "who to contact", "contact support", "report issue", "help contact", "problem contact", "issue contact", "kisse contact", "complaint"],
        answer: "For any issues, you can contact the canteen staff directly via the app or reach out through this chatbot. We're here to help! 🙏",
    },
];

export interface FaqMatch {
    answer: string | null;
    dynamic?: "fastest_items" | "combo_suggestion";
    matched: boolean;
}

/**
 * Check if a user message matches any FAQ entry.
 * Returns the match result or { matched: false } if no match.
 */
export function matchFaq(message: string): FaqMatch {
    const lower = message.toLowerCase().trim();

    for (const entry of FAQ_MAP) {
        const hits = entry.keywords.some((kw) => lower.includes(kw));
        if (hits) {
            return {
                answer: entry.answer,
                dynamic: entry.dynamic,
                matched: true,
            };
        }
    }

    return { answer: null, matched: false };
}
