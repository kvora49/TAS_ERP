"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtINR } from "@/lib/report-export";

export interface ReportKPICardProps {
  label: string;
  value: number | string;
  subLabel?: string;
  icon?: React.ReactNode;
  /** 'currency' shows ₹ formatting, 'number' shows plain number, 'text' shows raw */
  format?: "currency" | "number" | "text";
  /** Accent color class for left border (e.g. "emerald", "rose", "blue", "amber", "violet", "indigo") */
  color?: "emerald" | "rose" | "blue" | "amber" | "violet" | "indigo" | "slate" | "orange";
  /** Change vs last period — positive = up, negative = down */
  vsLastPeriod?: number | null;
  vsLabel?: string;
  className?: string;
}

const COLOR_MAP: Record<string, { border: string; icon: string; badge: string }> = {
  emerald: {
    border: "border-l-emerald-500",
    icon: "bg-emerald-500/10 text-emerald-500",
    badge: "text-emerald-600",
  },
  rose: {
    border: "border-l-rose-500",
    icon: "bg-rose-500/10 text-rose-500",
    badge: "text-rose-600",
  },
  blue: {
    border: "border-l-blue-500",
    icon: "bg-blue-500/10 text-blue-500",
    badge: "text-blue-600",
  },
  amber: {
    border: "border-l-amber-500",
    icon: "bg-amber-500/10 text-amber-500",
    badge: "text-amber-600",
  },
  violet: {
    border: "border-l-violet-500",
    icon: "bg-violet-500/10 text-violet-500",
    badge: "text-violet-600",
  },
  indigo: {
    border: "border-l-indigo-500",
    icon: "bg-indigo-500/10 text-indigo-500",
    badge: "text-indigo-600",
  },
  slate: {
    border: "border-l-slate-400",
    icon: "bg-slate-500/10 text-slate-500",
    badge: "text-slate-500",
  },
  orange: {
    border: "border-l-orange-500",
    icon: "bg-orange-500/10 text-orange-500",
    badge: "text-orange-600",
  },
};

export default function ReportKPICard({
  label,
  value,
  subLabel,
  icon,
  format = "currency",
  color = "indigo",
  vsLastPeriod,
  vsLabel = "vs Last Period",
  className,
}: ReportKPICardProps) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.indigo;

  const displayValue = () => {
    if (format === "currency") {
      return fmtINR(typeof value === "number" ? value : parseFloat(String(value)) || 0);
    }
    if (format === "number") {
      return new Intl.NumberFormat("en-IN").format(
        typeof value === "number" ? value : parseFloat(String(value)) || 0
      );
    }
    return String(value ?? "—");
  };

  const trend =
    vsLastPeriod === null || vsLastPeriod === undefined
      ? null
      : vsLastPeriod > 0
      ? "up"
      : vsLastPeriod < 0
      ? "down"
      : "flat";

  return (
    <div
      className={cn(
        "bg-[var(--card-bg)] border border-[var(--border)] border-l-4 rounded-xl p-4 shadow-[var(--shadow-sm)] flex flex-col gap-2",
        colors.border,
        className
      )}
    >
      {/* Icon + Label */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-none">
          {label}
        </span>
        {icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors.icon)}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <p className="text-xl font-extrabold text-[var(--text-primary)] leading-none">{displayValue()}</p>

      {/* Sub-label + vs badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {subLabel && (
          <span className="text-[10px] text-[var(--text-faint)] font-medium">{subLabel}</span>
        )}
        {trend !== null && vsLastPeriod !== undefined && vsLastPeriod !== null && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold",
              trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : "text-[var(--text-faint)]"
            )}
          >
            {trend === "up" ? (
              <TrendingUp size={10} />
            ) : trend === "down" ? (
              <TrendingDown size={10} />
            ) : (
              <Minus size={10} />
            )}
            <span>
              {trend === "up" ? "+" : ""}
              {Math.abs(vsLastPeriod).toFixed(2)}% {vsLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
