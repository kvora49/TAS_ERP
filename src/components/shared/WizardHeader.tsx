"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type WizardStep = string | { title: string; description?: string };

interface WizardHeaderProps {
  currentStep: number; // 1-indexed
  steps: WizardStep[];
}

function getStepLabel(step: WizardStep): string {
  return typeof step === "string" ? step : step.title;
}

function getStepDescription(step: WizardStep): string | undefined {
  return typeof step === "string" ? undefined : step.description;
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
          const label = getStepLabel(step);
          const description = getStepDescription(step);

          return (
            <div key={idx} className="flex flex-col items-center flex-1 relative">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200",
                  isDone
                    ? "bg-[#15803D] border-[#15803D] text-white"
                    : isActive
                    ? "bg-[#6366F1] border-[#6366F1] text-white"
                    : "bg-white border-[#D1D5DB] text-[#64748B]"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold mt-2 text-center uppercase tracking-wider",
                  isActive ? "text-[#6366F1]" : isDone ? "text-[#15803D]" : "text-[#94A3B8]"
                )}
              >
                {label}
              </span>
              {description && (
                <span className="text-[9px] text-[#94A3B8] font-medium text-center max-w-[80px] leading-tight">
                  {description}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
