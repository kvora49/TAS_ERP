import React from "react";
import { Eye, LucideIcon } from "lucide-react";
import { SettingsCard } from "./SettingsCard";
import { cn } from "@/lib/utils";

interface PreviewRow {
  icon: LucideIcon;
  label: string;
  value: string | boolean;
  type: "text" | "badge";
}

interface SettingsPreviewCardProps {
  title?: string;
  subtitle?: string;
  rows: PreviewRow[];
  children?: React.ReactNode;
  className?: string;
}

export function SettingsPreviewCard({
  title = "Preview",
  subtitle = "Current Settings Summary",
  rows,
  children,
  className,
}: SettingsPreviewCardProps) {
  return (
    <SettingsCard
      icon={Eye}
      iconBg="bg-[#EEF2FF]"
      iconColor="text-[#6366F1]"
      title={title}
      subtitle={subtitle}
      className={cn("h-fit", className)}
    >
      <div className="flex flex-col">
        {/* Key-Value Rows */}
        {rows.map((row, idx) => {
          const Icon = row.icon;
          const isBool = typeof row.value === "boolean";
          const displayVal = isBool ? (row.value ? "Enabled" : "Disabled") : row.value;

          return (
            <div
              key={idx}
              className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0 select-none text-left"
            >
              {/* Left */}
              <div className="flex items-center gap-3">
                <Icon className="size-4 text-[#94A3B8] shrink-0" />
                <span className="text-sm text-[#64748B]">{row.label}</span>
              </div>
              {/* Right */}
              <div>
                {row.type === "badge" || isBool ? (
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded select-none whitespace-nowrap",
                      row.value === true || row.value === "Enabled" || row.value === "Active"
                        ? "bg-[#DCFCE7] text-[#15803D]"
                        : "bg-[#FEE2E2] text-[#DC2626]"
                    )}
                  >
                    {displayVal}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-[#374151] truncate max-w-[150px] inline-block">
                    {displayVal}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Custom Section / Children */}
        {children && <div className="mt-4 pt-4 border-t border-[#F3F4F6]">{children}</div>}
      </div>
    </SettingsCard>
  );
}
