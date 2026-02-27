/**
 * Auto-Order Engine — Reusable core logic for executing auto orders.
 *
 * This module contains the pure business logic for auto-order execution,
 * completely decoupled from HTTP/route concerns. It can be called by:
 *   1. The Vercel Cron route handler (production)
 *   2. The manual test-execute endpoint (development)
 *   3. Any future scheduler or trigger
 *
 * DEBUG LOGGING: Every critical step is logged with [AutoOrder Engine] prefix.
 */

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

// ─── IST Helpers ────────────────────────────────

/** Convert a Date to IST and return { time: "HH:MM", day: DayOfWeek, dateStr: "YYYY-MM-DD" } */
export function getIST(date: Date) {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    const hh = ist.getUTCHours().toString().padStart(2, "0");
    const mm = ist.getUTCMinutes().toString().padStart(2, "0");
    const day = DAY_MAP[ist.getUTCDay()];
    const yyyy = ist.getUTCFullYear();
    const mo = (ist.getUTCMonth() + 1).toString().padStart(2, "0");
    const dd = ist.getUTCDate().toString().padStart(2, "0");
    return { time: `${hh}:${mm}`, day, dateStr: `${yyyy}-${mo}-${dd}` };
}

// ─── Result type ────────────────────────────────

export interface AutoOrderResult {
    success: boolean;
    time: string;
    day: DayOfWeek;
    date: string;
    candidates: number;
    skipped: number;
    processed: number;
    succeeded: number;
    failed: number;
    errors: string[];
    message?: string;
}

// ─── Main Engine Function ───────────────────────

/**
 * Execute all pending auto orders for the current IST minute.
 *
 * This is the core function — no HTTP, no auth, just business logic.
 * Can optionally override the time for testing.
 */
