"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface KeyRatioBadgeProps {
  status: "good" | "warn" | "poor";
  label?: string;
  className?: string;
}

export default function KeyRatioBadge({ status, label, className }: KeyRatioBadgeProps) {
  const statusConfig = {
    good: {
      bg: "bg-[var(--ratio-good-bg)]",
      text: "text-[var(--ratio-good-text)]",
      label: "Good",
    },
    warn: {
      bg: "bg-[var(--ratio-warn-bg)]",
      text: "text-[var(--ratio-warn-text)]",
      label: "Warning",
    },
    poor: {
      bg: "bg-[var(--ratio-poor-bg)]",
      text: "text-[var(--ratio-poor-text)]",
      label: "Poor",
    },
  };

  const config = statusConfig[status] || statusConfig.warn;
  const displayLabel = label || config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase shadow-[var(--shadow-sm)] border border-black/5",
        config.bg,
        config.text,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
