import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsPageHeaderProps {
  section: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  actionOutline?: boolean;
}

export function SettingsPageHeader({
  section,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionIcon,
  actionDisabled = false,
  actionLoading = false,
  actionOutline = false,
}: SettingsPageHeaderProps) {
  return (
    <div className="mb-6 select-none text-left">
      {/* Row 1 — Breadcrumb */}
      <nav className="flex items-center text-sm mb-2 font-medium">
        <Link href="/settings/general" className="text-[#6366F1] hover:underline">
          Settings
        </Link>
        <span className="text-[#94A3B8] mx-1.5">
          <ChevronRight className="size-4 inline" />
        </span>
        <span className="text-[#64748B]">{section}</span>
      </nav>

      {/* Row 2 — Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[#64748B] mt-1 font-medium leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Action Button */}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled || actionLoading}
            className={cn(
              "font-semibold text-sm h-10 px-4 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[var(--shadow-sm)] disabled:opacity-50 disabled:cursor-not-allowed",
              actionOutline
                ? "border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F8FAFC]"
                : "bg-[#6366F1] hover:bg-[#4F46E5] text-white"
            )}
          >
            {actionIcon}
            {actionLoading ? "Saving..." : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
