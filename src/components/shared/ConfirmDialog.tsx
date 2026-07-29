"use client";

import React from "react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description = "This action cannot be undone. This will permanently delete the record.",
  onConfirm,
  loading = false,
  confirmText = "Delete",
  cancelText = "Cancel",
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col sm:flex-row justify-end gap-2 mt-6 pt-4 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={loading}
          className="h-10 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-medium text-[var(--text-body)] transition-colors cursor-pointer disabled:opacity-50"
        >
          {cancelText}
        </button>

        <AsyncButton
          variant="destructive"
          onClick={async () => {
            await onConfirm();
            onOpenChange(false);
          }}
          isLoading={loading}
          className="h-10 px-4 text-sm font-semibold"
        >
          {confirmText}
        </AsyncButton>
      </div>
    </Modal>
  );
}
