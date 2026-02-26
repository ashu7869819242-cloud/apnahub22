/**
 * Auto Order Service — Client-side API wrappers for auto order operations.
 *
 * Every function extracts the real backend error message and propagates it
 * instead of throwing generic strings. This ensures toast messages show
 * the actual reason (401, 403, Firestore index missing, etc.).
 */

import type { AutoOrder, AutoOrderFrequency, DayOfWeek } from "@/types";

interface ApiResponse<T = unknown> {
    success?: boolean;
    error?: string;
    autoOrders?: AutoOrder[];
    autoOrderId?: string;
    message?: string;
    data?: T;
}

/**
 * Safely extract the error message from a non-ok response.
 */
async function extractError(res: Response, fallback: string): Promise<string> {
    try {
        const body = await res.json();
        return body.error || body.message || fallback;
    } catch {
        return `${fallback} (HTTP ${res.status})`;
    }
}

export async function getAutoOrders(
    token: string,
    userId: string
): Promise<{ autoOrders: AutoOrder[] }> {
    const res = await fetch(`/api/auto-orders?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const errorMsg = await extractError(res, "Failed to fetch auto orders");
        console.error(`[AutoOrderService] GET /api/auto-orders failed — ${res.status}: ${errorMsg}`);
        throw new Error(errorMsg);
    }

    return res.json();
}

export async function createAutoOrder(
    token: string,
    data: {
        userId: string;
        itemId: string;
        quantity: number;
        time: string;
        frequency: AutoOrderFrequency;
        customDays?: DayOfWeek[];
    }
): Promise<ApiResponse> {
    const res = await fetch("/api/auto-orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) {
        console.error(`[AutoOrderService] POST /api/auto-orders failed — ${res.status}:`, body);
    }
    return body;
}

export async function updateAutoOrder(
    token: string,
    id: string,
    data: Partial<{
        quantity: number;
        time: string;
        frequency: AutoOrderFrequency;
        customDays: DayOfWeek[];
        itemId: string;
        status: "active" | "paused";
    }>
): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/auto-orders/${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) {
        console.error(`[AutoOrderService] PATCH /api/auto-orders/${id} failed — ${res.status}:`, body);
    }
    return body;
}

export async function deleteAutoOrder(
    token: string,
    id: string
): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`/api/auto-orders/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const body = await res.json();
    if (!res.ok) {
        console.error(`[AutoOrderService] DELETE /api/auto-orders/${id} failed — ${res.status}:`, body);
    }
    return body;
}
