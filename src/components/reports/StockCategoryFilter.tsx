"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type StockCategory = "all" | "finished_goods" | "raw_material" | "accessory";

interface StockCategoryFilterProps {
  value: StockCategory;
  onChange: (value: StockCategory) => void;
  className?: string;
  size?: "sm" | "md";
}

export default function StockCategoryFilter({
  value,
  onChange,
  className,
  size = "sm",
}: StockCategoryFilterProps) {
  const options: { id: StockCategory; label: string }[] = [
    { id: "all", label: "All Stock" },
    { id: "finished_goods", label: "Finished Goods" },
    { id: "raw_material", label: "Raw Materials" },
    { id: "accessory", label: "Accessories & Trims" },
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
                ? "bg-[var(--primary)] text-white shadow-xs"
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
