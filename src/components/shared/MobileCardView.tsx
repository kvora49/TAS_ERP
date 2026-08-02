"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MobileCardField {
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}

export interface MobileCardViewProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  avatar?: ReactNode;
  fields: MobileCardField[];
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function MobileCardView({
  title,
  subtitle,
  badge,
  avatar,
  fields,
  actions,
  onClick,
  className,
}: MobileCardViewProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 shadow-xs hover:border-[var(--primary)]/40 transition-all text-left",
        onClick && "cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      {/* Card Top Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border-light)]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {avatar && <div className="shrink-0">{avatar}</div>}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[var(--text-primary)] truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-[var(--text-muted)] font-medium mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Card Data Fields Grid (Preserving 100% of columns) */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 text-xs">
        {fields.map((field, idx) => (
          <div
            key={idx}
            className={cn(
              "flex flex-col min-w-0",
              field.fullWidth ? "col-span-2" : "col-span-1"
            )}
          >
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider truncate">
              {field.label}
            </span>
            <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 truncate">
              {field.value ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Card Bottom Actions */}
      {actions && (
        <div className="mt-3 pt-3 border-t border-[var(--border-light)] flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
