import React from "react";
import Link from "next/link";
import { ChevronRight, Search, Plus } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (val: string) => void;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearch,
  actionLabel,
  onAction,
  actionIcon = <Plus className="h-4 w-4 text-white" />,
}: PageHeaderProps) {
  return (
    <div className="mb-3 sm:mb-6 select-none">
      {/* Breadcrumb Navigation — hidden on mobile (Header already shows page title) */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={i}>
              {bc.href ? (
                <Link
                  href={bc.href}
                  className="hover:text-[var(--primary)] transition-colors"
                >
                  {bc.label}
                </Link>
              ) : (
                <span className="text-[var(--text-primary)]">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <ChevronRight size={12} className="text-[var(--text-faint)]" />
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl lg:text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-sm text-[var(--text-muted)] mt-0.5 font-medium leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions panel */}
        <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
          {/* Search bar */}
          {onSearch && (
            <div className="relative flex-1 sm:flex-initial sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4 pointer-events-none" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
                className="pl-9 pr-4 h-9 sm:h-10 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all"
              />
            </div>
          )}

          {/* Action button */}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer shadow-lg shadow-[var(--primary)]/10 shrink-0 whitespace-nowrap"
            >
              {actionIcon}
              <span className="hidden min-[400px]:inline">{actionLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
