import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function SettingsCard({
  icon: Icon,
  iconBg = "bg-[#EEF2FF]",
  iconColor = "text-[#6366F1]",
  title,
  subtitle,
  children,
  className,
  headerRight,
}: SettingsCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              iconBg
            )}
          >
            <Icon className={cn("size-5", iconColor)} />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-[#0F172A] leading-none">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {headerRight && <div className="flex-shrink-0">{headerRight}</div>}
      </div>

      {/* Card Content */}
      <div className="w-full">{children}</div>
    </div>
  );
}
