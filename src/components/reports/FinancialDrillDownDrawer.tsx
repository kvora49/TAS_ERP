"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ExternalLink, Search, FileText, ArrowRight,
  TrendingUp, TrendingDown, DollarSign, Building2,
  Calendar, Layers, Filter
} from "lucide-react";
import { fmtINR, fmtDate } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface DrillDownItem {
  id: string;
  doc_number: string;
  date: string;
  party_name?: string;
  description?: string;
  category?: string;
  amount: number;
  view_url?: string;
  badge?: string;
  badge_color?: "emerald" | "rose" | "blue" | "amber" | "slate";
}

export interface DrillDownCategory {
  name: string;
  amount: number;
  count: number;
}

export interface DrillDownState {
  isOpen: boolean;
  reportName: string;
  title: string;
  subtitle?: string;
  periodText?: string;
  totalAmount: number;
  amountType?: "positive" | "negative" | "neutral";
  categories?: DrillDownCategory[];
  items?: DrillDownItem[];
  moduleLink?: {
    label: string;
    href: string;
  };
}

interface FinancialDrillDownDrawerProps {
  state: DrillDownState;
  onClose: () => void;
}

export default function FinancialDrillDownDrawer({
  state,
  onClose,
}: FinancialDrillDownDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredItems = (state.items ?? []).filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.doc_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.party_name && item.party_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <AnimatePresence>
      {state.isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity"
          />

          {/* Slide-over Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[var(--card-bg)] border-l border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded">
                    {state.reportName}
                  </span>
                  {state.periodText && (
                    <span className="text-[11px] text-[var(--text-faint)] flex items-center gap-1">
                      <Calendar size={11} />
                      {state.periodText}
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-extrabold text-[var(--text-primary)] mt-1.5 leading-tight">
                  {state.title}
                </h2>
                {state.subtitle && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {state.subtitle}
                  </p>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Total Metric Banner */}
            <div className="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--card-bg)] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Total Value
                </span>
                <span
                  className={cn(
                    "text-2xl font-extrabold font-mono",
                    state.amountType === "positive"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : state.amountType === "negative"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-[var(--text-primary)]"
                  )}
                >
                  {fmtINR(state.totalAmount)}
                </span>
              </div>

              {state.moduleLink && (
                <Link
                  href={state.moduleLink.href}
                  className="flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] hover:opacity-90 px-3.5 py-2 rounded-lg transition-all"
                >
                  {state.moduleLink.label}
                  <ExternalLink size={13} />
                </Link>
              )}
            </div>

            {/* Subcategories Pills if provided */}
            {state.categories && state.categories.length > 0 && (
              <div className="px-6 py-3 border-b border-[var(--border-light)] bg-[var(--table-header-bg)] flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer",
                    selectedCategory === "all"
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-body)]"
                  )}
                >
                  All ({state.items?.length ?? 0})
                </button>
                {state.categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5",
                      selectedCategory === cat.name
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-body)]"
                    )}
                  >
                    <span>{cat.name}</span>
                    <span className="opacity-75 font-mono text-[10px]">
                      ({fmtINR(cat.amount)})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="px-6 py-3 border-b border-[var(--border-light)] bg-[var(--card-bg)]">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by invoice no, party, or description..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>
            </div>

            {/* Underlying Transaction List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-light)]">
              {filteredItems.length === 0 ? (
                <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                  <Layers size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="font-bold">No transactions found</p>
                  <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
                    No underlying records match the selected filter.
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 hover:bg-[var(--table-row-hover)] transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                          {item.doc_number}
                        </span>
                        {item.badge && (
                          <span
                            className={cn(
                              "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded",
                              item.badge_color === "emerald"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : item.badge_color === "rose"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : item.badge_color === "amber"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-[var(--table-header-bg)] text-[var(--text-muted)]"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--text-faint)]">
                          {fmtDate(item.date)}
                        </span>
                      </div>

                      {item.party_name && (
                        <p className="text-xs text-[var(--text-body)] font-semibold truncate mt-0.5">
                          {item.party_name}
                        </p>
                      )}

                      {item.description && (
                        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <span className="font-mono font-extrabold text-sm text-[var(--text-primary)] block">
                          {fmtINR(item.amount)}
                        </span>
                      </div>

                      {item.view_url && (
                        <Link
                          href={item.view_url}
                          title="Open record in ERP"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors cursor-pointer"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer summary */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--table-header-bg)] flex items-center justify-between text-xs font-bold text-[var(--text-muted)]">
              <span>Showing {filteredItems.length} records</span>
              <span className="font-mono text-[var(--text-primary)]">
                Sum: {fmtINR(filteredItems.reduce((acc, i) => acc + (i.amount || 0), 0))}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
