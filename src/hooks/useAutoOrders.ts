/**
 * useAutoOrders — React hook for managing auto recurring orders.
 */

"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import type { AutoOrder, AutoOrderFrequency, DayOfWeek } from "@/types";
import {
    getAutoOrders,
    createAutoOrder,
    updateAutoOrder,
    deleteAutoOrder,
} from "@/services/autoOrderService";
import toast from "react-hot-toast";

export function useAutoOrders() {
    const { user, getIdToken } = useAuth();
    const [autoOrders, setAutoOrders] = useState<AutoOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAutoOrders = useCallback(async () => {
        if (!user) return;
        try {
            const token = await getIdToken();
            if (!token) {
                console.warn("[useAutoOrders] No auth token available");
                return;
            }
            const data = await getAutoOrders(token, user.uid);
            setAutoOrders(data.autoOrders || []);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            console.error("[useAutoOrders] fetchAutoOrders failed:", message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, [user, getIdToken]);

    useEffect(() => {
        fetchAutoOrders();
    }, [fetchAutoOrders]);

    const addAutoOrder = useCallback(
        async (data: {
            itemId: string;
            quantity: number;
            time: string;
            frequency: AutoOrderFrequency;
            customDays?: DayOfWeek[];
        }) => {
            if (!user) return false;
            const token = await getIdToken();
            if (!token) return false;

            const result = await createAutoOrder(token, {
                userId: user.uid,
                ...data,
            });

            if (result.success) {
                toast.success("Auto order created!");
                await fetchAutoOrders();
                return true;
            } else {
                toast.error(result.error || "Failed to create auto order");
                return false;
            }
        },
        [user, getIdToken, fetchAutoOrders]
    );

    const editAutoOrder = useCallback(
        async (
            id: string,
            data: Partial<{
                quantity: number;
                time: string;
                frequency: AutoOrderFrequency;
                customDays: DayOfWeek[];
                itemId: string;
            }>
        ) => {
            const token = await getIdToken();
            if (!token) return false;

            const result = await updateAutoOrder(token, id, data);

            if (result.success) {
                toast.success("Auto order updated!");
                await fetchAutoOrders();
                return true;
            } else {
                toast.error(result.error || "Failed to update auto order");
                return false;
            }
        },
        [getIdToken, fetchAutoOrders]
    );

    const toggleAutoOrder = useCallback(
        async (id: string, currentStatus: "active" | "paused") => {
            const newStatus = currentStatus === "active" ? "paused" : "active";
            const token = await getIdToken();
            if (!token) return false;

            const result = await updateAutoOrder(token, id, { status: newStatus });

            if (result.success) {
                toast.success(newStatus === "active" ? "Auto order resumed!" : "Auto order paused!");
                await fetchAutoOrders();
                return true;
            } else {
                toast.error(result.error || "Failed to toggle auto order");
                return false;
            }
        },
        [getIdToken, fetchAutoOrders]
    );

    const removeAutoOrder = useCallback(
        async (id: string) => {
            const token = await getIdToken();
            if (!token) return false;

            const result = await deleteAutoOrder(token, id);

            if (result.success) {
                toast.success("Auto order deleted!");
                await fetchAutoOrders();
                return true;
            } else {
                toast.error(result.error || "Failed to delete auto order");
                return false;
            }
        },
        [getIdToken, fetchAutoOrders]
    );

    return {
        autoOrders,
        loading,
        addAutoOrder,
        editAutoOrder,
        toggleAutoOrder,
        removeAutoOrder,
        refresh: fetchAutoOrders,
    };
}
