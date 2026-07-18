"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export default function ProcessSalaryPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedWorker, setSelectedWorker] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalWorker, setModalWorker] = useState<any>(null);
  const [grossSalary, setGrossSalary] = useState(0);
  const [selectedAdvances, setSelectedAdvances] = useState<Set<string>>(new Set());
  const [otherDeductions, setOtherDeductions] = useState(0);
  const [deductionReason, setDeductionReason] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState("bank_transfer");

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Fetch workers with pending salary
  const { data: workersData, isLoading } = useQuery({
    queryKey: ["salary-process-workers", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/salary?form_data=true`);
      if (!res.ok) throw new Error("Failed to load workers");
      return res.json();
    },
  });

  // Fetch existing processed salaries for this month/year
  const { data: processedData } = useQuery({
    queryKey: ["salary-processed", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/salary`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Fetch advances for modal worker
  const { data: advancesData } = useQuery({
    queryKey: ["employee-advances", modalWorker?.id],
    queryFn: async () => {
      if (!modalWorker?.id) return { advances: [] };
      const res = await fetch(`/api/salary/advances?worker_id=${modalWorker.id}`);
      if (!res.ok) throw new Error("Failed to load advances");
      return res.json();
    },
    enabled: !!modalWorker?.id,
  });

  // Fetch bank accounts
  const { data: formData } = useQuery({
    queryKey: ["salary-form-data-process"],
    queryFn: async () => {
      const res = await fetch(`/api/salary?form_data=true`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: showModal,
  });

  const processMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Salary processed & paid successfully!");
      queryClient.invalidateQueries({ queryKey: ["salary-processed"] });
      queryClient.invalidateQueries({ queryKey: ["salary-list"] });
      queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
      setShowModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const workers = workersData?.workers || [];
  const bankAccounts = formData?.bankAccounts || [];
  const processedSalaries = processedData?.salaries || [];
  const advances = (advancesData?.advances || []).filter((a: any) => !a.is_settled);

  const processedWorkerIds = new Set(
    processedSalaries
      .filter((s: any) => s.salary_month === month && s.salary_year === year)
      .map((s: any) => s.worker?.id)
  );

  const filteredWorkers = selectedWorker
    ? workers.filter((w: any) => w.id === selectedWorker)
    : workers;

  const openModal = (worker: any) => {
    setModalWorker(worker);
    setGrossSalary(0);
    setSelectedAdvances(new Set());
    setOtherDeductions(0);
    setDeductionReason("");
    setShowModal(true);
  };

  const advanceDeducted = advances
    .filter((a: any) => selectedAdvances.has(a.id))
    .reduce((s: number, a: any) => s + Number(a.amount), 0);

  const netSalary = Math.max(0, grossSalary - advanceDeducted - otherDeductions);

  const handleProcess = async (): Promise<void> => {
    if (!modalWorker) return;
    if (grossSalary <= 0) { void toast.error("Gross salary must be > 0"); return; }
    if (!paymentDate) { void toast.error("Payment date required"); return; }

    await processMutation.mutateAsync({
      worker_id: modalWorker.id,
      salary_month: month,
      salary_year: year,
      base_salary: grossSalary,
      allowances: 0,
      deductions: advanceDeducted + otherDeductions,
      net_salary: netSalary,
      payment_mode: paymentMode,
      payment_date: paymentDate,
      bank_account_id: paymentMode !== "cash" ? bankAccountId || null : null,
      remarks: deductionReason || null,
    });
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

  return (
    <PageState isLoading={isLoading} error={undefined}>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Process Salary</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Salary Management
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
            {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}
            className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none min-w-[200px]">
            <option value="">All Workers</option>
            {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Workers table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              Workers — {MONTHS[month - 1]} {year}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Worker</th>
                  <th className="py-3 px-6">Type</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {filteredWorkers.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-slate-400 font-semibold">No workers found.</td></tr>
                ) : (
                  filteredWorkers.map((worker: any) => {
                    const isProcessed = processedWorkerIds.has(worker.id);
                    return (
                      <tr key={worker.id} className="hover:bg-slate-50/50 h-14">
                        <td className="py-3 px-6 font-bold text-slate-900">{worker.name}</td>
                        <td className="py-3 px-6 capitalize text-slate-500">{(worker.type || []).join(", ")}</td>
                        <td className="py-3 px-6">
                          {isProcessed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <CheckCircle2 className="h-3 w-3" /> Processed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                              <AlertCircle className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-right">
                          {isProcessed ? (
                            <span className="text-xs text-slate-400 font-semibold">Done</span>
                          ) : (
                            <Button onClick={() => openModal(worker)}
                              className="h-8 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg px-3">
                              Process & Pay
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Process Modal */}
      {showModal && modalWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Process Salary — {modalWorker.name}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs font-semibold overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Gross Salary (₹) *</label>
                  <input type="number" value={grossSalary || ""} placeholder="0.00"
                    onChange={(e) => setGrossSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Payment Date *</label>
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                </div>
              </div>

              {/* Pending Advances */}
              {advances.length > 0 && (
                <div className="border border-amber-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                      Pending Advances — Check to Deduct
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {advances.map((adv: any) => (
                      <label key={adv.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox"
                          checked={selectedAdvances.has(adv.id)}
                          onChange={() => {
                            setSelectedAdvances(prev => {
                              const next = new Set(prev);
                              if (next.has(adv.id)) next.delete(adv.id);
                              else next.add(adv.id);
                              return next;
                            });
                          }}
                          className="h-4 w-4 accent-[var(--primary)]" />
                        <span className="flex-1 text-slate-700">{new Date(adv.advance_date).toLocaleDateString("en-IN")}</span>
                        <span className="font-bold text-rose-600">{fmt(adv.amount)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Other Deductions (₹)</label>
                  <input type="number" value={otherDeductions || ""} placeholder="0.00"
                    onChange={(e) => setOtherDeductions(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Deduction Reason</label>
                  <input type="text" value={deductionReason} placeholder="e.g. Absent"
                    onChange={(e) => setDeductionReason(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                </div>
              </div>

              {/* Net Salary Preview */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Salary</span>
                  <span className="font-bold">{fmt(grossSalary)}</span>
                </div>
                {advanceDeducted > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Advance Deductions</span>
                    <span className="font-bold">-{fmt(advanceDeducted)}</span>
                  </div>
                )}
                {otherDeductions > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Other Deductions</span>
                    <span className="font-bold">-{fmt(otherDeductions)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-extrabold text-slate-700 uppercase tracking-wide">Net Salary</span>
                  <span className="text-base font-extrabold text-[var(--primary)]">{fmt(netSalary)}</span>
                </div>
                {netSalary < grossSalary && (
                  <p className="text-[10px] text-slate-400">Net salary capped at ₹0 — deductions cannot exceed gross salary.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Payment Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                {paymentMode !== "cash" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Bank Account</label>
                    <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                      <option value="">-- Select --</option>
                      {bankAccounts.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.account_name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
              <Button variant="outline" onClick={() => setShowModal(false)} className="h-9 text-xs font-bold">Cancel</Button>
              <AsyncButton onClick={handleProcess}
                className="h-9 px-4 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg">
                Process & Pay {fmt(netSalary)}
              </AsyncButton>
            </div>
          </div>
        </div>
      )}
    </PageState>
  );
}
