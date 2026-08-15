"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  total: number;
  showText?: boolean;
  className?: string;
  barHeight?: string;
}

export default function ProgressBar({
  value,
  total,
  showText = true,
  className,
  barHeight = "h-2",
}: ProgressBarProps) {
  const safeTotal = total <= 0 ? 1 : total;
  const percentage = Math.min(Math.max(Math.round((value / safeTotal) * 100), 0), 100);

  let fillClass = "bg-[var(--border)]";
  if (percentage === 100) {
    fillClass = "bg-emerald-500";
  } else if (percentage > 0) {
    fillClass = "bg-[var(--primary)]";
  }

  return (
    <div className={cn("flex flex-col gap-1.5 w-full min-w-[120px]", className)}>
      {showText && (
        <div className="flex items-center justify-between text-xs font-semibold select-none">
          <span className="text-[var(--text-primary)]">
            {value}{" "}
            <span className="text-[var(--text-muted)] text-[11px]">
              / {total} ({percentage}%)
            </span>
          </span>
        </div>
      )}
      <div className={cn("rounded-full w-full bg-[var(--border)] overflow-hidden", barHeight)}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", fillClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
