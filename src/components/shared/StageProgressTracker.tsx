"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageNode {
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
  if (!stages || stages.length === 0) return null;

  return (
    <div className="w-full py-4 select-none">
      {/* ========================================================================= */}
      {/* 1. MOBILE VIEW (< 768px): Vertical Stacked Stepper                         */}
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
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-5 top-10 bottom-0 w-[2px] z-0 transition-colors",
                    isCompleted ? "bg-emerald-500" : "bg-[var(--border)]"
                  )}
                />
              )}

              {/* Step Circle Node */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 z-10 transition-all bg-[var(--card-bg)] shadow-xs relative",
                  isCompleted && "border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400",
                  isActive && "border-2 border-[var(--primary)] text-[var(--primary)] ring-4 ring-[var(--primary)]/15 font-bold",
                  isPending && "border-2 border-[var(--input-border)] text-[var(--text-faint)]"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
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
                      isActive && "bg-[var(--primary)]/10 text-[var(--primary)]",
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
      {/* 2. DESKTOP & TABLET VIEW (>= 768px): Horizontal Flex Pipeline with Segmented Connectors */}
      {/* ========================================================================= */}
      <div className="hidden md:block">
        <div className="flex items-center w-full px-6">
          {stages.map((stage, idx) => {
            const stageNum = idx + 1;
            const isCompleted = stage.status === "completed";
            const isActive = stage.status === "in_progress";
            const isPending = stage.status === "pending" || stage.status === "skipped";
            const isLast = idx === stages.length - 1;

            // Connector state between this node and the next
            const nextStage = stages[idx + 1];
            const isConnectorDone = isCompleted && (nextStage?.status === "completed" || nextStage?.status === "in_progress");

            return (
              <div key={stage.id} className="flex-1 flex items-center last:flex-none">
                {/* Stage Node Item */}
                <div className="flex flex-col items-center relative group min-w-[100px]">
                  {/* Step Circle Node with Opaque Background */}
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center font-bold text-base transition-all duration-200 z-10 shadow-xs relative bg-[var(--card-bg)]",
                      isCompleted && "border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400",
                      isActive && "border-2 border-[var(--primary)] text-[var(--primary)] ring-4 ring-[var(--primary)]/15 font-extrabold scale-105",
                      isPending && "border-2 border-[var(--input-border)] text-[var(--text-faint)]"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    ) : (
                      <span>{stageNum}</span>
                    )}
                  </div>

                  {/* Stage Label Details */}
                  <div className="flex flex-col items-center mt-2.5 text-center">
                    <span className="text-xs font-bold text-[var(--text-primary)] px-1 line-clamp-1 max-w-[130px]">
                      {stage.name}
                    </span>

                    <span
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 uppercase tracking-wide",
                        isCompleted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        isActive && "bg-[var(--primary)]/10 text-[var(--primary)]",
                        isPending && "bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                      )}
                    >
                      {stage.status === "in_progress" ? "In Progress" : stage.status}
                    </span>

                    {stage.date && (
                      <span className="text-[10px] text-[var(--text-faint)] mt-1 font-mono">
                        {stage.date}
                      </span>
                    )}

                    {stage.qty !== undefined && stage.qty !== null && (
                      <span className="text-[11px] text-[var(--text-muted)] font-medium mt-0.5">
                        Qty: <span className="font-bold text-[var(--text-primary)]">{stage.qty}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Connector Line to Next Node (only rendered if not the last node) */}
                {!isLast && (
                  <div className="flex-1 px-2 mb-14">
                    <div
                      className={cn(
                        "h-[3px] w-full rounded-full transition-all duration-300",
                        isConnectorDone
                          ? "bg-emerald-500"
                          : isActive
                          ? "bg-gradient-to-r from-emerald-500 to-[var(--border)]"
                          : "bg-[var(--border)]"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
