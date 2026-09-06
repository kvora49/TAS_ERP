"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  FileSpreadsheet,
  Printer,
  Mail,
  SlidersHorizontal,
  Info,
  ChevronRight,
  X,
  Calendar,
} from "lucide-react";
import { DATE_PRESETS, DatePreset, getPresetDates, printReport, fmtDate } from "@/lib/report-export";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { NavItem } from "@/lib/moduleNav";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportFilters {
  from: string;
  to: string;
  preset: DatePreset | "custom";
  [key: string]: any;
}

export interface ReportShellProps {
  title: string;
  infoTooltip?: string;
  breadcrumbs: string[];
  subNavItems?: NavItem[];
  /** Called when Apply is clicked — receives current filter state */
  onApply: (filters: ReportFilters) => void;
  /** Called by Export PDF button (uses formal jsPDF generator if provided) */
  onExportPDF?: () => void;
  /** Called by Export Excel button */
  onExportExcel?: () => void;
  /** Called by Email/Share button */
  onEmail?: () => void;
  /** Extra filter controls (dropdowns, selects) rendered inside the filter bar */
  extraFilters?: React.ReactNode;
  /** Main page content */
  children: React.ReactNode;
  /** Initial from date (defaults to FY start) */
  defaultFrom?: string;
  /** Initial to date (defaults to today) */
  defaultTo?: string;
}

// ─── Helper — today & FY start ────────────────────────────────────────────────

function fyStart(): string {
  const today = new Date();
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-04-01`;
}
const today = () => new Date().toISOString().split("T")[0];

// ─── ReportShell ─────────────────────────────────────────────────────────────

export default function ReportShell({
  title,
  infoTooltip,
  breadcrumbs,
  subNavItems = [],
  onApply,
  onExportPDF,
  onExportExcel,
  onEmail,
  extraFilters,
  children,
  defaultFrom,
  defaultTo,
}: ReportShellProps) {
  const user = useAppStore((s) => s.user);
  const [showInfo, setShowInfo] = useState(false);
  // Default to OFF / collapsed per user requirement
  const [showFilters, setShowFilters] = useState(false);
  const [preset, setPreset] = useState<DatePreset | "custom">("this_fy");
  const [from, setFrom] = useState(defaultFrom ?? fyStart());
  const [to, setTo] = useState(defaultTo ?? today());

  const handlePreset = useCallback(
    (p: DatePreset) => {
      const dates = getPresetDates(p);
      setPreset(p);
      setFrom(dates.from);
      setTo(dates.to);
    },
    []
  );

  const handleApply = useCallback(() => {
    onApply({ from, to, preset });
  }, [from, to, preset, onApply]);

  const handleClear = useCallback(() => {
    const p: DatePreset = "this_fy";
    const dates = getPresetDates(p);
    setPreset(p);
    setFrom(dates.from);
    setTo(dates.to);
    onApply({ from: dates.from, to: dates.to, preset: p });
  }, [onApply]);

  const isFilterActive = preset !== "this_fy";

  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col min-h-full bg-[var(--page-bg)]">
      {/* ── Top Header Bar ── */}
      <div className="bg-[var(--card-bg)] border-b border-[var(--border)] px-3 sm:px-6 pt-3 sm:pt-4 pb-0 print:hidden space-y-3 md:space-y-0">
        {/* Title row + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 md:pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{title}</h1>
            {infoTooltip && (
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowInfo(true)}
                  onMouseLeave={() => setShowInfo(false)}
                  className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
                >
                  <Info size={15} />
                </button>
                {showInfo && (
                  <div className="absolute left-6 top-0 z-50 w-64 p-3 bg-[var(--card-bg)] text-[var(--text-primary)] text-xs rounded-lg shadow-xl border border-[var(--border)] leading-relaxed">
                    {infoTooltip}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <ActionBtn
              icon={<FileText size={14} className="text-red-500" />}
              label="Export (PDF)"
              onClick={onExportPDF || printReport}
            />
            {onExportExcel && (
              <ActionBtn
                icon={<FileSpreadsheet size={14} className="text-green-600" />}
                label="Export (Excel)"
                onClick={onExportExcel}
              />
            )}
            <ActionBtn
              icon={<Printer size={14} className="text-[var(--text-muted)]" />}
              label="Print"
              onClick={printReport}
            />
            {onEmail && (
              <ActionBtn
                icon={<Mail size={14} className="text-blue-500" />}
                label="Email / Share"
                onClick={onEmail}
              />
            )}
            <button
              type="button"
              onClick={() => setShowFilters((p) => !p)}
              className={cn(
                "relative flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                showFilters
                  ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]"
                  : "bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary-light)]/80"
              )}
            >
              <SlidersHorizontal size={13} />
              <span>Filters</span>
              {isFilterActive && (
                <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[var(--card-bg)]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Printable Header Block (Only visible on Print / PDF) ── */}
      <div className="hidden print:block mb-6 border-b border-gray-300 px-6 pt-4 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-black">TAS ERP</h1>
            <h2 className="text-base font-bold text-gray-800 mt-0.5">{title}</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Period: {fmtDate(from)} to {fmtDate(to)}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p className="font-semibold text-gray-700">Financial Statement</p>
            <p>Generated on: {generatedAt}</p>
            <p>Generated by: {user?.fullName ?? "Administrator"}</p>
          </div>
        </div>
      </div>

      {/* ── Structured Collapsible Filter Drawer ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden bg-[var(--card-bg)] border-b border-[var(--border)] shadow-[var(--shadow-sm)] print:hidden"
          >
            <div className="px-3.5 sm:px-6 py-4 space-y-3.5">
              {/* Row 1: Period presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                    Date Period Preset
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-faint)]">
                    {fmtDate(from)} – {fmtDate(to)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => handlePreset(p.value)}
                      className={cn(
                        "h-7 px-3 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer",
                        preset === p.value
                          ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs"
                          : "bg-[var(--card-bg)] text-[var(--text-body)] border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Custom Date Inputs */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 max-w-lg">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }}
                      className="w-full h-9 pl-8 pr-2.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mb-1">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => { setTo(e.target.value); setPreset("custom"); }}
                      className="w-full h-9 pl-8 pr-2.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Extra Filters Slot */}
              {extraFilters && (
                <div className="pt-2 border-t border-[var(--border-light)]">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Filter Options
                  </span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {extraFilters}
                  </div>
                </div>
              )}

              {/* Row 4: Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-body)] border border-[var(--border)] hover:border-[var(--input-border)] bg-transparent transition-all cursor-pointer"
                >
                  <X size={13} /> Reset
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex items-center justify-center gap-1.5 h-8 px-5 rounded-lg text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white shadow-xs transition-all cursor-pointer"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Content ── */}
      <div className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6">
        {children}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--border)] px-4 sm:px-6 py-3 flex items-center justify-between text-[10px] text-[var(--text-faint)] font-medium print:block">
        <span>Report generated on: {generatedAt}</span>
        <span>Generated by: {user?.fullName ?? "—"}</span>
      </div>
    </div>
  );
}

// ─── ActionBtn helper ─────────────────────────────────────────────────────────

function ActionBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] text-xs font-semibold text-[var(--text-body)] transition-all cursor-pointer"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
