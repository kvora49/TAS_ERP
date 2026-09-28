"use client";

import React, { useState, useEffect } from "react";
import { Landmark, Calendar } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BankAccount {
  id: string;
  name?: string;
  bank_name?: string;
  account_number?: string;
  current_balance?: number;
}

interface DepositChequeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: any;
  bankAccounts: BankAccount[];
  onDeposit: (data: { received_account_id: string; deposited_date: string }) => Promise<any>;
}

export function DepositChequeDialog({
  open,
  onOpenChange,
  cheque,
  bankAccounts,
  onDeposit,
}: DepositChequeDialogProps) {
  const [receivedAccountId, setReceivedAccountId] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (cheque) {
      setDepositDate(cheque.deposited_date || new Date().toISOString().split("T")[0]);
      if (cheque.received_account_id) {
        setReceivedAccountId(cheque.received_account_id);
      } else if (bankAccounts.length > 0) {
        setReceivedAccountId(bankAccounts[0].id);
      }
    }
  }, [cheque, bankAccounts]);

  if (!cheque) return null;

  const isReceived = cheque.direction === "received";

  const handleSubmit = async () => {
    if (!receivedAccountId) {
      toast.error(
        isReceived
          ? "Please select a target company bank account."
          : "Please select the company bank account drawn for this cheque."
      );
      return;
    }
    if (!depositDate) {
      toast.error("Please select a deposit or presentation date.");
      return;
    }

    await onDeposit({
      received_account_id: receivedAccountId,
      deposited_date: depositDate,
    });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        isReceived
          ? `Deposit Cheque #${cheque.cheque_number} to Bank`
          : `Record Cheque Presentation / Deposit #${cheque.cheque_number}`
      }
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-2 text-xs">
        {/* Cheque Info */}
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--text-primary)]">
              {cheque.party?.company_name || cheque.party?.name || (isReceived ? "Customer Cheque" : "Payee Cheque")}
            </span>
            <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
              {formatCurrency(cheque.amount)}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {isReceived ? "Drawee Bank" : "Bank"}: {cheque.bank_name} · Dated: {formatDate(cheque.cheque_date)}
          </p>
        </div>

        {/* Deposit Bank Account */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {isReceived ? "Target Company Bank Account *" : "Company Bank Account (Drawn On) *"}
          </label>
          <select
            value={receivedAccountId}
            onChange={(e) => setReceivedAccountId(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors cursor-pointer"
          >
            <option value="">Select Bank Account...</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.bank_name} {b.account_number ? `(${b.account_number})` : ""} · Bal: ₹{Number(b.current_balance || 0).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </div>

        {/* Deposit Date */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {isReceived ? "Bank Deposit Date *" : "Presentation / Clearing Date *"}
          </label>
          <input
            type="date"
            value={depositDate}
            onChange={(e) => setDepositDate(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-xs transition-colors"
          />
        </div>

        {/* Notice */}
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 text-[11px] leading-relaxed">
          {isReceived ? (
            <>
              The cheque will be marked as <strong>Deposited</strong>. Once the bank clears the payment, click <strong>Clear</strong> to realize funds into your bank ledger.
            </>
          ) : (
            <>
              The issued cheque will be marked as <strong>Deposited</strong> (presented in bank clearing). Once debited from your bank account statement, click <strong>Clear Cheque</strong> to record fund debit in your ledger.
            </>
          )}
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
            onClick={handleSubmit}
            variant="primary"
            className="h-9 px-5 text-xs font-bold justify-center"
          >
            {isReceived ? "Confirm Bank Deposit" : "Mark as Deposited"}
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
