"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const { user, profile, signOut } = useAuth();
    const { itemCount } = useCart();
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    if (pathname?.startsWith("/admin")) return null;
    if (pathname?.startsWith("/stock")) return null;

    const navLinks = [
        { href: "/", label: "Menu", icon: "🍽️" },
        { href: "/cart", label: "Cart", icon: "🛒", badge: itemCount },
        { href: "/orders", label: "Orders", icon: "📋" },
        { href: "/wallet", label: "Wallet", icon: "💰" },
    ];

    return (
        <nav className="sticky top-0 z-50 glass-navbar">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14 sm:h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group shrink-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center text-zayko-900 font-bold text-sm sm:text-lg group-hover:scale-110 transition-transform shadow-lg">
                            ⚡
                        </div>
                        <div>
                            <h1 className="text-sm sm:text-lg font-display font-bold text-white">Zayko</h1>
                            <p className="text-[9px] sm:text-[10px] text-zayko-400 -mt-0.5 hidden sm:block">Order Smart. Eat Fresh.</p>
                        </div>
                    </Link>

                    {/* Desktop Nav — hidden on mobile (bottom nav handles it) */}
                    {user && (
                        <div className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`relative flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${pathname === link.href
                                        ? "bg-gold-400/15 text-gold-400 border border-gold-400/20"
                                        : "text-zayko-300 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    <span className="text-sm">{link.icon}</span>
                                    <span>{link.label}</span>
                                    {link.badge ? (
                                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-scale-in">
                                            {link.badge}
                                        </span>
                                    ) : null}
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Right Section */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Wallet Badge — shown inline on mobile since it's useful */}
                        {user && profile && (
                            <Link href="/wallet" className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                                <span className="text-xs sm:text-sm">💰</span>
                                <span className="text-price text-xs sm:text-sm font-semibold">₹{profile.walletBalance || 0}</span>
                            </Link>
                        )}

                        {/* Desktop profile + logout */}
                        {user && profile && (
                            <div className="hidden md:flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-sm font-semibold text-white">{profile.name}</p>
                                    <p className="text-[10px] text-zayko-400">{profile.rollNumber}</p>
                                </div>
                                <button
                                    onClick={signOut}
                                    className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
                                >
                                    Logout
                                </button>
                            </div>
                        )}

                        {/* Mobile menu button — for profile/logout only */}
                        {user && (
                            <button
                                onClick={() => setMobileOpen(!mobileOpen)}
                                className="md:hidden p-2 rounded-xl hover:bg-white/10 transition-colors text-white"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {mobileOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Dropdown — only profile info + logout (nav links in bottom bar) */}
                {mobileOpen && user && (
                    <div className="md:hidden pb-3 animate-slide-down">
                        <div className="flex flex-col gap-1">
                            <Link
                                href="/cart"
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zayko-300 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <span className="text-lg">🛒</span>
                                <span>Cart</span>
                                {itemCount > 0 && (
                                    <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                        {itemCount}
                                    </span>
                                )}
                            </Link>
                            <Link
                                href="/profile"
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zayko-300 hover:text-white hover:bg-white/5 transition-all"
                            >
                                <span className="text-lg">👤</span>
                                <span>Profile</span>
                            </Link>
                            {profile && (
                                <div className="mt-1 pt-2 border-t border-white/10">
                                    <div className="px-4 py-1.5">
                                        <p className="text-sm font-semibold text-white">{profile.name}</p>
                                        <p className="text-xs text-zayko-400">{profile.rollNumber}</p>
                                    </div>
                                    <button
                                        onClick={signOut}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
