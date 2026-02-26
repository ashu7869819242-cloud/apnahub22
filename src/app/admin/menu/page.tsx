"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import AdminGuard from "@/components/AdminGuard";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import toast from "react-hot-toast";
import MenuImageUpload from "@/components/admin/MenuImageUpload";
import ParsedItemsPreview from "@/components/admin/ParsedItemsPreview";
import MenuFilters, {
    type CategoryFilter,
    type AvailabilityFilter,
} from "@/components/admin/MenuFilters";

// ─── Types ──────────────────────────────────────

interface MenuItem {
    id: string;
    name: string;
    price: number;
    category: string;
    available: boolean;
    quantity: number;
    preparationTime?: number;
    description?: string;
}

interface ParsedMenuItem {
    name: string;
    price: number;
    category: "meals" | "snacks" | "beverages" | "desserts" | "other";
}

// ─── Constants ──────────────────────────────────

const CATEGORIES = ["meals", "snacks", "beverages", "desserts", "other"];

// ─── Component ──────────────────────────────────

export default function AdminMenuPage() {
    // Core state
    const [items, setItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Add/Edit form state
    const [showForm, setShowForm] = useState(false);
    const [editItem, setEditItem] = useState<MenuItem | null>(null);
    const [form, setForm] = useState({
        name: "",
        price: "",
        category: "meals",
        quantity: "",
        description: "",
        available: true,
        preparationTime: "",
    });
    const [saving, setSaving] = useState(false);

    // AI Upload state
    const [showAiUpload, setShowAiUpload] = useState(false);
    const [parsedItems, setParsedItems] = useState<ParsedMenuItem[] | null>(null);

    // Filter state
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
    const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");

    // Inline quantity editing state
    const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
    const [tempQuantity, setTempQuantity] = useState("");

    // ─── Real-time Firestore subscription ─────────

    useEffect(() => {
        const q = query(collection(db, "menuItems"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const menuList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as MenuItem[];
            setItems(menuList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // ─── Filtered items (client-side) ─────────────

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            // Category filter
            if (categoryFilter !== "all" && item.category !== categoryFilter) {
                return false;
            }

            // Availability filter
            // "unavailable" means: available === false OR quantity === 0
            if (availabilityFilter === "available") {
                if (!item.available || item.quantity === 0) return false;
            } else if (availabilityFilter === "unavailable") {
                if (item.available && item.quantity > 0) return false;
            }

            return true;
        });
    }, [items, categoryFilter, availabilityFilter]);

    // ─── Auth header helper ───────────────────────

    const getAdminHeaders = useCallback((contentType = true): HeadersInit => {
        const token = localStorage.getItem("adminToken");
        const headers: Record<string, string> = {
            Authorization: `Bearer ${token}`,
        };
        if (contentType) headers["Content-Type"] = "application/json";
        return headers;
    }, []);

    // ─── Form handlers ───────────────────────────

    const resetForm = () => {
        setForm({
            name: "",
            price: "",
            category: "meals",
            quantity: "",
            description: "",
            available: true,
            preparationTime: "",
        });
        setEditItem(null);
        setShowForm(false);
    };

    const openEdit = (item: MenuItem) => {
        setEditItem(item);
        setForm({
            name: item.name,
            price: String(item.price),
            category: item.category,
            quantity: String(item.quantity),
            description: item.description || "",
            available: item.available,
            preparationTime: item.preparationTime
                ? String(item.preparationTime)
                : "",
        });
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!form.name || !form.price || !form.quantity) {
            toast.error("Name, price, and quantity are required");
            return;
        }

        setSaving(true);
        try {
            if (editItem) {
                await fetch("/api/admin/menu", {
                    method: "PUT",
                    headers: getAdminHeaders(),
                    body: JSON.stringify({
                        id: editItem.id,
                        name: form.name,
                        price: Number(form.price),
                        category: form.category,
                        quantity: Number(form.quantity),
                        description: form.description,
                        available: form.available,
                        preparationTime: form.preparationTime
                            ? Number(form.preparationTime)
                            : 0,
                    }),
                });
                toast.success("Item updated! ✅");
            } else {
                await fetch("/api/admin/menu", {
                    method: "POST",
                    headers: getAdminHeaders(),
                    body: JSON.stringify({
                        name: form.name,
                        price: Number(form.price),
                        category: form.category,
                        quantity: Number(form.quantity),
                        description: form.description,
                        available: form.available,
                        preparationTime: form.preparationTime
                            ? Number(form.preparationTime)
                            : 0,
                    }),
                });
                toast.success("Item added! 🎉");
            }
            resetForm();
        } catch {
            toast.error("Failed to save item");
        }
        setSaving(false);
    };

    const deleteItem = async (id: string) => {
        if (!confirm("Delete this item?")) return;
        try {
            await fetch("/api/admin/menu", {
                method: "DELETE",
                headers: getAdminHeaders(),
                body: JSON.stringify({ id }),
            });
            toast.success("Item deleted");
        } catch {
            toast.error("Failed to delete");
        }
    };

    const toggleAvailability = async (item: MenuItem) => {
        try {
            await fetch("/api/admin/menu", {
                method: "PUT",
                headers: getAdminHeaders(),
                body: JSON.stringify({ id: item.id, available: !item.available }),
            });
            toast.success(
                `${item.name} marked as ${!item.available ? "available" : "unavailable"}`
            );
        } catch {
            toast.error("Failed to update");
        }
    };

    // ─── Inline quantity editing ──────────────────

    const startQuantityEdit = (item: MenuItem) => {
        setEditingQuantity(item.id);
        setTempQuantity(String(item.quantity));
    };

    /**
     * Saves the updated quantity to Firestore.
     * If quantity becomes 0, automatically sets available = false.
     * If quantity goes from 0 to a positive number, automatically sets available = true.
     */
    const saveQuantity = async (item: MenuItem) => {
        const newQuantity = Math.max(0, parseInt(tempQuantity, 10) || 0);
        setEditingQuantity(null);

        // Don't update if nothing changed
        if (newQuantity === item.quantity) return;

        try {
            // Determine if availability needs to change
            const updateData: Record<string, unknown> = {
                id: item.id,
                quantity: newQuantity,
            };

            // Auto-toggle availability based on quantity
            if (newQuantity === 0 && item.available) {
                updateData.available = false;
                toast("Quantity is 0 — item marked unavailable", { icon: "⚠️" });
            } else if (newQuantity > 0 && !item.available) {
                updateData.available = true;
                toast("Stock restored — item marked available", { icon: "✅" });
            }

            await fetch("/api/admin/menu", {
                method: "PUT",
                headers: getAdminHeaders(),
                body: JSON.stringify(updateData),
            });
        } catch {
            toast.error("Failed to update quantity");
        }
    };

    const handleQuantityKeyDown = (
        e: React.KeyboardEvent,
        item: MenuItem
    ) => {
        if (e.key === "Enter") saveQuantity(item);
        if (e.key === "Escape") setEditingQuantity(null);
    };

    // ─── AI Upload handlers ───────────────────────

    const handleItemsParsed = (items: ParsedMenuItem[]) => {
        setShowAiUpload(false);
        setParsedItems(items);
    };

    const handlePreviewClose = () => {
        setParsedItems(null);
    };

    // ─── Render ───────────────────────────────────

    return (
        <AdminGuard>
            <div className="min-h-screen bg-campus-900">
                {/* Header */}
                <div className="bg-campus-800 border-b border-campus-700 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link
                                href="/admin/dashboard"
                                className="text-campus-400 hover:text-white transition-colors"
                            >
                                ← Dashboard
                            </Link>
                            <h1 className="text-lg font-display font-bold text-white">
                                🍽️ Menu Management
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* AI Upload Button */}
                            <button
                                onClick={() => setShowAiUpload(true)}
                                className="px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-sm font-medium hover:bg-purple-500/30 transition-all flex items-center gap-2"
                            >
                                🤖 AI Upload
                            </button>
                            {/* Manual Add Button */}
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowForm(true);
                                }}
                                className="btn-gold text-sm py-2"
                            >
                                + Add Item
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-6">
                    {/* ── Filters ── */}
                    <MenuFilters
                        categoryFilter={categoryFilter}
                        availabilityFilter={availabilityFilter}
                        onCategoryChange={setCategoryFilter}
                        onAvailabilityChange={setAvailabilityFilter}
                        totalCount={items.length}
                        filteredCount={filteredItems.length}
                    />

                    {/* ── AI Upload Modal ── */}
                    {showAiUpload && (
                        <MenuImageUpload
                            onItemsParsed={handleItemsParsed}
                            onClose={() => setShowAiUpload(false)}
                        />
                    )}

                    {/* ── Parsed Items Preview Modal ── */}
                    {parsedItems && (
                        <ParsedItemsPreview
                            items={parsedItems}
                            onClose={handlePreviewClose}
                        />
                    )}

                    {/* ── Add/Edit Modal ── */}
                    {showForm && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-campus-800 border border-campus-700 rounded-2xl p-6 w-full max-w-md animate-scale-in">
                                <h3 className="text-lg font-display font-bold text-white mb-4">
                                    {editItem ? "✏️ Edit Item" : "➕ Add New Item"}
                                </h3>

                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({ ...form, name: e.target.value })
                                        }
                                        placeholder="Item name"
                                        className="w-full px-4 py-3 rounded-xl bg-campus-700 border border-campus-600 text-white placeholder:text-campus-500 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="number"
                                            value={form.price}
                                            onChange={(e) =>
                                                setForm({ ...form, price: e.target.value })
                                            }
                                            placeholder="Price (₹)"
                                            className="w-full px-4 py-3 rounded-xl bg-campus-700 border border-campus-600 text-white placeholder:text-campus-500 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                        />
                                        <input
                                            type="number"
                                            value={form.quantity}
                                            onChange={(e) =>
                                                setForm({ ...form, quantity: e.target.value })
                                            }
                                            placeholder="Quantity"
                                            className="w-full px-4 py-3 rounded-xl bg-campus-700 border border-campus-600 text-white placeholder:text-campus-500 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        value={form.preparationTime}
                                        onChange={(e) =>
                                            setForm({ ...form, preparationTime: e.target.value })
                                        }
                                        placeholder="Preparation time (minutes)"
                                        min={0}
                                        className="w-full px-4 py-3 rounded-xl bg-campus-700 border border-campus-600 text-white placeholder:text-campus-500 focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                    />
                                    <select
                                        value={form.category}
                                        onChange={(e) =>
                                            setForm({ ...form, category: e.target.value })
                                        }
                                        className="w-full px-4 py-3 rounded-xl bg-campus-700 border border-campus-600 text-white focus:ring-2 focus:ring-gold-400 focus:outline-none"
                                    >
                                        {CATEGORIES.map((c) => (
                                            <option key={c} value={c} className="capitalize">
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) =>
                                            setForm({ ...form, description: e.target.value })
                                        }
                                        placeholder="Description (optional)"
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-xl bg-campus-700 border border-campus-600 text-white placeholder:text-campus-500 focus:ring-2 focus:ring-gold-400 focus:outline-none resize-none"
                                    />
                                    <label className="flex items-center gap-2 text-campus-300 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.available}
                                            onChange={(e) =>
                                                setForm({ ...form, available: e.target.checked })
                                            }
                                            className="w-4 h-4 rounded accent-gold-500"
                                        />
                                        Available for ordering
                                    </label>
                                </div>

                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={resetForm}
                                        className="flex-1 px-4 py-3 bg-campus-700 text-campus-300 rounded-xl hover:bg-campus-600 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={saving}
                                        className="flex-1 btn-gold py-3"
                                    >
                                        {saving
                                            ? "Saving..."
                                            : editItem
                                                ? "Update"
                                                : "Add Item"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Menu Items Table ── */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-gold-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-20 text-campus-500">
                            <div className="text-5xl mb-4">
                                {items.length === 0 ? "🍽️" : "🔍"}
                            </div>
                            <p>
                                {items.length === 0
                                    ? "No menu items yet. Add your first item!"
                                    : "No items match your current filters."}
                            </p>
                            {items.length > 0 && (
                                <button
                                    onClick={() => {
                                        setCategoryFilter("all");
                                        setAvailabilityFilter("all");
                                    }}
                                    className="mt-3 text-gold-400 hover:text-gold-300 text-sm font-medium"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3 animate-fade-in">
                            {/* Desktop Table Header */}
                            <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold text-campus-500 uppercase">
                                <div className="col-span-3">Item</div>
                                <div className="col-span-2">Category</div>
                                <div className="col-span-1">Price</div>
                                <div className="col-span-1">Qty</div>
                                <div className="col-span-1">Prep</div>
                                <div className="col-span-1">Status</div>
                                <div className="col-span-3 text-right">Actions</div>
                            </div>

                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-campus-800/50 border border-campus-700 rounded-xl p-4 lg:p-5 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center"
                                >
                                    {/* Name & Description */}
                                    <div className="col-span-3 mb-2 lg:mb-0">
                                        <h4 className="font-semibold text-white">
                                            {item.name}
                                        </h4>
                                        {item.description && (
                                            <p className="text-xs text-campus-500 truncate">
                                                {item.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Category */}
                                    <div className="col-span-2 mb-2 lg:mb-0">
                                        <span className="px-3 py-1 bg-campus-700 text-campus-300 text-xs rounded-full capitalize">
                                            {item.category}
                                        </span>
                                    </div>

                                    {/* Price */}
                                    <div className="col-span-1 text-gold-400 font-bold mb-2 lg:mb-0">
                                        ₹{item.price}
                                    </div>

                                    {/* Quantity — Inline Editable */}
                                    <div className="col-span-1 mb-2 lg:mb-0">
                                        {editingQuantity === item.id ? (
                                            <input
                                                type="number"
                                                value={tempQuantity}
                                                onChange={(e) => setTempQuantity(e.target.value)}
                                                onBlur={() => saveQuantity(item)}
                                                onKeyDown={(e) => handleQuantityKeyDown(e, item)}
                                                min={0}
                                                autoFocus
                                                className="w-16 px-2 py-1 rounded-lg bg-campus-700 border border-gold-400 text-white text-sm focus:outline-none"
                                            />
                                        ) : (
                                            <button
                                                onClick={() => startQuantityEdit(item)}
                                                className={`px-2 py-1 rounded-lg text-sm font-medium transition-all hover:bg-campus-700 ${item.quantity === 0
                                                        ? "text-red-400"
                                                        : "text-campus-300"
                                                    }`}
                                                title="Click to edit quantity"
                                            >
                                                {item.quantity}
                                                <span className="ml-1 text-campus-600 text-xs">
                                                    ✎
                                                </span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Prep Time */}
                                    <div className="col-span-1 text-campus-300 text-sm mb-2 lg:mb-0">
                                        {item.preparationTime
                                            ? `${item.preparationTime}m`
                                            : "—"}
                                    </div>

                                    {/* Availability Status */}
                                    <div className="col-span-1 mb-3 lg:mb-0">
                                        <button
                                            onClick={() => toggleAvailability(item)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${item.available && item.quantity > 0
                                                    ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                }`}
                                        >
                                            {item.available && item.quantity > 0
                                                ? "✓ Available"
                                                : "✗ Unavailable"}
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-3 flex gap-2 justify-end">
                                        <button
                                            onClick={() => openEdit(item)}
                                            className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-all"
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            onClick={() => deleteItem(item.id)}
                                            className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-all"
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminGuard>
    );
}
