"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Landmark, Calendar, Receipt } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface BankAccount {
  id: string;
  name?: string;
  bank_name?: string;
  account_number?: string;
  current_balance?: number;
}

interface ClearChequeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: any;
  bankAccounts: BankAccount[];
  onConfirm: (payload: { cleared_date: string; received_account_id?: string }) => Promise<any>;
}

export function ClearChequeDialog({
  open,
  onOpenChange,
  cheque,
  bankAccounts,
  onConfirm,
}: ClearChequeDialogProps) {
  const [clearedDate, setClearedDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState("");

  useEffect(() => {
    if (cheque) {
      setClearedDate(cheque.cleared_date || new Date().toISOString().split("T")[0]);
      if (cheque.received_account_id) {
        setBankAccountId(cheque.received_account_id);
      } else if (bankAccounts.length > 0) {
        setBankAccountId(bankAccounts[0].id);
      }
    }
  }, [cheque, bankAccounts]);

  if (!cheque) return null;

  const isReceived = cheque.direction === "received";
  const isBillWise = cheque.settlement_type === "bill_wise" && Array.isArray(cheque.allocations) && cheque.allocations.length > 0;

  const handleClear = async () => {
    if (!clearedDate) {
      toast.error("Please specify clearing date.");
      return;
    }
    if (!bankAccountId) {
      toast.error("Please select settlement bank account.");
      return;
    }

    await onConfirm({
      cleared_date: clearedDate,
      received_account_id: bankAccountId,
    });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Clear Cheque & Realize Funds"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-2 text-xs">
        {/* Cheque Summary Badge */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-primary)]">
              Cheque #{cheque.cheque_number}
            </span>
            <span className="font-mono font-black text-sm text-[var(--text-primary)]">
              {formatCurrency(cheque.amount)}
            </span>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] space-y-0.5">
            <p>
              Party: <strong className="text-[var(--text-secondary)]">{cheque.party?.company_name || cheque.party?.name || "On Account"}</strong>
            </p>
            <p>
              Cheque Date: <strong className="text-[var(--text-secondary)]">{formatDate(cheque.cheque_date)}</strong>
            </p>
          </div>
        </div>

        {/* Settlement Bank Account */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {isReceived ? "Deposit / Realization Bank Account *" : "Drawn From Bank Account *"}
          </label>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors cursor-pointer"
          >
            <option value="">Select Settlement Bank...</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.bank_name} {b.account_number ? `(${b.account_number})` : ""} · Bal: ₹{Number(b.current_balance || 0).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </div>

        {/* Clearing Date */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Bank Clearing Date *
          </label>
          <input
            type="date"
            value={clearedDate}
            onChange={(e) => setClearedDate(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
          />
        </div>

        {/* Impact Confirmation Note */}
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Accounting Realization Notice</span>
          </div>
          <p className="leading-relaxed">
            {isBillWise ? (
              <>This will mark the allocated sales/purchase invoices as paid, create a payment voucher, and credit/debit the bank balance.</>
            ) : (
              <>This will credit/debit the party ledger balance as an advance payment and adjust your company bank account balance.</>
            )}
          </p>
        </div>

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
            onClick={handleClear}
            variant="primary"
            className="h-9 px-5 text-xs font-bold justify-center bg-emerald-600 hover:bg-emerald-700"
          >
            Confirm & Clear Cheque
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
