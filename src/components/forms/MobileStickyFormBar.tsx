"use client";

import React from "react";
import AsyncButton from "@/components/shared/AsyncButton";
import { triggerHaptic } from "@/lib/haptics";

interface MobileStickyFormBarProps {
  onCancel: () => void;
  onSave: () => void | Promise<any>;
  cancelText?: string;
  saveText?: string;
  isSaving?: boolean;
  disabled?: boolean;
}

export function MobileStickyFormBar({
  onCancel,
  onSave,
  cancelText = "Cancel",
  saveText = "Save",
  isSaving = false,
  disabled = false,
}: MobileStickyFormBarProps) {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)]/95 backdrop-blur-md border-t border-[var(--border)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-3 shadow-lg">
      <button
        type="button"
        onClick={() => {
          triggerHaptic("selection");
          onCancel();
        }}
        disabled={isSaving}
        className="flex-1 h-11 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-secondary)] font-bold text-sm active:opacity-75 transition-opacity"
      >
        {cancelText}
      </button>

      <AsyncButton
        type="button"
        onClick={async () => {
          triggerHaptic("impactMedium");
          await onSave();
        }}
        isLoading={isSaving}
        disabled={disabled || isSaving}
        variant="primary"
        className="flex-1 h-11 rounded-xl font-bold text-sm shadow-md"
      >
        {saveText}
      </AsyncButton>
    </div>
  );
}
