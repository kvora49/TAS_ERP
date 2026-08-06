"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  label: string;
  date?: string | null;
  time?: string | null;
  status: "completed" | "active" | "pending";
}

interface HorizontalTimelineProps {
  steps: TimelineStep[];
}

export default function HorizontalTimeline({ steps }: HorizontalTimelineProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="w-full py-2 relative select-none">
      {/* ========================================================================= */}
      {/* 1. MOBILE VIEW (< 768px): Vertical Stacked Timeline                       */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-0 relative py-1">
        {steps.map((step, idx) => {
          const isCompleted = step.status === "completed";
          const isActive = step.status === "active";
          const isPending = step.status === "pending";
          const isLast = idx === steps.length - 1;

          return (
            <div key={idx} className="relative flex items-start gap-4 pb-5 last:pb-0">
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-4 top-8 bottom-0 w-[2px] z-0 transition-colors",
                    isCompleted ? "bg-emerald-500" : "bg-[var(--border)]"
                  )}
                />
              )}

              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shrink-0 z-10 bg-[var(--card-bg)] shadow-xs",
                  isCompleted && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
                  isActive && "border-[var(--primary)] text-[var(--primary)] font-bold text-xs ring-4 ring-[var(--primary)]/15",
                  isPending && "border-[var(--input-border)] text-[var(--text-faint)] text-xs"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4 text-emerald-500" /> : <span>{idx + 1}</span>}
              </div>

              <div className="flex-1 bg-[var(--page-bg)]/50 rounded-lg p-2.5 border border-[var(--border)] shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {step.label}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                      isCompleted && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      isActive && "bg-[var(--primary)]/10 text-[var(--primary)]",
                      isPending && "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                    )}
                  >
                    {step.status}
                  </span>
                </div>

                {(step.date || step.time) && (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)] mt-1 font-medium">
                    {step.date && <span>{step.date}</span>}
                    {step.date && step.time && <span>•</span>}
                    {step.time && <span>{step.time}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 2. TABLET / DESKTOP VIEW (>= 768px): Horizontal Segmented Timeline       */}
      {/* ========================================================================= */}
      <div className="hidden md:block py-2">
        <div className="flex items-center w-full px-6">
          {steps.map((step, idx) => {
            const isCompleted = step.status === "completed";
            const isActive = step.status === "active";
            const isPending = step.status === "pending";
            const isLast = idx === steps.length - 1;

            // Connector state between this node and the next
            const nextStep = steps[idx + 1];
            const isConnectorDone = isCompleted && (nextStep?.status === "completed" || nextStep?.status === "active");

            return (
              <div key={idx} className="flex-1 flex items-center last:flex-none">
                {/* Node item */}
                <div className="flex flex-col items-center relative group min-w-[90px]">
                  {/* Step Circle Node with Opaque Background */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 z-10 shadow-xs relative bg-[var(--card-bg)]",
                      isCompleted && "border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400",
                      isActive && "border-2 border-[var(--primary)] text-[var(--primary)] ring-4 ring-[var(--primary)]/15 scale-105 font-bold",
                      isPending && "border-2 border-[var(--input-border)] text-[var(--text-faint)]"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4 text-emerald-500" /> : <span>{idx + 1}</span>}
                  </div>

                  {/* Label */}
                  <span className="text-xs font-semibold text-[var(--text-body)] text-center mt-2 px-1 line-clamp-1">
                    {step.label}
                  </span>

                  {/* Date & Time */}
                  {step.date && (
                    <span className="text-[10px] text-[var(--text-faint)] text-center mt-1 font-mono">
                      {step.date}
                    </span>
                  )}

                  {step.time && (
                    <span className="text-[10px] text-[var(--text-faint)] text-center font-mono leading-none mt-0.5">
                      {step.time}
                    </span>
                  )}
                </div>

                {/* Connector Line (only rendered if not the last node) */}
                {!isLast && (
                  <div className="flex-1 px-2 mb-11">
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
