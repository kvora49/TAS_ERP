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
  const totalSteps = steps.length;
  const desktopProgressPct =
    totalSteps > 1
      ? ((Math.min(currentStep, totalSteps) - 1) / (totalSteps - 1)) * 100
      : 0;
  const mobileProgressPct = (currentStep / totalSteps) * 100;
  const currentStepLabel = getStepLabel(steps[currentStep - 1] ?? steps[0]);

  return (
    <>
      {/* ─── MOBILE compact step bar (hidden md and above) ─────────────────── */}
      <div className="md:hidden bg-[var(--card-bg)] rounded-xl border border-[var(--border)] px-4 py-3 mb-4 shadow-[var(--shadow-sm)]">
        {/* Top row: step counter + step name */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-xs font-bold text-[var(--primary)] truncate ml-2 max-w-[60%] text-right">
            {currentStepLabel}
          </span>
        </div>

        {/* Segmented progress bar — one segment per step */}
        <div className="flex items-center gap-1 mb-2.5">
          {steps.map((_, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < currentStep;
            const isActive = stepNum === currentStep;
            return (
              <div
                key={idx}
                className={cn(
                  "flex-1 h-1.5 rounded-full transition-all duration-300",
                  isDone
                    ? "bg-green-500"
                    : isActive
                    ? "bg-[var(--primary)]"
                    : "bg-[var(--border)]"
                )}
              />
            );
          })}
        </div>

        {/* Circle dots row — numbered, no text labels */}
        <div className="flex items-center justify-between">
          {steps.map((_, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < currentStep;
            const isActive = stepNum === currentStep;
            return (
              <div
                key={idx}
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-200",
                  isDone
                    ? "bg-green-500 border-green-500 text-white"
                    : isActive
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white scale-110"
                    : "bg-[var(--card-bg)] border-[var(--input-border)] text-[var(--text-faint)]"
                )}
              >
                {isDone ? <Check className="h-3 w-3 stroke-[3]" /> : stepNum}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── DESKTOP full horizontal step row (hidden below md) — UNCHANGED ── */}
      <div className="hidden md:block bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 mb-6 relative">
        {/* Connector line background */}
        <div className="absolute left-10 right-10 top-[38px] h-[2px] bg-[var(--border)] z-0" />

        {/* Active connector line */}
        <div
          className="absolute left-10 top-[38px] h-[2px] bg-green-600 transition-all duration-300 z-0"
          style={{
            width: `${desktopProgressPct}%`,
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
                    isActive
                      ? "text-[var(--primary)]"
                      : isDone
                      ? "text-green-600"
                      : "text-[var(--text-faint)]"
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
    </>
  );
}
