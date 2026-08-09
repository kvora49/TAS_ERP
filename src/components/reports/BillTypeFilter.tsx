"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type BillType = "all" | "kacha" | "pakka";

interface BillTypeFilterProps {
  value: BillType;
  onChange: (value: BillType) => void;
  className?: string;
  size?: "sm" | "md";
}

export default function BillTypeFilter({
  value,
  onChange,
  className,
  size = "sm",
}: BillTypeFilterProps) {
  const options: { id: BillType; label: string }[] = [
    { id: "all", label: "Combined" },
    { id: "kacha", label: "Kaacha" },
    { id: "pakka", label: "Pakka" },
  ];

  return (
    <div className={cn("inline-flex items-center bg-[var(--page-bg)] p-0.5 rounded-lg border border-[var(--border)]", className)}>
      {options.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-md font-bold transition-all cursor-pointer select-none",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
              isActive
                ? opt.id === "pakka"
                  ? "bg-blue-600 text-white shadow-xs"
                  : opt.id === "kacha"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]/50"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
