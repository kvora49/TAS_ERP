"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardHeaderProps {
  currentStep: number; // 1-indexed
  steps: string[];
}

export default function WizardHeader({ currentStep, steps }: WizardHeaderProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 mb-6 relative">
      {/* Connector line (background) */}
      <div className="absolute left-10 right-10 top-[38px] h-[2px] bg-[#E5E7EB] z-0" />

      {/* Active connector line */}
      <div
        className="absolute left-10 top-[38px] h-[2px] bg-[#15803D] transition-all duration-300 z-0"
        style={{
          width: `${
            steps.length > 1
              ? ((Math.min(currentStep, steps.length) - 1) / (steps.length - 1)) * 100
              : 0
          }%`,
          maxWidth: "calc(100% - 80px)",
        }}
      />

      <div className="flex items-center justify-between relative z-10">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          const isPending = stepNum > currentStep;

          return (
            <div key={idx} className="flex flex-col items-center flex-1 relative">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200",
                  isActive && "bg-[#6366F1] text-white ring-4 ring-[#EEF2FF]",
                  isDone && "bg-[#15803D] text-white",
                  isPending && "bg-[#E5E7EB] text-[#94A3B8]"
                )}
              >
                {isDone ? <Check className="h-5 w-5" /> : <span>{stepNum}</span>}
              </div>
              <span
                className={cn(
                  "text-xs mt-2 text-center transition-colors duration-200 select-none",
                  isActive && "font-semibold text-[#6366F1]",
                  isDone && "font-medium text-[#15803D]",
                  isPending && "text-[#94A3B8]"
                )}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
