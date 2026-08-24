"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Search, ExternalLink, FileSpreadsheet, FileText,
  X, ArrowRight, Layers, Tag
} from "lucide-react";
import { fmtINR, fmtDate, exportSingleLedgerExcel } from "@/lib/report-export";
import { exportSingleLedgerPDF } from "@/lib/pdf/report-pdf-generator";
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

export interface InlineDrillDownPanelProps {
  id: string;
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
  onClose: () => void;
}

export default function InlineDrillDownPanel({
  title,
  subtitle,
  periodText,
  totalAmount,
  amountType = "neutral",
  categories,
  items = [],
  moduleLink,
  onClose,
}: InlineDrillDownPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      (item.doc_number && item.doc_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.party_name && item.party_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === "all" ||
      (item.category && item.category.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  const filteredSum = filteredItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);

  const handleExportExcel = () => {
    exportSingleLedgerExcel(title, filteredItems);
  };

  const handleExportPDF = () => {
    exportSingleLedgerPDF(title, filteredItems, {
      reportSubtitle: subtitle,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="overflow-hidden bg-[var(--table-header-bg)] border-y border-[var(--border)] my-1 shadow-inner"
    >
      <div className="p-4 space-y-3">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded">
                Drill Down Details
              </span>
              {periodText && (
                <span className="text-[11px] text-[var(--text-faint)]">
                  {periodText}
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mt-1">
              {title}
            </h4>
            {subtitle && (
              <p className="text-[11px] text-[var(--text-muted)]">
                {subtitle}
              </p>
            )}
          </div>

          {/* Action Buttons: Export Excel, Export PDF, Open Module, Close */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportPDF}
              title="Download structured PDF statement"
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-bold border border-rose-500/20 bg-[var(--card-bg)] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <FileText size={12} />
              <span>Export (PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              title="Download Excel spreadsheet"
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-bold border border-emerald-500/20 bg-[var(--card-bg)] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={12} />
              <span>Export (Excel)</span>
            </button>

            {moduleLink && (
              <Link
                href={moduleLink.href}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-bold border border-[var(--primary)] text-[var(--primary)] bg-[var(--card-bg)] hover:bg-[var(--primary-light)] transition-colors"
              >
                <span>{moduleLink.label}</span>
                <ExternalLink size={11} />
              </Link>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] transition-colors cursor-pointer"
              title="Collapse section"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Categories Pills & Search row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Subcategory Filter Pills */}
          {categories && categories.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer",
                  selectedCategory === "all"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text-body)]"
                )}
              >
                All ({items.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5",
                    selectedCategory.toLowerCase() === cat.name.toLowerCase()
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
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium">
              <Tag size={13} className="text-[var(--text-faint)]" />
              <span>Granular Transaction Register</span>
            </div>
          )}

          {/* Search Input */}
          <div className="relative min-w-[240px] max-w-xs">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice, party, or note..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
            />
          </div>
        </div>

        {/* Ledger Table Container */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              <Layers size={22} className="mx-auto mb-1.5 opacity-40" />
              <p className="font-semibold">No transactions found</p>
              <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
                No matching records for the current filter or search criteria.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider sticky top-0 z-10">
                  <th className="py-2.5 px-3 whitespace-nowrap">Doc / Invoice</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3">Party Name</th>
                  <th className="py-2.5 px-3">Category / Note</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Amount (₹)</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[var(--table-row-hover)] transition-colors h-9"
                  >
                    <td className="py-2 px-3 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                      {item.doc_number}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-faint)] whitespace-nowrap font-medium text-[11px]">
                      {fmtDate(item.date)}
                    </td>
                    <td className="py-2 px-3 font-semibold text-[var(--text-body)] max-w-[200px] truncate">
                      {item.party_name || "—"}
                    </td>
                    <td className="py-2 px-3 max-w-[240px] truncate text-[11px] text-[var(--text-muted)]">
                      <div className="flex items-center gap-1.5 truncate">
                        {item.badge && (
                          <span
                            className={cn(
                              "text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded shrink-0",
                              item.badge_color === "emerald"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : item.badge_color === "rose"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : item.badge_color === "amber"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                        <span className="truncate">{item.description || item.category || "—"}</span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        "py-2 px-3 text-right font-mono font-bold whitespace-nowrap",
                        amountType === "positive"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : amountType === "negative"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-[var(--text-primary)]"
                      )}
                    >
                      {fmtINR(item.amount)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {item.view_url && (
                        <Link
                          href={item.view_url}
                          title="Open voucher in ERP"
                          className="inline-flex p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] transition-colors"
                        >
                          <ArrowRight size={13} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info: Total items & Filtered sum */}
        <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] px-1 pt-1">
          <span>Showing {filteredItems.length} of {items.length} records</span>
          <div className="flex items-center gap-2">
            <span>Filtered Total:</span>
            <span className="font-mono text-sm text-[var(--text-primary)]">
              {fmtINR(filteredSum)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
