"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StageNode {
  id: string;
  name: string;
  status: "completed" | "in_progress" | "pending" | "skipped";
  date?: string | null;
  qty?: number | null;
}

interface StageProgressTrackerProps {
  stages: StageNode[];
}

export default function StageProgressTracker({ stages }: StageProgressTrackerProps) {
  return (
    <div className="relative mt-2 mb-6">
      {/* Background connector line */}
      <div className="absolute left-[8.33%] right-[8.33%] top-6 h-[2px] bg-[var(--border)] z-0" />

      {/* Done connector lines overlay */}
      <div className="absolute left-[8.33%] right-[8.33%] top-6 h-[2px] z-0 flex">
        {stages.slice(0, -1).map((stage, idx) => {
          const isDoneSegment =
            stage.status === "completed" &&
            (stages[idx + 1].status === "completed" || stages[idx + 1].status === "in_progress");
          const isActiveSegment = stage.status === "in_progress";

          return (
            <div
              key={idx}
              className={cn(
                "flex-1 h-[2px]",
                isDoneSegment && "bg-green-600",
                isActiveSegment && "border-t-2 border-dashed border-[var(--border)]"
              )}
            />
          );
        })}
      </div>

      <div className="flex items-start justify-between relative z-10">
        {stages.map((stage, idx) => {
          const stageNum = idx + 1;
          const isCompleted = stage.status === "completed";
          const isActive = stage.status === "in_progress";
          const isPending = stage.status === "pending" || stage.status === "skipped";

          return (
            <div key={stage.id} className="flex flex-col items-center flex-1">
              {/* Circle */}
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 select-none bg-[var(--card-bg)]",
                  isCompleted && "bg-emerald-500/10 border-[3px] border-emerald-600",
                  isActive && "border-[3px] border-[var(--primary)] text-[var(--primary)]",
                  isPending && "bg-[var(--page-bg)] border-2 border-[var(--input-border)] text-[var(--text-faint)]"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span>{stageNum}</span>
                )}
              </div>

              {/* Stage Name */}
              <span className="text-sm font-semibold text-[var(--text-primary)] text-center mt-2 px-1">
                {stage.name}
              </span>

              {/* Status Badge */}
              <span
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-wide",
                  isCompleted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  isActive && "bg-indigo-500/10 text-[var(--primary)]",
                  isPending && "bg-[var(--page-bg)] text-[var(--text-muted)]"
                )}
              >
                {stage.status === "in_progress" ? "In Progress" : stage.status}
              </span>

              {/* Date */}
              {stage.date && (
                <span className="text-[10px] text-[var(--text-faint)] text-center mt-1">
                  {stage.date}
                </span>
              )}

              {/* Qty */}
              {stage.qty !== undefined && stage.qty !== null && (
                <span className="text-xs text-[var(--text-muted)] text-center font-medium mt-0.5">
                  Qty: {stage.qty}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
