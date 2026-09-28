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
interface BankAccount { id: string; name?: string; account_name?: string; bank_name?: string; type?: string; account_category?: string }

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

  const isCash = paymentMode === "cash";
  const isCheque = paymentMode === "cheque";
  const isUpi = paymentMode === "upi";
  const isBankTransfer = paymentMode === "bank_transfer";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record Worker Salary & Payroll"
      description="Calculate net salary with allowances and deductions, and disburse via cash, bank transfer, or cheque."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 pt-1 text-xs font-semibold">
        {/* Row 1: Worker + Payment Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Select Worker *
            </label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors cursor-pointer"
            >
              <option value="">Select Worker</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Disbursement Date *
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors"
            />
          </div>
        </div>

        {/* Row 2: Salary Month & Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Salary Month *
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors cursor-pointer"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Salary Year *
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs font-mono transition-colors"
            />
          </div>
        </div>

        {/* Row 3: Base Salary, Allowances, Deductions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Base Salary (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={baseSalary || ""}
              onChange={(e) => setBaseSalary(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs font-mono font-bold transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Allowances (+) (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={allowances || ""}
              onChange={(e) => setAllowances(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs font-mono font-bold transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Deductions (-) (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deductions || ""}
              onChange={(e) => setDeductions(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs font-mono font-bold transition-colors"
            />
          </div>
        </div>

        {/* Dynamic Net Salary Summary Banner */}
        <div className="p-3.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-xs">
              Formula: Base (₹{baseSalary || 0}) + Bonus (₹{allowances || 0}) - Deductions (₹{deductions || 0})
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] mr-2">Net Payable:</span>
            <span className="font-black text-[var(--primary)] text-base font-mono">
              ₹{netSalary > 0 ? netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
            </span>
          </div>
        </div>

        {/* Row 4: Payment Mode (Auto-Adjusts downstream fields) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Payment Mode *
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors cursor-pointer"
            >
              <option value="bank_transfer">🏦 Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="cash">💵 Cash / Petty Cash Register</option>
              <option value="cheque">📝 Bank Cheque</option>
              <option value="upi">📱 UPI Payout</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {isCash ? "Cash Account / Drawer" : isCheque ? "Issuing Bank Account *" : "Disbursement Account *"}
              </label>
              {isCash && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  Cash Register
                </span>
              )}
              {isBankTransfer && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  Corporate Bank
                </span>
              )}
              {isCheque && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  Cheque Book Account
                </span>
              )}
              {isUpi && (
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                  Linked UPI
                </span>
              )}
            </div>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors cursor-pointer"
            >
              <option value="">{isCash ? "Main Cash Register (Default)" : "Select Account"}</option>
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
        </div>

        {/* Row 5: Reference & Remarks (Auto-Adjusted Labels & Placeholders) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {isCheque
                ? "Cheque Leaf Number *"
                : isUpi
                ? "UPI Transaction ID *"
                : isBankTransfer
                ? "Bank UTR / Ref Number *"
                : "Receipt / Voucher # (Optional)"}
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder={
                isCheque
                  ? "e.g. 000451"
                  : isUpi
                  ? "e.g. UPI/123456789"
                  : isBankTransfer
                  ? "e.g. UTR12345678"
                  : "e.g. CASH-SLIP-01"
              }
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs font-mono transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Internal Payroll Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Monthly salary with overtime incentive"
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-xl px-3.5 h-11 text-xs transition-colors"
            />
          </div>
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
            Record Salary
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
