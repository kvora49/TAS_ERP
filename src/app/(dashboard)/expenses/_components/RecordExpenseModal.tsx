"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

interface ExpenseType {
  id: string;
  name: string;
}

interface BankAccount {
  id: string;
  name?: string;
  account_name?: string;
  bank_name?: string;
  type?: string;
  account_category?: string;
}

interface RecordExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseTypes?: ExpenseType[];
  bankAccounts?: BankAccount[];
}

export default function RecordExpenseModal({
  open,
  onOpenChange,
  expenseTypes: initialExpenseTypes,
  bankAccounts: initialBankAccounts,
}: RecordExpenseModalProps) {
  const queryClient = useQueryClient();

  const { data: formData } = useQuery<{
    expenseTypes: ExpenseType[];
    bankAccounts: BankAccount[];
  }>({
    queryKey: ["expense-form-data"],
    queryFn: async () => {
      const res = await fetch("/api/expenses?form_data=true");
      if (!res.ok) throw new Error("Failed to load expense options");
      return res.json();
    },
    enabled: open && (!initialExpenseTypes || !initialBankAccounts),
  });

  const expenseTypes = initialExpenseTypes || formData?.expenseTypes || [];
  const bankAccounts = initialBankAccounts || formData?.bankAccounts || [];

  const [expenseTypeId, setExpenseTypeId] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [amount, setAmount] = useState<number>(0);
  const [gstPercent, setGstPercent] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to record expense");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Expense recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["expenses-tab-data"] });
      queryClient.invalidateQueries({ queryKey: ["master-data", "banks-upi"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const resetForm = () => {
    setExpenseTypeId("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setAmount(0);
    setGstPercent(0);
    setBankAccountId("");
    setVendorName("");
    setVendorInvoiceNo("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!expenseTypeId) {
      toast.error("Please select an expense category.");
      return;
    }
    if (amount <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    await saveMutation.mutateAsync({
      expense_type_id: expenseTypeId,
      expense_date: expenseDate,
      amount,
      gst_percent: gstPercent,
      paid_from_account_id: bankAccountId || null,
      vendor_name: vendorName,
      vendor_invoice_no: vendorInvoiceNo,
      notes,
    });
  };

  const gstAmount = (amount * gstPercent) / 100;
  const totalAmount = amount + gstAmount;
  const selectedAccount = bankAccounts.find((b) => b.id === bankAccountId);
  const isBank = selectedAccount?.type === "bank";
  const isUpi = selectedAccount?.type === "upi";
  const isCash = selectedAccount?.type === "cash" || !bankAccountId;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Operating Expense"
      description="Record company expenses, utilities, supplies, or maintenance with automated GST accounting."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 pt-1 text-xs font-semibold">
        {/* Row 1: Category + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Expense Category *
            </label>
            <select
              value={expenseTypeId}
              onChange={(e) => setExpenseTypeId(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors cursor-pointer"
            >
              <option value="">Select Expense Category</option>
              {expenseTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Expense Date *
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Row 2: Taxable Amount + GST % */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Taxable Amount (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs font-mono font-bold transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              GST Rate (%)
            </label>
            <select
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors cursor-pointer"
            >
              <option value={0}>0% (Exempt / Nil Rated)</option>
              <option value={5}>5% (Standard Rate)</option>
              <option value={12}>12% (Standard Rate)</option>
              <option value={18}>18% (Standard Rate)</option>
              <option value={28}>28% (Luxury / Higher Rate)</option>
            </select>
          </div>
        </div>

        {/* Dynamic GST & Total Summary Banner */}
        <div className="p-3.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-[var(--text-muted)] text-xs font-medium">
              Tax Component: <strong className="text-[var(--text-primary)] font-mono font-bold">₹{gstAmount.toFixed(2)}</strong>
            </span>
            {gstPercent > 0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                GST @ {gstPercent}%
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] mr-2">Total Payable:</span>
            <span className="font-black text-[var(--text-primary)] text-base font-mono">
              ₹{totalAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Row 3: Paid From Account (Auto-Adjusts layout & hints) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Paid From (Bank / Cash Account)
            </label>
            {isBank && (
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                🏦 Bank Account Settlement
              </span>
            )}
            {isUpi && (
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                📱 UPI Direct Transfer
              </span>
            )}
            {isCash && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                💵 Cash / Petty Cash
              </span>
            )}
          </div>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors cursor-pointer"
          >
            <option value="">Cash / Unpaid Pending</option>
            {bankAccounts.map((b) => {
              const typeLabel = b.type === "bank" ? "Bank" : b.type === "upi" ? "UPI" : "Cash";
              const catLabel = b.account_category ? b.account_category.toUpperCase() : "";
              const prefix = catLabel ? `[${typeLabel} · ${catLabel}] ` : `[${typeLabel}] `;
              return (
                <option key={b.id} value={b.id}>
                  {prefix}{b.name || b.account_name} {b.bank_name ? `(${b.bank_name})` : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Row 4: Vendor & Invoice Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Vendor / Payee Name
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Reliance Energy, Amazon Supplies"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Vendor Invoice / Bill #
            </label>
            <input
              type="text"
              value={vendorInvoiceNo}
              onChange={(e) => setVendorInvoiceNo(e.target.value)}
              placeholder="Bill reference #"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs font-mono transition-colors"
            />
          </div>
        </div>

        {/* Row 5: Notes */}
        <div className="flex flex-col gap-1.5 pb-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Notes / Internal Remarks
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional expense details, justification, or reference..."
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl p-3 text-xs transition-colors"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-10 border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <AsyncButton onClick={handleSubmit} variant="primary" className="h-10 px-6 text-xs font-bold">
            Record Expense
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
