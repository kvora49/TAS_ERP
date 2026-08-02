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
    <div className="w-full mt-2 mb-6">
      {/* ========================================================================= */}
      {/* 1. MOBILE VIEW (< 768px): Vertical Stacked Stage Stepper (Zero Overlap) */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-0 relative py-1">
        {stages.map((stage, idx) => {
          const stageNum = idx + 1;
          const isCompleted = stage.status === "completed";
          const isActive = stage.status === "in_progress";
          const isPending = stage.status === "pending" || stage.status === "skipped";
          const isLast = idx === stages.length - 1;

          return (
            <div key={stage.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
              {/* Vertical connector line connecting nodes */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-5 top-10 bottom-0 w-[2px] z-0 transition-colors",
                    isCompleted ? "bg-emerald-600" : "bg-[var(--border)]"
                  )}
                />
              )}

              {/* Step Circle Node */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 z-10 transition-all bg-[var(--card-bg)] shadow-xs",
                  isCompleted && "bg-emerald-500/10 border-2 border-emerald-600 text-emerald-600 dark:text-emerald-400",
                  isActive && "border-2 border-[var(--primary)] text-[var(--primary)] ring-4 ring-[var(--primary)]/10 font-bold",
                  isPending && "bg-[var(--page-bg)] border-2 border-[var(--input-border)] text-[var(--text-faint)]"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span>{stageNum}</span>
                )}
              </div>

              {/* Stage Content Card */}
              <div className="flex-1 bg-[var(--page-bg)]/50 rounded-xl p-3 border border-[var(--border)] shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    Stage {stageNum} of {stages.length}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                      isCompleted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      isActive && "bg-indigo-500/10 text-[var(--primary)]",
                      isPending && "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                    )}
                  >
                    {stage.status === "in_progress" ? "In Progress" : stage.status}
                  </span>
                </div>

                <div className="text-sm font-bold text-[var(--text-primary)] mt-1">
                  {stage.name}
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border)]/50">
                  {stage.qty !== undefined && stage.qty !== null ? (
                    <span className="font-semibold text-[var(--text-body)]">
                      Qty: <span className="text-[var(--primary)] font-bold">{stage.qty}</span>
                    </span>
                  ) : (
                    <span>Qty: —</span>
                  )}

                  {stage.date && (
                    <span className="text-[11px] text-[var(--text-faint)]">{stage.date}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 2. TABLET / SMALL LAPTOP VIEW (768px - 1279px): Scroll-Snap Stepper Bar   */}
      {/* ========================================================================= */}
      <div className="hidden md:block xl:hidden relative overflow-x-auto py-3 scrollbar-thin scrollbar-thumb-[var(--border)]">
        <div className="flex items-start min-w-[700px] justify-between relative px-4">
          {/* Connector line */}
          <div className="absolute left-8 right-8 top-6 h-[2px] bg-[var(--border)] z-0" />

          {stages.map((stage, idx) => {
            const stageNum = idx + 1;
            const isCompleted = stage.status === "completed";
            const isActive = stage.status === "in_progress";
            const isPending = stage.status === "pending" || stage.status === "skipped";

            return (
              <div key={stage.id} className="flex flex-col items-center min-w-[120px] flex-1 z-10">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all bg-[var(--card-bg)] shadow-xs",
                    isCompleted && "bg-emerald-500/10 border-2 border-emerald-600",
                    isActive && "border-2 border-[var(--primary)] text-[var(--primary)] ring-4 ring-[var(--primary)]/10",
                    isPending && "bg-[var(--page-bg)] border-2 border-[var(--input-border)] text-[var(--text-faint)]"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span>{stageNum}</span>
                  )}
                </div>

                <span className="text-xs font-semibold text-[var(--text-primary)] text-center mt-2 px-1 line-clamp-1">
                  {stage.name}
                </span>

                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 uppercase tracking-wide",
                    isCompleted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    isActive && "bg-indigo-500/10 text-[var(--primary)]",
                    isPending && "bg-[var(--page-bg)] text-[var(--text-muted)]"
                  )}
                >
                  {stage.status === "in_progress" ? "In Progress" : stage.status}
                </span>

                {stage.date && (
                  <span className="text-[10px] text-[var(--text-faint)] text-center mt-1">
                    {stage.date}
                  </span>
                )}

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

      {/* ========================================================================= */}
      {/* 3. DESKTOP VIEW (>= 1280px): Full Spacious Horizontal Pipeline              */}
      {/* ========================================================================= */}
      <div className="hidden xl:block relative py-2">
        {/* Background connector line */}
        <div className="absolute left-[6%] right-[6%] top-6 h-[2px] bg-[var(--border)] z-0" />

        {/* Done connector lines overlay */}
        <div className="absolute left-[6%] right-[6%] top-6 h-[2px] z-0 flex">
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
                  isDoneSegment && "bg-emerald-600",
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
                    "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 select-none bg-[var(--card-bg)] shadow-xs",
                    isCompleted && "bg-emerald-500/10 border-[3px] border-emerald-600",
                    isActive && "border-[3px] border-[var(--primary)] text-[var(--primary)] ring-4 ring-[var(--primary)]/10",
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
    </div>
  );
}
