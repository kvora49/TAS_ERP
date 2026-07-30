"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

interface ReverseWriteOffModalProps {
  writeOffId: string | null;
  onOpenChange: (open: boolean) => void;
}

export default function ReverseWriteOffModal({ writeOffId, onOpenChange }: ReverseWriteOffModalProps) {
  const queryClient = useQueryClient();
  const [reversalReason, setReversalReason] = useState<string>("");

  const reverseMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payments/write-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to reverse write-off");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Write-off reversed and outstanding balance restored!");
      queryClient.invalidateQueries({ queryKey: ["write-offs"] });
      onOpenChange(false);
      setReversalReason("");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const handleSubmit = async () => {
    if (!writeOffId) return;
    if (!reversalReason.trim()) {
      toast.error("Please enter a reversal reason.");
      return;
    }

    await reverseMutation.mutateAsync({
      action: "reverse",
      write_off_id: writeOffId,
      reversal_reason: reversalReason,
    });
  };

  return (
    <Modal
      open={!!writeOffId}
      onOpenChange={onOpenChange}
      title="Reverse Write-off Adjustment"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs font-semibold">
        <div className="flex items-start gap-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Reversing this write-off will restore the original outstanding balance on the affected bill. Please enter a valid justification reason below.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)]">Reversal Reason *</label>
          <input
            type="text"
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            placeholder="e.g. Payment recovered, Error in adjustment..."
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-colors"
          >
            Cancel
          </button>
          <AsyncButton onClick={handleSubmit} variant="destructive" className="h-9 px-4 text-xs font-bold">
            Reverse Write-off
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
