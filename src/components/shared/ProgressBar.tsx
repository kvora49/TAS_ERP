"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  total: number;
  showText?: boolean;
}

export default function ProgressBar({ value, total, showText = true }: ProgressBarProps) {
  const safeTotal = total <= 0 ? 1 : total;
  const percentage = Math.min(Math.max(Math.round((value / safeTotal) * 100), 0), 100);

  let fillClass = "bg-[#E5E7EB]";
  if (percentage === 100) {
    fillClass = "bg-[#15803D]";
  } else if (percentage > 0) {
    fillClass = "bg-[#6366F1]";
  }

  return (
    <div className="flex flex-col gap-1 w-full min-w-[120px]">
      {showText && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#374151]">
            {value} <span className="text-[#94A3B8] text-xs">/ {total} ({percentage}%)</span>
          </span>
        </div>
      )}
      <div className="h-1.5 rounded-full w-full bg-[#E5E7EB] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", fillClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
