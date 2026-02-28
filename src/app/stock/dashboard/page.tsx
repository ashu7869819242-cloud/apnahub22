"use client";
import React, { useEffect, useState, useRef } from "react";
import StockManagerGuard from "@/components/StockManagerGuard";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
    Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
    Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};
const BAR_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#ef4444"];

interface StockItem {
    itemId: string;
    itemName: string;
    currentStock: number;
    weeklyDemand: number;
    maxDailyDemand: number;
    suggestedMinStock: number;
    shortageRisk: boolean;
    dailyDemand: Record<string, number>;
}

interface PurchaseItem {
    itemName: string;
    currentStock: number;
    requiredStock: number;
    toBuy: number;
    urgency: "high" | "medium";
}

interface DashboardData {
    summary: {
        totalActiveUsers: number;
        highestDemandItem: string;
        highestDemandQty: number;
        mostDemandingDay: string;
        mostDemandingDayQty: number;
        itemsAtRisk: number;
        todayDay: string;
        tomorrowDay: string;
    };
    todayForecast: Record<string, number>;
    tomorrowForecast: Record<string, number>;
    demandByDay: Record<string, Record<string, number>>;
    weeklyTotals: Record<string, number>;
    stockComparison: StockItem[];
    purchasePlan: PurchaseItem[];
    dayChartData: Array<{ day: string; total: number }>;
}

