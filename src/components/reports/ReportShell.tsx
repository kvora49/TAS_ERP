"use client";

import React, { useState, useCallback } from "react";
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
import { DATE_PRESETS, DatePreset, getPresetDates, printReport } from "@/lib/report-export";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

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
  /** Called when Apply is clicked — receives current filter state */
  onApply: (filters: ReportFilters) => void;
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
  onApply,
  onExportExcel,
  onEmail,
  extraFilters,
  children,
  defaultFrom,
  defaultTo,
}: ReportShellProps) {
  const user = useAppStore((s) => s.user);
  const [showInfo, setShowInfo] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
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
      <div className="bg-[var(--card-bg)] border-b border-[var(--border)] px-6 pt-5 pb-0 print:hidden">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium mb-2">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight size={12} className="text-[var(--text-faint)]" />}
              <span className={idx === breadcrumbs.length - 1 ? "text-[var(--text-secondary)] font-semibold" : ""}>
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Title row + actions */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{title}</h1>
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
                  <div className="absolute left-6 top-0 z-50 w-64 p-3 bg-[#0F1629] text-white text-xs rounded-lg shadow-xl border border-[#1E293B] leading-relaxed">
                    {infoTooltip}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <ActionBtn
              icon={<FileText size={14} className="text-red-500" />}
              label="Export (PDF)"
              onClick={printReport}
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
                "flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                showFilters
                  ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]"
                  : "bg-[var(--primary-light)] text-[var(--primary)] hover:bg-[var(--primary-light)]"
              )}
            >
              <SlidersHorizontal size={13} />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      {showFilters && (
        <div className="bg-[var(--card-bg)] border-b border-[var(--border)] px-6 py-3 flex flex-wrap items-center gap-3 print:hidden">
          {/* Preset chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide mr-1">Period</span>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePreset(p.value)}
                className={cn(
                  "h-7 px-2.5 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                  preset === p.value
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "bg-transparent text-[var(--text-body)] border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">From</span>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                type="date"
                value={from}
                onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }}
                className="h-8 pl-7 pr-2.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent"
              />
            </div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">To</span>
            <div className="relative">
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                type="date"
                value={to}
                onChange={(e) => { setTo(e.target.value); setPreset("custom"); }}
                className="h-8 pl-7 pr-2.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Extra filters slot */}
          {extraFilters}

          {/* Apply + Clear */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-body)] border border-[var(--border)] hover:border-[var(--input-border)] bg-transparent transition-all cursor-pointer"
            >
              <X size={12} /> Clear
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-8 px-4 rounded-lg text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white transition-all cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* ── Page Content ── */}
      <div className="flex-1 p-6 space-y-6">
        {children}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--border)] px-6 py-3 flex items-center justify-between text-[10px] text-[var(--text-faint)] font-medium print:block">
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
