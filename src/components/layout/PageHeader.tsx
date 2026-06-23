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
    <div className="mb-6 select-none">
      {/* Breadcrumb Navigation */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-semibold uppercase tracking-wider">
          {breadcrumbs.map((bc, i) => (
            <React.Fragment key={i}>
              {bc.href ? (
                <Link
                  href={bc.href}
                  className="hover:text-[#6366F1] transition-colors"
                >
                  {bc.label}
                </Link>
              ) : (
                <span className="text-[#374151]">{bc.label}</span>
              )}
              {i < breadcrumbs.length - 1 && (
                <ChevronRight size={12} className="text-[#94A3B8]" />
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[#64748B] mt-0.5 font-medium leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions panel */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          {/* Search bar */}
          {onSearch && (
            <div className="relative w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] h-4 w-4 pointer-events-none" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
                className="pl-9 pr-4 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
              />
            </div>
          )}

          {/* Action button */}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
            >
              {actionIcon}
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
