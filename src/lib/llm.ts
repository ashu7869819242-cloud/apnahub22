/**
 * LLM Service — Multi-LLM chat with automatic fallback via AI Router.
 *
 * Uses runTextAI() for automatic provider fallback + key rotation:
 * Gemini → Groq → Cohere → Poe
 *
 * This module preserves the chatWithFallback() API so existing callers
 * (chat route, llmService.ts) don't need changes.
 */

import { runTextAI } from "./aiRouter";

// ─── Types ──────────────────────────────────────

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

// ─── Chat Function ──────────────────────────────

/**
 * Send a chat conversation through the AI Router with automatic fallback.
 * Formats the messages into a single prompt for the standardized router interface.
 *
 * @param messages     - Conversation history
 * @param systemPrompt - System instruction for the AI
 * @returns The AI response text and the provider that handled it
 */
export async function chatWithFallback(
    messages: ChatMessage[],
    systemPrompt: string
): Promise<{ response: string; provider: string }> {
    // Format conversation history into a prompt
    // The AI Router handles provider-specific formatting internally
    const conversationParts: string[] = [];

    for (const msg of messages) {
        if (msg.role === "system") continue; // system prompt passed separately
        const prefix = msg.role === "user" ? "User" : "Assistant";
        conversationParts.push(`${prefix}: ${msg.content}`);
    }

    const prompt = conversationParts.join("\n\n");

    const result = await runTextAI(prompt, systemPrompt);

    if (result.success) {
        return { response: result.data, provider: result.provider };
    }

    // All providers failed — return a friendly fallback message
    console.error("[LLM] All providers failed:", result.error);
    return {
        response:
            "I'm sorry, I'm having trouble connecting to my AI services right now. Please try again in a moment! 🙏",
        provider: "fallback",
    };
}

export type { ChatMessage };
