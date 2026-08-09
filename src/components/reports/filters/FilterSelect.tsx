"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterSelectProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "All",
  className,
  disabled = false,
}: FilterSelectProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {label && (
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0">
          {label}
        </span>
      )}
      <div className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "appearance-none bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-3 pr-7 h-8 text-xs transition-colors cursor-pointer disabled:opacity-50 max-w-[180px] sm:max-w-[220px] md:max-w-[260px] truncate",
            className
          )}
        >
          {placeholder && (
            <option value="" className="bg-[var(--card-bg)] text-[var(--text-primary)]">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>
    </div>
  );
}
