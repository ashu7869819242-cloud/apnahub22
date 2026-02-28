/**
 * MobileBottomNav — Swiggy-style sticky bottom navigation for mobile.
 * Shows: Menu | Orders | Wallet | Profile
 * Hidden on desktop (md+) and on admin/stock routes.
 */

"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

const navItems = [
    { href: "/", label: "Menu", icon: "🍽️", activeIcon: "🍽️" },
    { href: "/orders", label: "Orders", icon: "📋", activeIcon: "📋" },
    { href: "/wallet", label: "Wallet", icon: "💰", activeIcon: "💰" },
    { href: "/profile", label: "Profile", icon: "👤", activeIcon: "👤" },
];

export default function MobileBottomNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { itemCount } = useCart();

    // Hide on admin, stock, and auth routes
    if (!user) return null;
    if (pathname?.startsWith("/admin")) return null;
    if (pathname?.startsWith("/stock")) return null;
    if (pathname?.startsWith("/auth")) return null;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
            {/* Glass background */}
            <div className="bg-zayko-900/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.3)]">
                <div className="grid grid-cols-4 px-2 py-1">
                    {navItems.map((item) => {
                        const isActive = item.href === "/"
                            ? pathname === "/"
                            : pathname?.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all duration-200 relative ${isActive
                                        ? "text-gold-400"
                                        : "text-zayko-500 active:scale-95"
                                    }`}
                            >
                                {/* Active indicator dot */}
                                {isActive && (
                                    <div className="absolute -top-1 w-5 h-0.5 rounded-full bg-gold-400" />
                                )}

                                <span className="text-lg relative">
                                    {item.icon}
                                    {/* Cart badge on Menu */}
                                    {item.href === "/" && itemCount > 0 && (
                                        <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                                            {itemCount > 9 ? "9+" : itemCount}
                                        </span>
                                    )}
                                </span>
                                <span className={`text-[10px] font-semibold ${isActive ? "text-gold-400" : "text-zayko-500"}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* Safe area for iPhones with notch */}
                <div className="h-[env(safe-area-inset-bottom)]" />
            </div>
        </nav>
    );
}
