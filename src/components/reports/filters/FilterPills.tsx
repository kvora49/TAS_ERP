"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface PillOption {
  id: string;
  label: string;
  badgeClass?: string;
}

interface FilterPillsProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: PillOption[];
  className?: string;
  size?: "sm" | "xs";
}

export default function FilterPills({
  label,
  value,
  onChange,
  options,
  className,
  size = "xs",
}: FilterPillsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0">
          {label}
        </span>
      )}
      <div className={cn("inline-flex items-center bg-[var(--page-bg)] p-0.5 rounded-lg border border-[var(--border)]", className)}>
        {options.map((opt) => {
          const isActive = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-md font-medium transition-all cursor-pointer select-none whitespace-nowrap",
                size === "xs" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
                isActive
                  ? opt.badgeClass || "bg-[var(--primary)] text-white shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]/50"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
