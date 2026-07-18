"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, Loader2, Users, TrendingDown, TrendingUp, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Worker { id: string; name: string }
interface BankAccount { id: string; account_name: string; bank_name: string }
interface SalaryEntry {
  id: string;
  salary_month: number;
  salary_year: number;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  payment_mode: string;
  payment_date: string;
  reference_no: string | null;
  remarks: string | null;
  worker: { id: string; name: string } | null;
}

export default function SalaryPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Filter state
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(0); // 0 = all

  // Form state
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

  const { data: listData, isLoading, error } = useQuery<{ salaries: SalaryEntry[] }>({
    queryKey: ["salary-list"],
    queryFn: async () => {
      const res = await fetch("/api/salary");
      if (!res.ok) throw new Error("Failed to load salary records");
      return res.json();
    },
  });

  const { data: formData } = useQuery<{ workers: Worker[]; bankAccounts: BankAccount[] }>({
    queryKey: ["salary-form-data"],
    queryFn: async () => {
      const res = await fetch("/api/salary?form_data=true");
      if (!res.ok) throw new Error("Failed to load form options");
      return res.json();
    },
    enabled: showModal,
  });

  const allSalaries = listData?.salaries || [];
  const salaries = allSalaries.filter((s) => {
    if (filterMonth > 0 && s.salary_month !== filterMonth) return false;
    if (s.salary_year !== filterYear) return false;
    return true;
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
      setShowModal(false);
      setWorkerId(""); setBaseSalary(0); setAllowances(0); setDeductions(0);
      setReferenceNo(""); setRemarks("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = async (): Promise<void> => {
    if (!workerId) { void toast.error("Select a worker."); return; }
    if (baseSalary <= 0) { void toast.error("Base salary must be > 0."); return; }
    await saveMutation.mutateAsync({
      worker_id: workerId, salary_month: month, salary_year: year,
      base_salary: baseSalary, allowances, deductions,
      payment_mode: paymentMode, payment_date: paymentDate,
      bank_account_id: bankAccountId || null, reference_no: referenceNo, remarks,
    });
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);

  const totalNet = salaries.reduce((s, e) => s + Number(e.net_salary), 0);
  const totalAllowances = salaries.reduce((s, e) => s + Number(e.allowances), 0);
  const totalDeductions = salaries.reduce((s, e) => s + Number(e.deductions), 0);

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Salary Management</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Worker Salaries
            </p>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white h-9 rounded-lg px-4"
          >
            <Plus className="h-4 w-4" />
            Record Salary
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
          >
            <option value={0}>All Months</option>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Net Salary Paid", val: totalNet, color: "text-slate-900", icon: <Users className="h-5 w-5" /> },
            { label: "Total Allowances", val: totalAllowances, color: "text-emerald-600", icon: <TrendingUp className="h-5 w-5" /> },
            { label: "Total Deductions", val: totalDeductions, color: "text-rose-600", icon: <TrendingDown className="h-5 w-5" /> },
            { label: "Entries", val: salaries.length, color: "text-blue-600", icon: <CheckCircle className="h-5 w-5" />, isCount: true },
          ].map((card, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className={`p-3 bg-slate-50 rounded-lg ${card.color}`}>{card.icon}</div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{card.label}</span>
                <p className={`text-xl font-bold mt-0.5 ${card.color}`}>
                  {card.isCount ? card.val : fmt(Number(card.val))}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Worker</th>
                  <th className="py-3 px-6">Month / Year</th>
                  <th className="py-3 px-6 text-right">Base Salary</th>
                  <th className="py-3 px-6 text-right">Allowances</th>
                  <th className="py-3 px-6 text-right">Deductions</th>
                  <th className="py-3 px-6 text-right">Net Salary</th>
                  <th className="py-3 px-6">Mode</th>
                  <th className="py-3 px-6">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {salaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-semibold">
                      No salary records for the selected period.
                    </td>
                  </tr>
                ) : (
                  salaries.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 h-14">
                      <td className="py-3 px-6 font-bold text-slate-900">{s.worker?.name || "—"}</td>
                      <td className="py-3 px-6">{MONTHS[s.salary_month - 1]} {s.salary_year}</td>
                      <td className="py-3 px-6 text-right font-mono">{fmt(s.base_salary)}</td>
                      <td className="py-3 px-6 text-right font-mono text-emerald-600">+{fmt(s.allowances)}</td>
                      <td className="py-3 px-6 text-right font-mono text-rose-600">-{fmt(s.deductions)}</td>
                      <td className="py-3 px-6 text-right font-bold font-mono text-slate-900">{fmt(s.net_salary)}</td>
                      <td className="py-3 px-6 capitalize">{s.payment_mode.replace(/_/g, " ")}</td>
                      <td className="py-3 px-6 font-mono text-slate-500">
                        {new Date(s.payment_date).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Salary Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Record Worker Salary</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs font-semibold">
              {/* Worker + Period */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 flex flex-col gap-1.5">
                  <label className="text-slate-600">Select Worker *</label>
                  <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                    <option value="">-- Select Worker --</option>
                    {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Month *</label>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                    {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-slate-600">Year *</label>
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              {/* Salary breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Base Salary (₹) *", val: baseSalary, set: setBaseSalary },
                  { label: "Allowances (₹)", val: allowances, set: setAllowances },
                  { label: "Deductions (₹)", val: deductions, set: setDeductions },
                ].map(({ label, val, set }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="text-slate-600">{label}</label>
                    <input type="number" placeholder="0.00" value={val || ""}
                      onChange={(e) => set(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                  </div>
                ))}
              </div>
              {/* Net preview */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between border border-slate-100">
                <span className="text-slate-500">Net Salary (Preview)</span>
                <span className="text-base font-extrabold text-[var(--primary)]">
                  {fmt(baseSalary + allowances - deductions)}
                </span>
              </div>
              {/* Payment details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Payment Mode *</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Payment Date *</label>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                </div>
              </div>
              {paymentMode !== "cash" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Bank Account</label>
                    <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                      <option value="">-- Select Account --</option>
                      {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.account_name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Reference / UTR</label>
                    <input type="text" placeholder="e.g. UTR12345" value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600">Remarks</label>
                <textarea rows={2} value={remarks} placeholder="Optional notes..."
                  onChange={(e) => setRemarks(e.target.value)}
                  className="p-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none resize-none w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowModal(false)}
                className="h-9 text-xs font-bold">Cancel</Button>
              <AsyncButton onClick={handleSubmit}
                className="h-9 px-4 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg">
                Record Salary
              </AsyncButton>
            </div>
          </div>
        </div>
      )}
    </PageState>
  );
}
