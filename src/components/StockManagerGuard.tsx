/**
 * StockManagerGuard — Server-Verified Stock Manager Route Protection
 * 
 * SECURITY:
 * - Calls GET /api/stock/verify to confirm JWT validity on mount
 * - Redirects to /stock login if token is invalid or expired
 * - Mirrors AdminGuard.tsx pattern
 */

"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StockManagerGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("stockManagerToken");

        if (!token) {
            router.push("/stock");
            setChecking(false);
            return;
        }

        fetch("/api/stock/verify", {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.valid) {
                    setAuthorized(true);
                } else {
                    localStorage.removeItem("stockManagerToken");
                    router.push("/stock");
                }
            })
            .catch(() => {
                localStorage.removeItem("stockManagerToken");
                router.push("/stock");
            })
            .finally(() => setChecking(false));
    }, [router]);

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zayko-900">
                <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!authorized) return null;

    return <>{children}</>;
}
