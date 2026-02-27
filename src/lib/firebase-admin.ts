import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { validateEnv } from "@/lib/validate-env";

// Validate all required env vars on first import
validateEnv();

let app: App;

if (getApps().length === 0) {
    console.log("[Firebase Admin] 🔧 Initializing new Firebase Admin app...");
    console.log(`[Firebase Admin]    Project ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
    console.log(`[Firebase Admin]    Client Email: ${process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.substring(0, 20)}...`);
    console.log(`[Firebase Admin]    Private Key: ${process.env.FIREBASE_ADMIN_PRIVATE_KEY ? "✅ present" : "❌ MISSING"}`);

    try {
        app = initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
        });
        console.log("[Firebase Admin] ✅ Firebase Admin initialized successfully");
    } catch (err) {
        console.error("[Firebase Admin] ❌ Firebase Admin initialization FAILED:", err);
        throw err;
    }
} else {
    app = getApps()[0];
    console.log("[Firebase Admin] ♻️  Reusing existing Firebase Admin app");
}

const adminDb = getFirestore(app);
const adminAuth = getAuth(app);

export { adminDb, adminAuth };
