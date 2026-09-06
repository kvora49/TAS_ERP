"use client";

import { AlertTriangle, CheckCircle2, Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Props {
  pendingValue: number;
  clearedValue: number;
  bouncedValue: number;
}

export function ChequeStatsBar({ pendingValue, clearedValue, bouncedValue }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 sm:p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
          <Landmark className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">Outstanding PDC / Pending</span>
          <span className="text-xl font-bold font-mono text-[var(--text-primary)] truncate">
            {formatCurrency(pendingValue)}
          </span>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 sm:p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">Total Value Cleared</span>
          <span className="text-xl font-bold font-mono text-[var(--text-primary)] truncate">
            {formatCurrency(clearedValue)}
          </span>
        </div>
      </div>

      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 sm:p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
        <div className="p-3 bg-red-500/10 text-red-500 rounded-lg shrink-0">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider truncate">Total Value Bounced</span>
          <span className="text-xl font-bold font-mono text-red-500 truncate">
            {formatCurrency(bouncedValue)}
          </span>
        </div>
      </div>
    </div>
  );
}
