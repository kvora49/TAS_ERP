"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStep {
  label: string;
  date?: string | null;
  time?: string | null;
  status: "completed" | "active" | "pending";
}

interface HorizontalTimelineProps {
  steps: TimelineStep[];
}

export default function HorizontalTimeline({ steps }: HorizontalTimelineProps) {
  return (
    <div className="w-full py-2 relative select-none">
      {/* MOBILE VIEW (< 768px): Vertical Stacked Timeline */}
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
                    isCompleted ? "bg-emerald-600" : "bg-[var(--border)]"
                  )}
                />
              )}

              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shrink-0 z-10 bg-[var(--card-bg)] shadow-xs",
                  isCompleted && "bg-emerald-500/10 border-emerald-600 text-emerald-600 dark:text-emerald-400",
                  isActive && "border-[var(--primary)] text-[var(--primary)] font-bold text-xs ring-4 ring-[var(--primary)]/10",
                  isPending && "bg-[var(--page-bg)] border-[var(--input-border)] text-[var(--text-faint)] text-xs"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <span>{idx + 1}</span>}
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
                      isActive && "bg-indigo-500/10 text-[var(--primary)]",
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

      {/* TABLET / DESKTOP VIEW (>= 768px): Scrollable Horizontal Timeline */}
      <div className="hidden md:block overflow-x-auto py-2 scrollbar-thin scrollbar-thumb-[var(--border)]">
        <div className="flex items-start justify-between w-full min-w-[600px] relative px-4">
          {/* Background connector line */}
          <div className="absolute left-8 right-8 top-6 h-[2px] bg-[var(--border)] z-0" />

          {/* Done connector lines overlay */}
          <div className="absolute left-8 right-8 top-6 h-[2px] z-0 flex">
            {steps.slice(0, -1).map((step, idx) => {
              const isDoneSegment =
                step.status === "completed" &&
                (steps[idx + 1].status === "completed" || steps[idx + 1].status === "active");

              return (
                <div
                  key={idx}
                  className={cn("flex-1 h-[2px]", isDoneSegment ? "bg-emerald-600" : "bg-[var(--border)]")}
                />
              );
            })}
          </div>

          <div className="flex items-start justify-between w-full relative z-10">
            {steps.map((step, idx) => {
              const isCompleted = step.status === "completed";
              const isActive = step.status === "active";
              const isPending = step.status === "pending";

              return (
                <div key={idx} className="flex flex-col items-center flex-1 min-w-[110px]">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 bg-[var(--card-bg)] shadow-xs",
                      isCompleted && "bg-emerald-500/10 border-emerald-600 text-emerald-600 dark:text-emerald-400",
                      isActive && "border-[var(--primary)] text-[var(--primary)] font-bold text-sm ring-4 ring-[var(--primary)]/10",
                      isPending && "bg-[var(--page-bg)] border-[var(--input-border)] text-[var(--text-faint)] text-sm"
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : <span>{idx + 1}</span>}
                  </div>

                  <span className="text-xs font-semibold text-[var(--text-body)] text-center mt-2 px-1 line-clamp-1">
                    {step.label}
                  </span>

                  {step.date && (
                    <span className="text-[10px] text-[var(--text-faint)] text-center mt-1 font-medium">
                      {step.date}
                    </span>
                  )}

                  {step.time && (
                    <span className="text-[10px] text-[var(--text-faint)] text-center font-medium leading-none mt-0.5">
                      {step.time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
