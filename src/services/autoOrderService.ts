/**
 * Auto Order Service — Client-side API wrappers for recurring order operations.
 */

export interface AutoOrderResponse {
    success: boolean;
    autoOrders?: any[];
    error?: string;
}

export async function getAutoOrders(token: string, userId: string): Promise<AutoOrderResponse> {
    const res = await fetch(`/api/auto-orders?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}

export async function createAutoOrder(token: string, data: any): Promise<AutoOrderResponse> {
    const res = await fetch("/api/auto-orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function updateAutoOrder(token: string, id: string, data: any): Promise<AutoOrderResponse> {
    const res = await fetch(`/api/auto-orders?id=${id}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function deleteAutoOrder(token: string, id: string): Promise<AutoOrderResponse> {
    const res = await fetch(`/api/auto-orders?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}