export default function StockManagerDashboard() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterDay, setFilterDay] = useState("all");
    const [filterItem, setFilterItem] = useState("");
    const [shortageOnly, setShortageOnly] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const getHeaders = () => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("stockManagerToken")}`,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/stock/dashboard", { headers: getHeaders() });
            const json = await res.json();
            if (json.success) {
                setData(json);
            } else {
                toast.error(json.error || "Failed to load data");
            }
        } catch {
            toast.error("Failed to load dashboard data");
        }
        setLoading(false);
    };

    const handleLogout = () => {
        localStorage.removeItem("stockManagerToken");
        router.push("/stock");
    };

    const handlePrintReport = () => {
        window.print();
    };

    // Filter stock comparison
    const filteredStock = (data?.stockComparison || []).filter((s) => {
        if (filterItem && !s.itemName.toLowerCase().includes(filterItem.toLowerCase())) return false;
        if (shortageOnly && !s.shortageRisk) return false;
        return true;
    });

    const displayDays = filterDay === "all" ? ALL_DAYS : [filterDay];

    return (
        <StockManagerGuard>
            <div className="min-h-screen bg-zayko-900 pb-12" ref={reportRef}>
                {/* ─── Header ─── */}
                <div className="bg-zayko-800 border-b border-zayko-700 px-6 py-4 no-print">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">📦</div>
                            <div>
                                <h1 className="text-lg font-display font-bold text-white">Stock Manager Dashboard</h1>
                                <p className="text-xs text-zayko-400">Demand Forecast & Inventory Planning</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrintReport}
                                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-500/30 transition-all"
                            >
                                📄 Download Report
                            </button>
                            <button
                                onClick={() => { setLoading(true); fetchData(); }}
                                className="px-4 py-2 bg-gold-500/20 text-gold-400 rounded-xl text-sm font-semibold hover:bg-gold-500/30 transition-all"
                            >
                                🔄 Refresh
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/30 transition-all"
                            >
                                🚪 Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : !data ? (
                        <div className="text-center py-20 text-zayko-400">Failed to load data</div>
                    ) : (
                        <>
                            {/* ─── Summary Cards ─── */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in">
                                {[
                                    { label: "Active Users", value: data.summary.totalActiveUsers, icon: "👥", color: "text-blue-400" },
                                    { label: "Top Item", value: data.summary.highestDemandItem, sub: `${data.summary.highestDemandQty} units/week`, icon: "🔥", color: "text-gold-400" },
                                    { label: "Peak Day", value: data.summary.mostDemandingDay, sub: `${data.summary.mostDemandingDayQty} units`, icon: "📅", color: "text-purple-400" },
                                    { label: "Items at Risk", value: data.summary.itemsAtRisk, icon: "⚠️", color: data.summary.itemsAtRisk > 0 ? "text-red-400" : "text-emerald-400" },
                                ].map((card) => (
                                    <div key={card.label} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">{card.icon}</span>
                                            <span className="text-xs text-zayko-400">{card.label}</span>
                                        </div>
                                        <p className={`text-xl font-display font-bold ${card.color} truncate`}>{card.value}</p>
                                        {"sub" in card && card.sub && <p className="text-xs text-zayko-500 mt-0.5">{card.sub}</p>}
                                    </div>
                                ))}
                            </div>

                            {/* ─── Today & Tomorrow Forecast ─── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 animate-slide-up">
                                {/* Today */}
                                <div className="bg-zayko-800/50 border border-emerald-500/20 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-sm">📋</span>
                                        <div>
                                            <h3 className="text-sm font-display font-bold text-white">Today&apos;s Demand</h3>
                                            <p className="text-xs text-emerald-400">{data.summary.todayDay}</p>
                                        </div>
                                    </div>
                                    {Object.keys(data.todayForecast).length > 0 ? (
                                        <div className="space-y-1.5">
                                            {Object.entries(data.todayForecast)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([name, qty]) => (
                                                    <div key={name} className="flex items-center justify-between py-1.5 px-3 bg-white/5 rounded-xl">
                                                        <span className="text-sm text-zayko-200">{name}</span>
                                                        <span className="text-sm font-bold text-emerald-400">{qty} units</span>
                                                    </div>
                                                ))}
                                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-zayko-700">
                                                <span className="text-xs font-semibold text-zayko-400">Total</span>
                                                <span className="text-sm font-bold text-white">
                                                    {Object.values(data.todayForecast).reduce((s, v) => s + v, 0)} units
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-zayko-500 italic">No demand planned for today</p>
                                    )}
                                </div>

                                {/* Tomorrow */}
                                <div className="bg-zayko-800/50 border border-blue-500/20 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-sm">📆</span>
                                        <div>
                                            <h3 className="text-sm font-display font-bold text-white">Tomorrow&apos;s Demand</h3>
                                            <p className="text-xs text-blue-400">{data.summary.tomorrowDay}</p>
                                        </div>
                                    </div>
                                    {Object.keys(data.tomorrowForecast).length > 0 ? (
                                        <div className="space-y-1.5">
                                            {Object.entries(data.tomorrowForecast)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([name, qty]) => (
                                                    <div key={name} className="flex items-center justify-between py-1.5 px-3 bg-white/5 rounded-xl">
                                                        <span className="text-sm text-zayko-200">{name}</span>
                                                        <span className="text-sm font-bold text-blue-400">{qty} units</span>
                                                    </div>
                                                ))}
                                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-zayko-700">
                                                <span className="text-xs font-semibold text-zayko-400">Total</span>
                                                <span className="text-sm font-bold text-white">
                                                    {Object.values(data.tomorrowForecast).reduce((s, v) => s + v, 0)} units
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-zayko-500 italic">No demand planned for tomorrow</p>
                                    )}
                                </div>
                            </div>

                            {/* ─── Weekly Demand Chart ─── */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-6 mb-8 animate-slide-up">
                                <h3 className="text-lg font-display font-bold text-white mb-4">📈 Weekly Demand Overview</h3>
                                {data.dayChartData.some((d) => d.total > 0) ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={data.dayChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fill: "#94a3b8", fontSize: 12 }}
                                                tickFormatter={(v: string) => DAY_SHORT[v] || v}
                                            />
                                            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ background: "#0f2035", border: "1px solid #1e3a5f", borderRadius: "12px", color: "#fff" }}
                                                labelFormatter={(v) => `${v}`}
                                                formatter={(value) => [`${value} units`, "Demand"]}
                                            />
                                            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                                {data.dayChartData.map((_, idx) => (
                                                    <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-zayko-500">No demand data yet</div>
                                )}
                            </div>

                            {/* ─── Low Stock Alerts ─── */}
                            {data.stockComparison.filter((s) => s.shortageRisk).length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-8 animate-fade-in">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center text-sm">🚨</span>
                                        <h3 className="text-base font-display font-bold text-red-400">Low Stock Alerts</h3>
                                        <span className="ml-auto px-2 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold">
                                            {data.stockComparison.filter((s) => s.shortageRisk).length} items
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {data.stockComparison
                                            .filter((s) => s.shortageRisk)
                                            .map((s) => (
                                                <div key={s.itemId} className="bg-zayko-900/50 rounded-xl p-3 border border-red-500/20">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-semibold text-white">{s.itemName}</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold low-stock-pulse">
                                                            ⚠ SHORTAGE
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs text-zayko-400">
                                                        <span>Stock: <span className="text-red-400 font-bold">{s.currentStock}</span></span>
                                                        <span>Demand: <span className="text-gold-400 font-bold">{s.maxDailyDemand}</span>/day</span>
                                                    </div>
                                                    <div className="mt-2 h-1.5 bg-zayko-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all"
                                                            style={{ width: `${Math.min(100, (s.currentStock / s.maxDailyDemand) * 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* ─── Filters ─── */}
                            <div className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 mb-6 animate-slide-up no-print">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs text-zayko-400 font-semibold">Filters:</span>

                                    <select
                                        value={filterDay}
                                        onChange={(e) => setFilterDay(e.target.value)}
                                        className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none"
                                    >
                                        <option value="all" className="bg-zayko-800">All Days</option>
                                        {ALL_DAYS.map((d) => (
                                            <option key={d} value={d} className="bg-zayko-800">{d}</option>
                                        ))}
                                    </select>

                                    <input
                                        type="text"
                                        placeholder="Search item…"
                                        value={filterItem}
                                        onChange={(e) => setFilterItem(e.target.value)}
                                        className="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-zayko-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 w-44"
                                    />

                                    <button
                                        onClick={() => setShortageOnly(!shortageOnly)}
                                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${shortageOnly ? "bg-red-500 text-white" : "bg-white/5 text-zayko-400 border border-white/10"}`}
                                    >
                                        ⚠️ Shortage Risk
                                    </button>
                                </div>
                            </div>

                            {/* ─── Weekly Summary Table ─── */}
                            <div className="space-y-4 mb-8">
                                <h3 className="text-base font-display font-bold text-white flex items-center gap-2">
                                    <span className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-sm">📋</span>
                                    Weekly Demand Breakdown
                                </h3>
                                {displayDays.map((day) => {
                                    const items = data.demandByDay[day] || {};
                                    let entries = Object.entries(items).sort((a, b) => b[1] - a[1]);

                                    if (filterItem) {
                                        entries = entries.filter(([name]) =>
                                            name.toLowerCase().includes(filterItem.toLowerCase())
                                        );
                                    }

                                    return (
                                        <div key={day} className="bg-zayko-800/50 border border-zayko-700 rounded-2xl p-4 animate-slide-up">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-sm font-bold text-white">{day}</h4>
                                                <span className="text-xs text-zayko-500">
                                                    {entries.reduce((s, [, v]) => s + v, 0)} total units
                                                </span>
                                            </div>
                                            {entries.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {entries.map(([name, qty]) => (
                                                        <div key={name} className="flex items-center justify-between py-1.5 px-3 bg-white/5 rounded-xl">
                                                            <span className="text-sm text-zayko-200">{name}</span>
                                                            <span className="text-sm font-bold text-gold-400">{qty} units</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-zayko-500 italic">No demand</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ─── Stock Recommendations Table ─── */}
                            <div className="animate-slide-up mb-8">
                                <h3 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
                                    <span className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-sm">📊</span>
                                    Stock Recommendations
                                </h3>

                                {filteredStock.length === 0 ? (
                                    <div className="bg-zayko-800/30 border border-zayko-700 rounded-2xl p-8 text-center">
                                        <p className="text-zayko-400">No items match your filters</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-zayko-700">
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold">Item</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Current Stock</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Max Daily Demand</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Weekly Demand</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Suggested Min</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Risk</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredStock.map((s) => (
                                                    <tr key={s.itemId} className="border-b border-zayko-700/50 hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-3 text-white font-medium">{s.itemName}</td>
                                                        <td className="px-4 py-3 text-center text-zayko-200">{s.currentStock}</td>
                                                        <td className="px-4 py-3 text-center text-gold-400 font-semibold">{s.maxDailyDemand}</td>
                                                        <td className="px-4 py-3 text-center text-blue-400">{s.weeklyDemand}</td>
                                                        <td className="px-4 py-3 text-center text-emerald-400 font-semibold">{s.suggestedMinStock}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {s.shortageRisk ? (
                                                                <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">⚠ Shortage</span>
                                                            ) : (
                                                                <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓ OK</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* ─── Purchase Planning ─── */}
                            {data.purchasePlan.length > 0 && (
                                <div className="animate-slide-up">
                                    <h3 className="text-base font-display font-bold text-white mb-4 flex items-center gap-2">
                                        <span className="w-8 h-8 bg-gold-500/20 rounded-lg flex items-center justify-center text-sm">🛒</span>
                                        Purchase Planning
                                    </h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-zayko-700">
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold">Item</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Current Stock</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Required Stock</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">To Purchase</th>
                                                    <th className="px-4 py-3 text-zayko-400 font-semibold text-center">Urgency</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.purchasePlan.map((p) => (
                                                    <tr key={p.itemName} className="border-b border-zayko-700/50 hover:bg-white/5 transition-colors">
                                                        <td className="px-4 py-3 text-white font-medium">{p.itemName}</td>
                                                        <td className="px-4 py-3 text-center text-zayko-200">{p.currentStock}</td>
                                                        <td className="px-4 py-3 text-center text-blue-400">{p.requiredStock}</td>
                                                        <td className="px-4 py-3 text-center text-gold-400 font-bold">{p.toBuy}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            {p.urgency === "high" ? (
                                                                <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">🔴 High</span>
                                                            ) : (
                                                                <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">🟡 Medium</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </StockManagerGuard>
    );
}
