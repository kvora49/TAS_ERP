"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

interface ExpenseType { id: string; name: string }
interface BankAccount { id: string; account_name: string; bank_name: string }

interface RecordExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RecordExpenseModal({ open, onOpenChange }: RecordExpenseModalProps) {
  const queryClient = useQueryClient();

  const [expenseTypeId, setExpenseTypeId] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Fetch form data
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
    enabled: open,
  });

  const expenseTypes = formData?.expenseTypes || [];
  const bankAccounts = formData?.bankAccounts || [];

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save expense");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Expense recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      onOpenChange(false);
      // Reset
      setExpenseTypeId("");
      setAmount(0);
      setVendorName("");
      setVendorInvoiceNo("");
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

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

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Operating Expense"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs font-semibold">
        {/* Category + Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Expense Category *</label>
            <select
              value={expenseTypeId}
              onChange={(e) => setExpenseTypeId(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
            >
              <option value="">Select Category</option>
              {expenseTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Expense Date *</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Taxable Amount + GST % */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Taxable Amount (₹) *</label>
            <input
              type="number"
              min="0"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0.00"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs font-mono transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">GST Rate (%)</label>
            <select
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
            >
              <option value={0}>0% (Exempt)</option>
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18%</option>
              <option value={28}>28%</option>
            </select>
          </div>
        </div>

        {/* GST Amount & Total Summary Banner */}
        <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-lg flex items-center justify-between">
          <span className="text-[var(--text-muted)]">GST Amount: ₹{gstAmount.toFixed(2)}</span>
          <span className="font-bold text-[var(--text-primary)] text-sm">Total: ₹{totalAmount.toFixed(2)}</span>
        </div>

        {/* Paid From Account */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)]">Paid From (Bank / Cash Account)</label>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
          >
            <option value="">Cash / Unpaid Pending</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name || b.bank_name}
              </option>
            ))}
          </select>
        </div>

        {/* Vendor Name & Invoice No */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Vendor Name</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Supplier / Store name"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Vendor Invoice #</label>
            <input
              type="text"
              value={vendorInvoiceNo}
              onChange={(e) => setVendorInvoiceNo(e.target.value)}
              placeholder="Bill reference #"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)]">Notes / Remarks</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg p-3 text-xs transition-colors"
          />
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-colors"
          >
            Cancel
          </button>
          <AsyncButton onClick={handleSubmit} variant="primary" className="h-9 px-4 text-xs font-bold">
            Record Expense
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
