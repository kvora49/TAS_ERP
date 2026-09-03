"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { SwipeableRow } from "./SwipeableRow";

interface SwipeActionConfig {
  label: string;
  icon?: React.ReactNode;
  bgClass: string;
  onAction: () => void;
}

interface MobileCompactRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  subValue?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  leftAction?: SwipeActionConfig;
  rightAction?: SwipeActionConfig;
  className?: string;
}

export function MobileCompactRow({
  title,
  subtitle,
  value,
  subValue,
  badge,
  icon,
  onClick,
  leftAction,
  rightAction,
  className,
}: MobileCompactRowProps) {
  const rowContent = (
    <div
      onClick={() => {
        if (onClick) {
          triggerHaptic("impactLight");
          onClick();
        }
      }}
      className={cn(
        "flex items-center justify-between px-3.5 py-3 border-b border-[var(--border-light)] bg-[var(--card-bg)] active:bg-[var(--table-row-hover)] transition-colors select-none cursor-pointer touch-ripple min-h-[66px]",
        className
      )}
    >
      {/* Left: Icon + Title + Subtitle */}
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-[var(--page-bg)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--primary)]">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-[var(--text-primary)] truncate font-mono">
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)] font-medium truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Value + Status Badge + Chevron */}
      <div className="flex items-center gap-2 shrink-0 text-right">
        <div className="flex flex-col items-end">
          {value && (
            <span className="text-sm font-extrabold text-[var(--text-primary)] font-mono leading-tight">
              {value}
            </span>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            {badge && <div>{badge}</div>}
            {subValue && (
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {subValue}
              </span>
            )}
          </div>
        </div>

        {onClick && (
          <ChevronRight size={16} className="text-[var(--text-faint)] shrink-0 ml-1" />
        )}
      </div>
    </div>
  );

  if (leftAction || rightAction) {
    return (
      <SwipeableRow leftAction={leftAction} rightAction={rightAction}>
        {rowContent}
      </SwipeableRow>
    );
  }

  return rowContent;
}
