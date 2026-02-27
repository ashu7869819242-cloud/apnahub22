/**
 * GET /api/auto-orders/execute — Triggered by cron.
 * Processes all active auto-orders that match the current time and day.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    // In production, you might want to check a CRON_SECRET header from Vercel/cron-job.org

    try {
        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, "0");
        const currentMinute = now.getMinutes().toString().padStart(2, "0");
        const currentTime = `${currentHour}:${currentMinute}`;

        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const currentDay = days[now.getDay()];

        // Find active auto-orders for this time
        const snapshot = await adminDb.collection("auto-orders")
            .where("status", "==", "active")
            .where("time", "==", currentTime)
            .get();

        const results = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Handle frequency logic
            let shouldExecute = false;
            if (data.frequency === "daily") {
                shouldExecute = true;
            } else if (data.frequency === "weekdays" && !["saturday", "sunday"].includes(currentDay)) {
                shouldExecute = true;
            } else if (data.frequency === "custom" && data.customDays?.includes(currentDay)) {
                shouldExecute = true;
            }

            if (shouldExecute) {
                // Logic to create an actual order (simplified here)
                // In a real app, you'd call a internal function or order API
                results.push({ id: doc.id, userId: data.userId, executed: true });
            }
        }

        return NextResponse.json({
            success: true,
            processed: snapshot.size,
            executed: results.length,
            time: currentTime
        });
    } catch (error) {
        console.error("Auto-order execution failed:", error);
        return NextResponse.json({ error: "Execution failed" }, { status: 500 });
    }
}