export async function executeAutoOrders(overrideTime?: string): Promise<AutoOrderResult> {
    const runId = Math.random().toString(36).substring(2, 8);
    console.log(`\n[AutoOrder Engine] ═══════════════════════════════════════`);
    console.log(`[AutoOrder Engine] 🚀 Starting execution (runId: ${runId})`);

    // 1. Verify Firebase Admin is ready
    try {
        console.log(`[AutoOrder Engine] 🔥 Checking Firebase Admin SDK...`);
        const testRef = adminDb.collection("_healthcheck");
        console.log(`[AutoOrder Engine] ✅ Firebase Admin SDK is initialized`);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[AutoOrder Engine] ❌ Firebase Admin SDK FAILED: ${errMsg}`);
        return {
            success: false,
            time: "??:??",
            day: "Mon",
            date: "unknown",
            candidates: 0,
            skipped: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            errors: [`Firebase Admin SDK init failed: ${errMsg}`],
            message: "Firebase Admin SDK is not working",
        };
    }

    // 2. Get current IST time
    const now = new Date();
    const ist = getIST(now);
    const queryTime = overrideTime || ist.time;

    console.log(`[AutoOrder Engine] 🕐 UTC time: ${now.toISOString()}`);
    console.log(`[AutoOrder Engine] 🕐 IST time: ${ist.time}, Day: ${ist.day}, Date: ${ist.dateStr}`);
    if (overrideTime) {
        console.log(`[AutoOrder Engine] ⚠️  Using OVERRIDE time: ${overrideTime} (instead of ${ist.time})`);
    }

    const errors: string[] = [];

    try {
        // 3. Query active auto orders matching current time
        console.log(`[AutoOrder Engine] 🔍 Querying autoOrders where status=="active" AND time=="${queryTime}"...`);

        const snapshot = await adminDb
            .collection("autoOrders")
            .where("status", "==", "active")
            .where("time", "==", queryTime)
            .get();

        console.log(`[AutoOrder Engine] 📊 Firestore query returned ${snapshot.size} document(s)`);

        if (snapshot.empty) {
            console.log(`[AutoOrder Engine] 📭 No active orders for ${queryTime} — nothing to do`);
            console.log(`[AutoOrder Engine] ═══════════════════════════════════════\n`);
            return {
                success: true,
                time: queryTime,
                day: ist.day,
                date: ist.dateStr,
                candidates: 0,
                skipped: 0,
                processed: 0,
                succeeded: 0,
                failed: 0,
                errors: [],
                message: `No active auto orders for ${queryTime} IST`,
            };
        }

        // Log each candidate
        snapshot.docs.forEach((doc, i) => {
            const d = doc.data();
            console.log(`[AutoOrder Engine]   Candidate #${i + 1}: id=${doc.id}, item="${d.itemName}", qty=${d.quantity}, freq=${d.frequency}, user=${d.userId}`);
        });

        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        let skipped = 0;

        // 4. Process each auto order
        for (const autoOrderDoc of snapshot.docs) {
            const autoOrder = autoOrderDoc.data();
            const autoOrderId = autoOrderDoc.id;

            console.log(`\n[AutoOrder Engine] ── Processing: ${autoOrderId} ──`);
            console.log(`[AutoOrder Engine]    Item: ${autoOrder.itemName} x${autoOrder.quantity} @ ₹${autoOrder.itemPrice}`);
            console.log(`[AutoOrder Engine]    Frequency: ${autoOrder.frequency}, User: ${autoOrder.userId}`);

            try {
                // ─── Day-of-week check ───
                let shouldRun = false;
                if (autoOrder.frequency === "daily") {
                    shouldRun = true;
                    console.log(`[AutoOrder Engine]    📅 Frequency=daily → shouldRun=true`);
                } else if (autoOrder.frequency === "weekdays") {
                    shouldRun = WEEKDAYS.includes(ist.day);
                    console.log(`[AutoOrder Engine]    📅 Frequency=weekdays, today=${ist.day} → shouldRun=${shouldRun}`);
                } else if (autoOrder.frequency === "custom" && Array.isArray(autoOrder.customDays)) {
                    shouldRun = autoOrder.customDays.includes(ist.day);
                    console.log(`[AutoOrder Engine]    📅 Frequency=custom, days=${autoOrder.customDays.join(",")}, today=${ist.day} → shouldRun=${shouldRun}`);
                }

                if (!shouldRun) {
                    console.log(`[AutoOrder Engine]    ⏭ Skipped — not scheduled for ${ist.day}`);
                    skipped++;
                    continue;
                }

                // ─── Duplicate guard ───
                if (autoOrder.lastExecutedDate === ist.dateStr) {
                    console.log(`[AutoOrder Engine]    ⏭ Skipped — already ran today (${ist.dateStr})`);
                    skipped++;
                    continue;
                }

                processed++;
                const total = autoOrder.itemPrice * autoOrder.quantity;
                console.log(`[AutoOrder Engine]    💰 Total cost: ₹${total}`);

                // ─── Atomic transaction ───
                console.log(`[AutoOrder Engine]    🔄 Starting Firestore transaction...`);

                await adminDb.runTransaction(async (transaction) => {
                    // READ PHASE
                    const userRef = adminDb.collection("users").doc(autoOrder.userId);
                    const userDoc = await transaction.get(userRef);

                    if (!userDoc.exists) {
                        console.error(`[AutoOrder Engine]    ❌ User ${autoOrder.userId} not found in Firestore`);
                        throw new Error("USER_NOT_FOUND");
                    }

                    const userData = userDoc.data()!;
                    const walletBalance = userData.walletBalance ?? 0;
                    console.log(`[AutoOrder Engine]    👛 Wallet balance: ₹${walletBalance}`);

                    // ─── Insufficient balance ───
                    if (walletBalance < total) {
                        console.log(`[AutoOrder Engine]    💸 INSUFFICIENT: ₹${walletBalance} < ₹${total}`);

                        const execRef = adminDb.collection("autoOrderExecutions").doc();
                        transaction.set(execRef, {
                            autoOrderId,
                            userId: autoOrder.userId,
                            success: false,
                            failureReason: `Insufficient balance: ₹${walletBalance} < ₹${total}`,
                            executedAt: now.toISOString(),
                        });

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
                    console.log(`[AutoOrder Engine]    ✅ Balance sufficient — creating order...`);

                    const orderId = generateOrderId();
                    console.log(`[AutoOrder Engine]    📝 Generated order ID: ${orderId}`);

                    // 1. Deduct wallet
                    transaction.update(userRef, {
                        walletBalance: FieldValue.increment(-total),
                    });
                    console.log(`[AutoOrder Engine]    💳 Wallet deduction: -₹${total}`);

                    // 2. Create order
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
                    console.log(`[AutoOrder Engine]    📦 Order created in "orders" collection`);

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
                    console.log(`[AutoOrder Engine]    💵 Wallet transaction recorded`);

                    // 4. Notification
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
                    console.log(`[AutoOrder Engine]    🔔 Notification created`);

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
                    console.log(`[AutoOrder Engine]    📋 Execution log recorded`);

                    // 6. Update auto order tracking
                    transaction.update(autoOrderDoc.ref, {
                        lastExecutedDate: ist.dateStr,
                        lastExecutedAt: now.toISOString(),
                        totalExecutions: FieldValue.increment(1),
                        updatedAt: now.toISOString(),
                    });
                    console.log(`[AutoOrder Engine]    📊 Auto-order tracking updated`);
                });

                succeeded++;
                console.log(`[AutoOrder Engine]    🎉 SUCCESS — ${autoOrder.itemName} x${autoOrder.quantity} → ₹${total} for ${autoOrder.userId}`);

            } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Unknown error";
                if (errMsg === "INSUFFICIENT_BALANCE") {
                    console.log(`[AutoOrder Engine]    💸 FAILED — insufficient wallet balance`);
                    errors.push(`${autoOrderId}: insufficient balance`);
                } else if (errMsg === "USER_NOT_FOUND") {
                    console.error(`[AutoOrder Engine]    ❌ FAILED — user ${autoOrder.userId} not found`);
                    errors.push(`${autoOrderId}: user not found`);
                } else {
                    console.error(`[AutoOrder Engine]    ❌ FAILED — ${errMsg}`);
                    errors.push(`${autoOrderId}: ${errMsg}`);
                }
                failed++;
            }
        }

        const result: AutoOrderResult = {
            success: true,
            time: queryTime,
            day: ist.day,
            date: ist.dateStr,
            candidates: snapshot.size,
            skipped,
            processed,
            succeeded,
            failed,
            errors,
        };

        console.log(`\n[AutoOrder Engine] ─── SUMMARY ───`);
        console.log(`[AutoOrder Engine] Time: ${queryTime} IST (${ist.day}) ${ist.dateStr}`);
        console.log(`[AutoOrder Engine] Candidates: ${snapshot.size}, Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}, Skipped: ${skipped}`);
        console.log(`[AutoOrder Engine] ═══════════════════════════════════════\n`);

        return result;

    } catch (error) {
        const msg = error instanceof Error ? error.message : "Execution failed";
        console.error(`[AutoOrder Engine] 💥 FATAL ERROR: ${msg}`);
        console.error(`[AutoOrder Engine] Stack:`, error);
        console.log(`[AutoOrder Engine] ═══════════════════════════════════════\n`);
        return {
            success: false,
            time: queryTime,
            day: ist.day,
            date: ist.dateStr,
            candidates: 0,
            skipped: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            errors: [msg],
            message: msg,
        };
    }
}
