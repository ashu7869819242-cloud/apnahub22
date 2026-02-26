/**
 * Auto Order Execution (Cron) — Runs every minute via Vercel Cron
 *
 * PRODUCTION ARCHITECTURE:
 * ─────────────────────────
 * • Vercel Cron hits GET /api/auto-orders/execute every minute
 * • Auth: Vercel injects CRON_SECRET via request header on production
 *         For local testing: curl with ?secret=<CRON_SECRET>
 * • Timezone: Vercel runs on UTC, but users schedule in IST (UTC+5:30)
 *   → We convert server time to IST before matching
 * • Duplicate guard: each auto order stores lastExecutedDate (YYYY-MM-DD)
 *   so it can only fire once per calendar day per schedule
 * • Atomic: wallet deduction + order creation in a single Firestore transaction
 * • Failure: insufficient balance is logged, order is skipped, auto order stays active
 *
 * Cost optimization:
 * • Only queries autoOrders where status=="active" AND time==currentTime(IST)
 *   → Firestore reads are proportional to MATCHING orders, not all orders
 *   → Composite index on (status, time) makes this efficient
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { generateOrderId } from "@/lib/orderIdUtils";
import { FieldValue } from "firebase-admin/firestore";
import type { DayOfWeek } from "@/types";

// ─── Constants ──────────────────────────────────

const DAY_MAP: Record<number, DayOfWeek> = {
    0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed",
    4: "Thu", 5: "Fri", 6: "Sat",
};

const WEEKDAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// IST offset = UTC + 5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Convert a Date to IST and return { time: "HH:MM", day: DayOfWeek, dateStr: "YYYY-MM-DD" } */
function getIST(date: Date) {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    const hh = ist.getUTCHours().toString().padStart(2, "0");
    const mm = ist.getUTCMinutes().toString().padStart(2, "0");
    const day = DAY_MAP[ist.getUTCDay()];
    const yyyy = ist.getUTCFullYear();
    const mo = (ist.getUTCMonth() + 1).toString().padStart(2, "0");
    const dd = ist.getUTCDate().toString().padStart(2, "0");
    return { time: `${hh}:${mm}`, day, dateStr: `${yyyy}-${mo}-${dd}` };
}

// ─── Auth ───────────────────────────────────────

function verifyCronAuth(req: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        // No secret configured → allow (dev mode only; log warning)
        console.warn("[AutoOrder Cron] ⚠️ CRON_SECRET not set — running without auth (dev mode)");
        return true;
    }

    // Method 1: Vercel Cron production — sends secret via Authorization header
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;

    // Method 2: Local testing — pass as query param: ?secret=xxx
    const { searchParams } = new URL(req.url);
    if (searchParams.get("secret") === cronSecret) return true;

    return false;
}

// ─── Maximum execution time hint for Vercel ─────
export const maxDuration = 60; // seconds (Vercel Pro limit)

// ─── Main handler ───────────────────────────────

