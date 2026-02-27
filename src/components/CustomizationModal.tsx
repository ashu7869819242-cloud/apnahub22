"use client";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MenuItem, MenuItemOption, SelectedOption } from "@/types";

interface CustomizationModalProps {
    item: MenuItem;
    isOpen: boolean;
    onClose: () => void;
    onAdd: (selectedOptions: SelectedOption[], subtotal: number) => void;
}

export default function CustomizationModal({ item, isOpen, onClose, onAdd }: CustomizationModalProps) {
    const [selections, setSelections] = useState<Record<string, string[]>>({});

    // Initialize selections with required defaults if single-choice
    useMemo(() => {
        if (!item.customizations) return;
        const initial: Record<string, string[]> = {};
        item.customizations.forEach(cust => {
            if (cust.type === "single" && cust.required && cust.options.length > 0) {
                initial[cust.id] = [cust.options[0].id];
            } else {
                initial[cust.id] = [];
            }
        });
        setSelections(initial);
    }, [item, isOpen]);

    const handleSelect = (customizationId: string, optionId: string, type: "single" | "multiple") => {
        setSelections(prev => {
            const current = prev[customizationId] || [];
            if (type === "single") {
                return { ...prev, [customizationId]: [optionId] };
            } else {
                if (current.includes(optionId)) {
                    return { ...prev, [customizationId]: current.filter(id => id !== optionId) };
                } else {
                    return { ...prev, [customizationId]: [...current, optionId] };
                }
            }
        });
    };

    const isReady = useMemo(() => {
        if (!item.customizations) return true;
        return item.customizations.every(cust => {
            if (!cust.required) return true;
            return selections[cust.id]?.length > 0;
        });
    }, [item, selections]);

    const totalExtra = useMemo(() => {
        if (!item.customizations) return 0;
        let extra = 0;
        item.customizations.forEach(cust => {
            const selectedIds = selections[cust.id] || [];
            selectedIds.forEach(oid => {
                const opt = cust.options.find(o => o.id === oid);
                if (opt) extra += opt.price;
            });
        });
        return extra;
    }, [item, selections]);

    const handleConfirm = () => {
        if (!isReady) return;
        const selectedOptions: SelectedOption[] = [];
        item.customizations?.forEach(cust => {
            const selectedIds = selections[cust.id] || [];
            selectedIds.forEach(oid => {
                const opt = cust.options.find(o => o.id === oid);
                if (opt) {
                    selectedOptions.push({
                        customizationId: cust.id,
                        customizationTitle: cust.title,
                        optionId: opt.id,
                        optionName: opt.name,
                        price: opt.price
                    });
                }
            });
        });
        onAdd(selectedOptions, item.price + totalExtra);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-lg bg-zayko-800 border-t sm:border border-zayko-700 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-zayko-700 flex items-center justify-between bg-zayko-800/50 sticky top-0 z-10 backdrop-blur-md">
                            <div>
                                <h3 className="text-lg font-display font-bold text-white">{item.name}</h3>
                                <p className="text-xs text-zayko-400">Customize your order</p>
                            </div>
                            <button onClick={onClose} className="p-2 text-zayko-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        {/* Options List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {item.customizations?.map(cust => (
                                <div key={cust.id} className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                            {cust.title}
                                            {cust.required && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">Required</span>}
                                        </h4>
                                        <p className="text-[10px] text-zayko-500">{cust.type === "single" ? "Select one" : "Select multiple"}</p>
                                    </div>

                                    <div className="grid gap-2">
                                        {cust.options.map(opt => {
                                            const isSelected = selections[cust.id]?.includes(opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleSelect(cust.id, opt.id, cust.type)}
                                                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all duration-200 ${isSelected
                                                            ? "bg-gold-400/10 border-gold-400/50 text-gold-400 scale-[1.01]"
                                                            : "bg-white/5 border-transparent text-zayko-300 hover:bg-white/10"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-gold-400 bg-gold-400" : "border-zayko-500"
                                                            }`}>
                                                            {isSelected && <span className="text-zayko-900 text-[10px] font-bold">✓</span>}
                                                        </div>
                                                        <span className="text-sm font-medium">{opt.name}</span>
                                                    </div>
                                                    {opt.price > 0 && <span className="text-xs font-bold">+₹{opt.price}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-zayko-700 bg-zayko-800/50 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm text-zayko-400 font-medium">Subtotal</span>
                                <span className="text-xl font-display font-bold text-white">₹{item.price + totalExtra}</span>
                            </div>
                            <button
                                onClick={handleConfirm}
                                disabled={!isReady}
                                className={`w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg ${isReady
                                        ? "bg-gradient-to-r from-gold-400 to-gold-500 text-zayko-900 hover:shadow-gold-400/20"
                                        : "bg-zayko-700 text-zayko-500 cursor-not-allowed"
                                    }`}
                            >
                                {isReady ? "Add to Cart 🛒" : "Please select required options"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
