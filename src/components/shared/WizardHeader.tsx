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
    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 mb-6 relative">
      {/* Connector line (background) */}
      <div className="absolute left-10 right-10 top-[38px] h-[2px] bg-[var(--border)] z-0" />

      {/* Active connector line */}
      <div
        className="absolute left-10 top-[38px] h-[2px] bg-green-600 transition-all duration-300 z-0"
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
                    ? "bg-green-600 border-green-600 text-white"
                    : isActive
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                    : "bg-[var(--card-bg)] border-[var(--input-border)] text-[var(--text-muted)]"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold mt-2 text-center uppercase tracking-wider",
                  isActive ? "text-[var(--primary)]" : isDone ? "text-green-600" : "text-[var(--text-faint)]"
                )}
              >
                {label}
              </span>
              {description && (
                <span className="text-[9px] text-[var(--text-faint)] font-medium text-center max-w-[80px] leading-tight">
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