export async function GET(req: NextRequest) {
    // 1. Auth
    if (!verifyCronAuth(req)) {
        console.warn("[AutoOrder Cron] ❌ Unauthorized cron attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get current IST time
    const now = new Date();
    const ist = getIST(now);

    console.log(`[AutoOrder Cron] ─── Run at ${ist.time} IST (${ist.day}) ${ist.dateStr} ───`);

    try {
        // 3. Query ONLY active auto orders that match the current IST time
        //    This uses the composite index (status, time) for efficiency
        const snapshot = await adminDb
            .collection("autoOrders")
            .where("status", "==", "active")
            .where("time", "==", ist.time)
            .get();

        if (snapshot.empty) {
            console.log(`[AutoOrder Cron] No active orders for ${ist.time}`);
            return NextResponse.json({
                success: true,
                processed: 0,
                message: `No active auto orders for ${ist.time} IST`,
            });
        }

        console.log(`[AutoOrder Cron] Found ${snapshot.size} candidate(s)`);

        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        let skipped = 0;

        for (const autoOrderDoc of snapshot.docs) {
            const autoOrder = autoOrderDoc.data();
            const autoOrderId = autoOrderDoc.id;

            try {
                // ─── Day-of-week check ───
                let shouldRun = false;
                if (autoOrder.frequency === "daily") {
                    shouldRun = true;
                } else if (autoOrder.frequency === "weekdays") {
                    shouldRun = WEEKDAYS.includes(ist.day);
                } else if (autoOrder.frequency === "custom" && Array.isArray(autoOrder.customDays)) {
                    shouldRun = autoOrder.customDays.includes(ist.day);
                }

                if (!shouldRun) {
                    skipped++;
                    continue;
                }

                // ─── Duplicate guard: one execution per calendar day ───
                // Uses IST date string so "daily at 08:00" can't fire twice on the same IST day
                if (autoOrder.lastExecutedDate === ist.dateStr) {
                    console.log(`[AutoOrder Cron] ⏭ ${autoOrderId} already ran on ${ist.dateStr}`);
                    skipped++;
                    continue;
                }

                processed++;
                const total = autoOrder.itemPrice * autoOrder.quantity;

                // ─── Atomic transaction ───
                await adminDb.runTransaction(async (transaction) => {
                    // READ PHASE
                    const userRef = adminDb.collection("users").doc(autoOrder.userId);
                    const userDoc = await transaction.get(userRef);

                    if (!userDoc.exists) {
                        throw new Error("USER_NOT_FOUND");
                    }

                    const walletBalance = userDoc.data()?.walletBalance ?? 0;

                    // ─── Insufficient balance path ───
                    if (walletBalance < total) {
                        // Log the failure
                        const execRef = adminDb.collection("autoOrderExecutions").doc();
                        transaction.set(execRef, {
                            autoOrderId,
                            userId: autoOrder.userId,
                            success: false,
                            failureReason: `Insufficient balance: ₹${walletBalance} < ₹${total}`,
                            executedAt: now.toISOString(),
                        });

                        // Update auto order with failure info
                        transaction.update(autoOrderDoc.ref, {
                            lastExecutedDate: ist.dateStr,
                            lastExecutedAt: now.toISOString(),
                            lastFailedAt: now.toISOString(),
                            lastFailureReason: `Insufficient balance (₹${walletBalance} available, ₹${total} needed)`,
                            totalFailures: FieldValue.increment(1),
                            updatedAt: now.toISOString(),
                        });

                        throw new Error("INSUFFICIENT_BALANCE");
                    }

                    // ─── Success path ───

                    // WRITE PHASE (all writes after all reads)
                    const orderId = generateOrderId();
                    const userData = userDoc.data()!;

                    // 1. Deduct wallet atomically
                    transaction.update(userRef, {
                        walletBalance: FieldValue.increment(-total),
                    });

                    // 2. Create order (appears in admin panel)
                    const orderRef = adminDb.collection("orders").doc();
                    transaction.set(orderRef, {
                        orderId,
                        userId: autoOrder.userId,
                        userName: userData.name || "Auto Order",
                        userEmail: userData.email || "",
                        userRollNumber: userData.rollNumber || "",
                        items: [{
                            id: autoOrder.itemId,
                            name: autoOrder.itemName,
                            price: autoOrder.itemPrice,
                            quantity: autoOrder.quantity,
                        }],
                        total,
                        paymentMode: "Wallet",
                        status: "pending",
                        isAutoOrder: true,
                        autoOrderId,
                        createdAt: now.toISOString(),
                        updatedAt: now.toISOString(),
                    });

                    // 3. Wallet transaction record
                    const txnRef = adminDb.collection("walletTransactions").doc();
                    transaction.set(txnRef, {
                        userId: autoOrder.userId,
                        type: "debit",
                        amount: total,
                        description: `Auto Order #${orderId} — ${autoOrder.itemName} x${autoOrder.quantity}`,
                        transactionId: txnRef.id,
                        createdAt: now.toISOString(),
                    });

                    // 4. Notification (in-app)
                    const notifRef = adminDb.collection("notifications").doc();
                    transaction.set(notifRef, {
                        userId: autoOrder.userId,
                        type: "auto_order",
                        title: "Auto Order Placed ✅",
                        message: `${autoOrder.itemName} x${autoOrder.quantity} (₹${total}) placed automatically.`,
                        orderId,
                        read: false,
                        createdAt: now.toISOString(),
                    });

                    // 5. Execution log
                    const execRef = adminDb.collection("autoOrderExecutions").doc();
                    transaction.set(execRef, {
                        autoOrderId,
                        userId: autoOrder.userId,
                        orderId,
                        success: true,
                        amountDeducted: total,
                        executedAt: now.toISOString(),
                    });

                    // 6. Update auto order tracking
                    transaction.update(autoOrderDoc.ref, {
                        lastExecutedDate: ist.dateStr,
                        lastExecutedAt: now.toISOString(),
                        totalExecutions: FieldValue.increment(1),
                        updatedAt: now.toISOString(),
                    });
                });

                succeeded++;
                console.log(
                    `[AutoOrder Cron] ✅ ${autoOrderId} — ${autoOrder.itemName} x${autoOrder.quantity} → ₹${total} for ${autoOrder.userId}`
                );
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Unknown error";
                if (errMsg === "INSUFFICIENT_BALANCE") {
                    console.log(`[AutoOrder Cron] 💸 ${autoOrderId} — insufficient wallet balance`);
                } else if (errMsg === "USER_NOT_FOUND") {
                    console.error(`[AutoOrder Cron] ❌ ${autoOrderId} — user ${autoOrder.userId} not found`);
                } else {
                    console.error(`[AutoOrder Cron] ❌ ${autoOrderId}:`, errMsg);
                }
                failed++;
            }
        }

        const result = {
            success: true,
            time: ist.time,
            day: ist.day,
            date: ist.dateStr,
            candidates: snapshot.size,
            skipped,
            processed,
            succeeded,
            failed,
        };

        console.log("[AutoOrder Cron] ─── Result:", JSON.stringify(result));
        return NextResponse.json(result);
    } catch (error) {
        console.error("[AutoOrder Cron] Fatal error:", error);
        const msg = error instanceof Error ? error.message : "Cron execution failed";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
