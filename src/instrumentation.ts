/**
 * Next.js Instrumentation Hook
 *
 * Runs ONCE when the Next.js server starts. Used for:
 * 1. Startup logging (server, Firebase, environment)
 * 2. Starting the node-cron auto-order scheduler
 *
 * This replaces Vercel Cron for Railway/self-hosted deployments.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // Only run on the Node.js server (not Edge, not client)
    if (process.env.NEXT_RUNTIME === "nodejs") {
        console.log("\n══════════════════════════════════════════════════");
        console.log("  🚀 [Instrumentation] Next.js Server Starting...");
        console.log(`  📅 ${new Date().toISOString()}`);
        console.log(`  🌍 NODE_ENV: ${process.env.NODE_ENV}`);
        console.log(`  🔑 CRON_SECRET: ${process.env.CRON_SECRET ? "configured" : "NOT SET"}`);
        console.log(`  🔥 FIREBASE_ADMIN_PROJECT_ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID || "NOT SET"}`);
        console.log("══════════════════════════════════════════════════\n");

        // Dynamically import to avoid Edge runtime issues
        try {
            // Verify Firebase Admin initializes correctly
            const { adminDb } = await import("@/lib/firebase-admin");
            console.log("[Instrumentation] ✅ Firebase Admin SDK loaded successfully");

            // Verify Firestore connectivity
            const testRef = adminDb.collection("_healthcheck");
            console.log(`[Instrumentation] ✅ Firestore connected`);
        } catch (err) {
            console.error("[Instrumentation] ❌ Firebase Admin SDK failed:", err);
        }

        // Start the cron scheduler
        try {
            const cron = await import("node-cron");
            const { executeAutoOrders } = await import("@/lib/auto-order-engine");

            // Run every minute: "* * * * *"
            cron.default.schedule("* * * * *", async () => {
                const timestamp = new Date().toISOString();
                console.log(`\n[Cron Scheduler] ⏰ Tick at ${timestamp}`);

                try {
                    const result = await executeAutoOrders();
                    console.log(
                        `[Cron Scheduler] ✅ Done — candidates: ${result.candidates}, succeeded: ${result.succeeded}, failed: ${result.failed}`
                    );
                } catch (err) {
                    console.error("[Cron Scheduler] ❌ Execution error:", err);
                }
            }, {
                timezone: "Asia/Kolkata",
            });

            console.log("[Instrumentation] ✅ Auto-order cron scheduler started (every minute, IST)");
            console.log("══════════════════════════════════════════════════\n");
        } catch (err) {
            console.error("[Instrumentation] ❌ Cron scheduler setup failed:", err);
        }
    }
}
