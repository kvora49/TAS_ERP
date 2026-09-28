"use client";

import React, { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { IRP_CANCEL_REASONS } from "@/lib/einvoice";
import { toast } from "sonner";

interface CancelEInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  irn: string;
  ackDate?: string | null;
  onSuccess: () => void;
}

export function CancelEInvoiceModal({
  open,
  onOpenChange,
  invoiceId,
  irn,
  ackDate,
  onSuccess,
}: CancelEInvoiceModalProps) {
  const [reasonCode, setReasonCode] = useState<string>("2");
  const [remarks, setRemarks] = useState<string>("");

  // Calculate hours remaining out of 24 hours
  let hoursRemaining = 24;
  if (ackDate) {
    const diff = (Date.now() - new Date(ackDate).getTime()) / (1000 * 60 * 60);
    hoursRemaining = Math.max(0, Math.round((24 - diff) * 10) / 10);
  }

  const handleCancel = async () => {
    if (!remarks.trim()) {
      toast.error("Please provide cancellation remarks.");
      return;
    }

    const res = await fetch(`/api/sales/bills/${invoiceId}/einvoice/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason_code: reasonCode,
        remarks: remarks.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to cancel IRN on IRP.");
    }

    toast.success("E-Invoice (IRN) cancelled successfully!");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel GST E-Invoice (IRN)"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Warning Callout */}
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="space-y-1">
            <p className="font-bold">Irreversible Government Cancellation</p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Cancelling this IRN registers the cancellation on the government portal. Once cancelled, an IRN can never be reactivated.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-500 mt-1">
              <Clock className="h-3 w-3" />
              <span>{hoursRemaining > 0 ? `~${hoursRemaining} hours left in 24h window` : "Window expiring soon"}</span>
            </div>
          </div>
        </div>

        {/* IRN Reference */}
        <div className="p-2.5 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] text-[11px]">
          <span className="text-[var(--text-muted)] font-medium block">Active IRN to Cancel:</span>
          <span className="font-mono font-bold text-[var(--text-primary)] break-all mt-0.5 block">
            {irn}
          </span>
        </div>

        {/* Reason Code Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--text-muted)]">
            Cancellation Reason <span className="text-rose-500">*</span>
          </label>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="
              w-full bg-[var(--input-bg)]
              border border-[var(--input-border)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-faint)]
              focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
              rounded-lg px-3 h-10 text-xs font-medium
              transition-colors
            "
          >
            {Object.entries(IRP_CANCEL_REASONS).map(([code, label]) => (
              <option key={code} value={code}>
                {code} — {label}
              </option>
            ))}
          </select>
        </div>

        {/* Remarks Textarea */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--text-muted)]">
            Statutory Remarks <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter reason for cancelling this registered invoice..."
            className="
              w-full bg-[var(--input-bg)]
              border border-[var(--input-border)]
              text-[var(--text-primary)]
              placeholder:text-[var(--text-faint)]
              focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
              rounded-lg p-3 text-xs font-medium
              transition-colors
            "
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--page-bg)] border border-[var(--border)] transition-colors"
          >
            Go Back
          </button>

          <AsyncButton
            onClick={handleCancel}
            variant="destructive"
            className="h-9 px-4 text-xs font-bold"
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            <span>Confirm Cancellation</span>
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
