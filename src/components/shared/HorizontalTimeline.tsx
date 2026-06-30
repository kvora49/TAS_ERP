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
    <div className="flex items-start gap-0 w-full overflow-x-auto py-2 relative scrollbar-none select-none">
      {/* Background connector line */}
      <div className="absolute left-[12.5%] right-[12.5%] top-6 h-[2px] bg-[#E5E7EB] z-0" />

      {/* Done connector lines overlay */}
      <div className="absolute left-[12.5%] right-[12.5%] top-6 h-[2px] z-0 flex">
        {steps.slice(0, -1).map((step, idx) => {
          const isDoneSegment =
            step.status === "completed" &&
            (steps[idx + 1].status === "completed" || steps[idx + 1].status === "active");

          return (
            <div
              key={idx}
              className={cn("flex-1 h-[2px]", isDoneSegment ? "bg-[#15803D]" : "bg-[#E5E7EB]")}
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
            <div key={idx} className="flex flex-col items-center flex-1 min-w-[100px]">
              {/* Circle */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 bg-white",
                  isCompleted && "bg-[#DCFCE7] border-[#15803D] text-[#15803D]",
                  isActive && "border-[#6366F1] text-[#6366F1] font-bold text-sm",
                  isPending && "bg-[#F9FAFB] border-[#D1D5DB] text-[#94A3B8] text-sm"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <span>{idx + 1}</span>}
              </div>

              {/* Label */}
              <span className="text-xs font-semibold text-[#374151] text-center mt-2.5 px-1">
                {step.label}
              </span>

              {/* Date */}
              {step.date && (
                <span className="text-[10px] text-[#94A3B8] text-center mt-1 font-medium">
                  {step.date}
                </span>
              )}

              {/* Time */}
              {step.time && (
                <span className="text-[10px] text-[#94A3B8] text-center font-medium leading-none mt-0.5">
                  {step.time}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
