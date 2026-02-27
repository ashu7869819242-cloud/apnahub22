/**
 * Local Development Cron Simulator
 *
 * Runs alongside `next dev` and hits the auto-order execute endpoint
 * every 60 seconds, simulating Vercel Cron behavior locally.
 *
 * Usage:
 *   node scripts/dev-cron.js
 *
 * The script reads CRON_SECRET from .env.local automatically.
 * Alternatively, set CRON_SECRET as an environment variable.
 */

const fs = require("fs");
const path = require("path");

// ─── Load .env.local ────────────────────────────

const envPath = path.join(__dirname, "..", ".env.local");
let CRON_SECRET = process.env.CRON_SECRET || "";

if (!CRON_SECRET && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/^CRON_SECRET=(.+)$/m);
    if (match) {
        CRON_SECRET = match[1].trim().replace(/^["']|["']$/g, "");
    }
}

// ─── Config ─────────────────────────────────────

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;
const INTERVAL_MS = 60_000; // 60 seconds

// ─── Runner ─────────────────────────────────────

async function runCron() {
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const url = CRON_SECRET
        ? `${BASE_URL}/api/auto-orders/execute?secret=${CRON_SECRET}`
        : `${BASE_URL}/api/auto-orders/execute`;

    console.log(`\n[Dev Cron] ⏰ ${timestamp} — Hitting ${url.replace(CRON_SECRET, "***")}`);

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (res.ok) {
            console.log(`[Dev Cron] ✅ Status ${res.status} — Candidates: ${data.candidates || 0}, Succeeded: ${data.succeeded || 0}, Failed: ${data.failed || 0}`);
        } else {
            console.error(`[Dev Cron] ❌ Status ${res.status}:`, data.error || JSON.stringify(data));
        }
    } catch (err) {
        console.error(`[Dev Cron] 💥 Request failed:`, err.message);
        console.error(`[Dev Cron]    Is the dev server running on port ${PORT}?`);
    }
}

// ─── Start ──────────────────────────────────────

console.log("══════════════════════════════════════════════════");
console.log("  🔄 Auto-Order Dev Cron Simulator");
console.log(`  📡 Target: ${BASE_URL}/api/auto-orders/execute`);
console.log(`  🔑 CRON_SECRET: ${CRON_SECRET ? "configured" : "not set (no auth)"}`);
console.log(`  ⏱️  Interval: ${INTERVAL_MS / 1000}s`);
console.log("══════════════════════════════════════════════════");
console.log("  Press Ctrl+C to stop\n");

// Run immediately, then every INTERVAL_MS
runCron();
setInterval(runCron, INTERVAL_MS);
