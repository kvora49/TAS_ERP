"use client";

import React, { useState } from "react";
import { SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Modal } from "@/components/shared/Modal";

interface MobileFilterSheetProps {
  /** Number of active (non-default) filters — shows a count badge */
  activeCount?: number;
  /** Label for the trigger button */
  triggerLabel?: string;
  /** Whether to render as a compact icon-only button (ideal for headers) */
  compact?: boolean;
  /** Custom trigger class name */
  triggerClassName?: string;
  /** Called when user taps "Clear All" — pass undefined to hide the button */
  onClearAll?: () => void;
  /** Filter controls to render inside the sheet */
  children: React.ReactNode;
}

/**
 * MobileFilterSheet
 *
 * A bottom-sheet filter panel for mobile screens (< md).
 * Renders a compact trigger button that opens the sheet.
 * The actual desktop filter bar is managed by each page separately via `hidden md:flex`.
 *
 * Usage:
 * ```tsx
 * <div className="md:hidden flex gap-2 mb-3">
 *   <SearchInput ... />
 *   <MobileFilterSheet activeCount={2} onClearAll={handleClear}>
 *     <select>...</select>
 *     <select>...</select>
 *   </MobileFilterSheet>
 * </div>
 * ```
 */
export function MobileFilterSheet({
  activeCount = 0,
  triggerLabel = "Filters",
  compact = false,
  triggerClassName = "",
  onClearAll,
  children,
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const hasActive = activeCount > 0;

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`
          relative flex items-center justify-center rounded-lg border transition-all shrink-0 cursor-pointer select-none
          ${compact ? "w-8 h-8" : "h-10 px-3 gap-1.5 text-sm font-semibold"}
          ${hasActive
            ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
            : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          }
          ${triggerClassName}
        `}
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" />
        {!compact && <span className="hidden min-[360px]:inline">{triggerLabel}</span>}
        {hasActive && (
          <span
            className={
              compact
                ? "absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[var(--primary)] text-white text-[9px] font-black shadow-xs"
                : "flex items-center justify-center w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[9px] font-black ml-0.5"
            }
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Filter Sheet — uses existing Modal which already renders as bottom sheet on mobile */}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--primary)]" />
            <span>{triggerLabel}</span>
            {hasActive && (
              <span className="text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded-full">
                {activeCount} active
              </span>
            )}
          </div>
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {/* Filter Content */}
          <div className="space-y-3">
            {children}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
            {onClearAll && hasActive && (
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear All Filters
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto flex items-center gap-1.5 h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-bold rounded-xl transition-all cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/**
 * MobileFilterField
 *
 * A labelled wrapper for a single filter control inside MobileFilterSheet.
 * Provides consistent label styling across all filter sheets.
 */
export function MobileFilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
