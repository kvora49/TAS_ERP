"use client";

import React, { useState } from "react";
import { AlertTriangle, Receipt } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { toast } from "sonner";

interface BounceChequeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: any;
  onBounce: (data: {
    bounce_reason: string;
    bounce_charges: number;
    debit_party: boolean;
  }) => Promise<any>;
}

const COMMON_BOUNCE_REASONS = [
  "Insufficient Funds",
  "Signature Differs / Incomplete",
  "Account Closed",
  "Payment Stopped by Drawer",
  "Stale Cheque (Exceeded 3 Months Validity)",
  "Post-Dated Cheque Presented Early",
  "Words and Figures Differ",
  "Cheque Mutilated / Alteration Not Verified",
  "Other Reason",
];

export function BounceChequeDialog({
  open,
  onOpenChange,
  cheque,
  onBounce,
}: BounceChequeDialogProps) {
  const [selectedReason, setSelectedReason] = useState(COMMON_BOUNCE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [bounceCharges, setBounceCharges] = useState<number | "">(250);
  const [debitParty, setDebitParty] = useState(true);

  if (!cheque) return null;

  const effectiveReason = selectedReason === "Other Reason" ? customReason : selectedReason;

  const handleSubmit = async () => {
    if (!effectiveReason.trim()) {
      toast.error("Please specify a reason for bounce.");
      return;
    }

    await onBounce({
      bounce_reason: effectiveReason.trim(),
      bounce_charges: Number(bounceCharges || 0),
      debit_party: debitParty,
    });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Record Dishonor (Bounce) — Cheque #${cheque.cheque_number}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-2 text-xs">
        {/* Warning Banner */}
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Cheque Dishonor Reversal Notice</span>
            <p className="text-[11px] leading-relaxed">
              Marking this cheque as bounced will reverse any realization, roll back settled invoices back to unpaid, and register a bounce incident on the party record.
            </p>
          </div>
        </div>

        {/* Reason Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Bank Return / Dishonor Reason *
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors cursor-pointer"
          >
            {COMMON_BOUNCE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {selectedReason === "Other Reason" && (
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Specify Custom Reason *
            </label>
            <input
              type="text"
              placeholder="e.g. Drawers authority to operate cancelled"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        )}

        {/* Bounce Penalty Charges */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Bank Bounce Penalty Fee (₹)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={bounceCharges}
            onChange={(e) => setBounceCharges(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0.00"
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs font-mono font-bold transition-colors"
          />
        </div>

        {/* Debit Note to Party Checkbox */}
        {Number(bounceCharges || 0) > 0 && (
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] flex items-start gap-2.5">
            <input
              type="checkbox"
              id="debitPartyCheckbox"
              checked={debitParty}
              onChange={(e) => setDebitParty(e.target.checked)}
              className="mt-0.5 rounded border-[var(--input-border)] text-[var(--primary)] focus:ring-[var(--input-focus)] cursor-pointer"
            />
            <label htmlFor="debitPartyCheckbox" className="cursor-pointer space-y-0.5">
              <span className="font-bold text-[var(--text-primary)] block">
                Charge penalty to party ledger (Generate Debit Note)
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block leading-relaxed">
                Automatically creates a Debit Note of ₹{Number(bounceCharges || 0).toLocaleString("en-IN")} against {cheque.party?.name || "the party"} so they are accountable for bank charges.
              </span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 rounded-xl border border-[var(--border)] text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer"
          >
            Cancel
          </button>
          <AsyncButton
            onClick={handleSubmit}
            variant="destructive"
            className="h-9 px-5 text-xs font-bold justify-center"
          >
            Confirm Bounce Incident
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
