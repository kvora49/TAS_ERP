"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

interface HubItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  count?: number;
  /** Accent color class, e.g. "text-indigo-500". Defaults to primary. */
  accent?: string;
}

interface HubSection {
  title: string;
  items: HubItem[];
}

interface ModuleHubPageProps {
  title: string;
  subtitle?: string;
  sections: HubSection[];
}

export function ModuleHubPage({ title, subtitle, sections }: ModuleHubPageProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="select-none">
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] leading-tight tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 font-medium">
            {subtitle}
          </p>
        )}
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title}>
          {/* Section title - only show if more than 1 section */}
          {sections.length > 1 && (
            <h2 className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 px-0.5">
              {section.title}
            </h2>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname?.startsWith(item.href);
              const accent = item.accent || "text-[var(--primary)]";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => triggerHaptic("selection")}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all text-center group cursor-pointer active:scale-95",
                    isActive
                      ? "border-[var(--primary)] bg-[var(--primary-light)] shadow-sm"
                      : "border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] hover:border-[var(--primary)]/30"
                  )}
                >
                  {/* Icon Circle */}
                  <div
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-1.5 sm:mb-2 transition-transform group-hover:scale-105",
                      isActive
                        ? "bg-[var(--primary)] text-white"
                        : `bg-[var(--page-bg)] ${accent}`
                    )}
                  >
                    <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  </div>

                  {/* Label */}
                  <span className="text-[11px] sm:text-xs font-bold leading-tight text-[var(--text-primary)] truncate w-full px-0.5">
                    {item.label}
                  </span>

                  {/* Optional count badge */}
                  {item.count !== undefined && (
                    <span className="text-[9px] font-bold text-[var(--text-faint)] mt-0.5">
                      {item.count} items
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
