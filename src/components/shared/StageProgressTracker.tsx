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
      <div className="absolute left-[8.33%] right-[8.33%] top-6 h-[2px] bg-[#E5E7EB] z-0" />

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
                isDoneSegment && "bg-[#15803D]",
                isActiveSegment && "border-t-2 border-dashed border-[#E5E7EB]"
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
                  "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 select-none bg-white",
                  isCompleted && "bg-[#DCFCE7] border-[3px] border-[#15803D]",
                  isActive && "border-[3px] border-[#6366F1] text-[#6366F1]",
                  isPending && "bg-[#F9FAFB] border-2 border-[#D1D5DB] text-[#94A3B8]"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-6 w-6 text-[#15803D]" />
                ) : (
                  <span>{stageNum}</span>
                )}
              </div>

              {/* Stage Name */}
              <span className="text-sm font-semibold text-[#0F172A] text-center mt-2 px-1">
                {stage.name}
              </span>

              {/* Status Badge */}
              <span
                className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-wide",
                  isCompleted && "bg-[#DCFCE7] text-[#15803D]",
                  isActive && "bg-[#DBEAFE] text-[#1D4ED8]",
                  isPending && "bg-[#F1F5F9] text-[#64748B]"
                )}
              >
                {stage.status === "in_progress" ? "In Progress" : stage.status}
              </span>

              {/* Date */}
              {stage.date && (
                <span className="text-[10px] text-[#94A3B8] text-center mt-1">
                  {stage.date}
                </span>
              )}

              {/* Qty */}
              {stage.qty !== undefined && stage.qty !== null && (
                <span className="text-xs text-[#64748B] text-center font-medium mt-0.5">
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
