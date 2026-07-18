"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, CheckCircle2, Clock, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

export default function EmployeeAdvancesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [notes, setNotes] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["employee-advances-all"],
    queryFn: async () => {
      const res = await fetch("/api/salary/advances");
      if (!res.ok) throw new Error("Failed to load advances");
      return res.json();
    },
  });

  const { data: workersData } = useQuery({
    queryKey: ["workers-list-advances"],
    queryFn: async () => {
      const res = await fetch("/api/salary?form_data=true");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/salary/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      toast.success("Advance recorded!");
      queryClient.invalidateQueries({ queryKey: ["employee-advances-all"] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setWorkerId("");
    setAdvanceDate(new Date().toISOString().split("T")[0]);
    setAmount(0);
    setPaymentMode("cash");
    setNotes("");
  };

  const handleSubmit = async (): Promise<void> => {
    if (!workerId) { void toast.error("Select a worker."); return; }
    if (amount <= 0) { void toast.error("Amount must be > 0."); return; }
    await addMutation.mutateAsync({ worker_id: workerId, advance_date: advanceDate, amount, payment_mode: paymentMode, notes });
  };

  const advances = data?.advances || [];
  const workers = workersData?.workers || [];

  const totalAdvances = advances.reduce((s: number, a: any) => s + Number(a.amount), 0);
  const settledAdvances = advances.filter((a: any) => a.is_settled).reduce((s: number, a: any) => s + Number(a.amount), 0);
  const unsettledAdvances = totalAdvances - settledAdvances;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Employee Advance Tracker</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Salary
            </p>
          </div>
          <Button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 h-9 px-4 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg">
            <Plus className="h-4 w-4" /> Record Advance
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Advances", value: totalAdvances, icon: <IndianRupee className="h-5 w-5" />, color: "blue" },
            { label: "Settled", value: settledAdvances, icon: <CheckCircle2 className="h-5 w-5" />, color: "emerald" },
            { label: "Unsettled", value: unsettledAdvances, icon: <Clock className="h-5 w-5" />, color: "amber" },
          ].map((s) => (
            <div key={s.label} className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4 border-l-4 border-l-${s.color}-500`}>
              <div className={`p-3 bg-${s.color}-50 rounded-lg text-${s.color}-600`}>{s.icon}</div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{s.label}</span>
                <p className={`text-xl font-bold text-${s.color}-600 mt-0.5`}>{fmt(s.value)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">All Advances</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Worker</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                  <th className="py-3 px-6">Mode</th>
                  <th className="py-3 px-6">Notes</th>
                  <th className="py-3 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {advances.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-slate-400">No advances recorded.</td></tr>
                ) : (
                  advances.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 h-12">
                      <td className="py-3 px-6 font-bold text-slate-900">{a.worker?.name || "—"}</td>
                      <td className="py-3 px-6 font-mono text-slate-500">
                        {new Date(a.advance_date).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" })}
                      </td>
                      <td className="py-3 px-6 text-right font-bold font-mono">{fmt(a.amount)}</td>
                      <td className="py-3 px-6 capitalize text-slate-500">{a.payment_mode?.replace(/_/g, " ") || "—"}</td>
                      <td className="py-3 px-6 text-slate-500">{a.notes || "—"}</td>
                      <td className="py-3 px-6">
                        {a.is_settled ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">Settled</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100">Unsettled</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Advance Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Record Employee Advance</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs font-semibold">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600">Worker *</label>
                <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                  <option value="">-- Select Worker --</option>
                  {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Date *</label>
                  <input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Amount (₹) *</label>
                  <input type="number" value={amount || ""} placeholder="0.00"
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600">Payment Mode</label>
                <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none">
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600">Notes</label>
                <input type="text" value={notes} placeholder="Optional"
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }} className="h-9 text-xs font-bold">Cancel</Button>
              <AsyncButton onClick={handleSubmit}
                className="h-9 px-4 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg">
                Record Advance
              </AsyncButton>
            </div>
          </div>
        </div>
      )}
    </PageState>
  );
}
