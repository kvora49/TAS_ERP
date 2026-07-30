"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Worker { id: string; name: string }
interface BankAccount { id: string; account_name: string; bank_name: string }

interface RecordSalaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RecordSalaryModal({ open, onOpenChange }: RecordSalaryModalProps) {
  const queryClient = useQueryClient();

  const [workerId, setWorkerId] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [baseSalary, setBaseSalary] = useState(0);
  const [allowances, setAllowances] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [paymentMode, setPaymentMode] = useState("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: formData } = useQuery<{ workers: Worker[]; bankAccounts: BankAccount[] }>({
    queryKey: ["salary-form-data"],
    queryFn: async () => {
      const res = await fetch("/api/salary?form_data=true");
      if (!res.ok) throw new Error("Failed to load salary options");
      return res.json();
    },
    enabled: open,
  });

  const workers = formData?.workers || [];
  const bankAccounts = formData?.bankAccounts || [];

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record salary");
      return json;
    },
    onSuccess: () => {
      toast.success("Salary recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["salary-list"] });
      onOpenChange(false);
      setWorkerId(""); setBaseSalary(0); setAllowances(0); setDeductions(0);
      setReferenceNo(""); setRemarks("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = async () => {
    if (!workerId) { toast.error("Please select a worker."); return; }
    if (baseSalary <= 0) { toast.error("Base salary must be greater than zero."); return; }

    await saveMutation.mutateAsync({
      worker_id: workerId,
      salary_month: month,
      salary_year: year,
      base_salary: baseSalary,
      allowances,
      deductions,
      payment_mode: paymentMode,
      payment_date: paymentDate,
      bank_account_id: bankAccountId || null,
      reference_no: referenceNo,
      remarks,
    });
  };

  const netSalary = Number(baseSalary) + Number(allowances || 0) - Number(deductions || 0);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Worker Salary"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs font-semibold">
        {/* Select Worker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)]">Select Worker *</label>
          <select
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
          >
            <option value="">Select Worker</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        {/* Salary Month & Year */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Salary Month *</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Salary Year *</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Base Salary, Allowances, Deductions */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Base Salary (₹) *</label>
            <input
              type="number"
              min="0"
              value={baseSalary || ""}
              onChange={(e) => setBaseSalary(Number(e.target.value))}
              placeholder="0.00"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs font-mono transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Allowances (+)</label>
            <input
              type="number"
              min="0"
              value={allowances || ""}
              onChange={(e) => setAllowances(Number(e.target.value))}
              placeholder="0.00"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs font-mono transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Deductions (-)</label>
            <input
              type="number"
              min="0"
              value={deductions || ""}
              onChange={(e) => setDeductions(Number(e.target.value))}
              placeholder="0.00"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs font-mono transition-colors"
            />
          </div>
        </div>

        {/* Net Salary Summary Banner */}
        <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-lg flex items-center justify-between">
          <span className="text-[var(--text-muted)] font-medium">Net Payable Salary:</span>
          <span className="font-bold text-[var(--primary)] text-sm">
            ₹{netSalary > 0 ? netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
          </span>
        </div>

        {/* Payment Mode & Paid Date */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Paid Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Bank Account Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[var(--text-muted)]">Bank Account (if non-cash)</label>
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg pl-3 pr-8 h-10 text-xs transition-colors cursor-pointer"
          >
            <option value="">Select Account</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.account_name || b.bank_name}
              </option>
            ))}
          </select>
        </div>

        {/* Reference & Remarks */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Reference / UTR #</label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Transaction ID"
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Notes..."
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 h-9 border border-[var(--border)] rounded-lg text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition-colors"
          >
            Cancel
          </button>
          <AsyncButton onClick={handleSubmit} variant="primary" className="h-9 px-4 text-xs font-bold">
            Record Salary
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
