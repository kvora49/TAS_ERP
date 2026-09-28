"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Landmark, Clock, CalendarClock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ChequeStatsBarProps {
  pendingValue: number;
  pendingCount?: number;
  clearedValue: number;
  clearedCount?: number;
  bouncedValue: number;
  bouncedCount?: number;
  dueThisWeekValue?: number;
  dueThisWeekCount?: number;
  staleCount?: number;
  onFilterMaturity?: (filter: string) => void;
  activeMaturity?: string;
}

export function ChequeStatsBar({
  pendingValue,
  pendingCount = 0,
  clearedValue,
  clearedCount = 0,
  bouncedValue,
  bouncedCount = 0,
  dueThisWeekValue = 0,
  dueThisWeekCount = 0,
  staleCount = 0,
  onFilterMaturity,
  activeMaturity,
}: ChequeStatsBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {/* 1. Pending / PDC in Hand */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--shadow-sm)] flex items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider truncate">
              Outstanding PDC
            </span>
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {pendingCount}
              </span>
            )}
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-[var(--text-primary)] truncate">
            {formatCurrency(pendingValue)}
          </div>
          <span className="text-[10px] text-[var(--text-faint)]">
            Awaiting bank presentation
          </span>
        </div>
        <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
          <Landmark className="h-5 w-5" />
        </div>
      </div>

      {/* 2. Due This Week (Maturity Tracker) */}
      <div
        onClick={() => onFilterMaturity && onFilterMaturity(activeMaturity === "due_7_days" ? "" : "due_7_days")}
        className={`bg-[var(--card-bg)] rounded-2xl border p-4 shadow-[var(--shadow-sm)] flex items-center justify-between gap-3 cursor-pointer transition-all ${
          activeMaturity === "due_7_days"
            ? "border-[var(--primary)] ring-2 ring-[var(--primary-light)]"
            : "border-[var(--border)] hover:border-[var(--primary)]"
        }`}
      >
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider truncate">
              Due In 7 Days
            </span>
            {dueThisWeekCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {dueThisWeekCount}
              </span>
            )}
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-blue-600 dark:text-blue-400 truncate">
            {formatCurrency(dueThisWeekValue)}
          </div>
          <span className="text-[10px] text-[var(--text-faint)]">
            Deposit to bank this week
          </span>
        </div>
        <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
          <CalendarClock className="h-5 w-5" />
        </div>
      </div>

      {/* 3. Cleared Realized */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--shadow-sm)] flex items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider truncate">
              Total Cleared
            </span>
            {clearedCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {clearedCount}
              </span>
            )}
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
            {formatCurrency(clearedValue)}
          </div>
          <span className="text-[10px] text-[var(--text-faint)]">
            Funds settled in bank
          </span>
        </div>
        <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      </div>

      {/* 4. Dishonored / Bounced / Stale */}
      <div
        onClick={() => onFilterMaturity && onFilterMaturity(activeMaturity === "stale" ? "" : "stale")}
        className={`bg-[var(--card-bg)] rounded-2xl border p-4 shadow-[var(--shadow-sm)] flex items-center justify-between gap-3 cursor-pointer transition-all ${
          activeMaturity === "stale"
            ? "border-red-500 ring-2 ring-red-500/20"
            : "border-[var(--border)] hover:border-red-500/50"
        }`}
      >
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-red-600 dark:text-red-400 font-bold uppercase tracking-wider truncate">
              Bounced / Stale
            </span>
            {staleCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                {staleCount} stale
              </span>
            )}
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-red-600 dark:text-red-400 truncate">
            {formatCurrency(bouncedValue)}
          </div>
          <span className="text-[10px] text-[var(--text-faint)]">
            {bouncedCount} bounced · {staleCount} {">"} 60 days
          </span>
        </div>
        <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
