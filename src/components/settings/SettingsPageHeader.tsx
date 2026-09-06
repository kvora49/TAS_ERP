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
    <div className="mb-4 sm:mb-6 select-none text-left">
      {/* Row 1 — Breadcrumb */}
      <nav className="flex items-center text-xs sm:text-sm mb-1.5 sm:mb-2 font-medium">
        <Link href="/settings" className="text-[var(--primary)] hover:underline">
          Settings
        </Link>
        <span className="text-[var(--text-faint)] mx-1 sm:mx-1.5">
          <ChevronRight className="size-3.5 sm:size-4 inline" />
        </span>
        <span className="text-[var(--text-muted)]">{section}</span>
      </nav>

      {/* Row 2 — Title & Action Row (Side-by-side with compact right button on mobile) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 font-medium leading-relaxed line-clamp-2 sm:line-clamp-none">
              {subtitle}
            </p>
          )}
        </div>

        {/* Action Button: Compact right-aligned on mobile, full-size on desktop */}
        {actionLabel && onAction && (
          <div className="shrink-0 pt-0.5 sm:pt-0">
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled || actionLoading}
              className={cn(
                "font-bold text-xs sm:text-sm h-8.5 sm:h-10 px-3 sm:px-4 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-[var(--shadow-sm)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0",
                actionOutline
                  ? "border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
                  : "bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white"
              )}
            >
              {actionIcon}
              <span>{actionLoading ? "Saving..." : actionLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
