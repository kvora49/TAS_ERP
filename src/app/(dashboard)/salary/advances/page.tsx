"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, CheckCircle2, Clock, IndianRupee, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

import { Modal } from "@/components/shared/Modal";

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
      <div className="p-3.5 sm:p-6 space-y-5 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/expenses?tab=salary"
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] border border-[var(--border)] transition-colors"
              title="Back to Salary & Expenses Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Employee Advance Tracker</h1>
              <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                Payments & Finance / Salary Advances
              </p>
            </div>
          </div>
          <Button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 h-9 px-3.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg cursor-pointer">
            <Plus className="h-4 w-4" /> Record Advance
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Advances", value: totalAdvances, icon: <IndianRupee className="h-4 w-4" />, colorClass: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
            { label: "Settled", value: settledAdvances, icon: <CheckCircle2 className="h-4 w-4" />, colorClass: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
            { label: "Unsettled", value: unsettledAdvances, icon: <Clock className="h-4 w-4" />, colorClass: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] flex items-center gap-3">
              <div className={`p-2.5 rounded-lg border ${s.colorClass}`}>{s.icon}</div>
              <div>
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide block">{s.label}</span>
                <p className="text-lg font-black font-mono text-[var(--text-primary)] mt-0.5">{fmt(s.value)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table Container */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="px-4 sm:px-6 py-3.5 border-b border-[var(--border-light)] bg-[var(--table-header-bg)] flex justify-between items-center">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">All Advances</h3>
            <span className="text-xs font-mono text-[var(--text-muted)]">{advances.length} records</span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Worker</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                  <th className="py-3 px-6">Mode</th>
                  <th className="py-3 px-6">Notes</th>
                  <th className="py-3 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)] font-medium text-[var(--text-body)]">
                {advances.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-[var(--text-muted)] font-semibold">No advances recorded.</td></tr>
                ) : (
                  advances.map((a: any) => (
                    <tr key={a.id} className="hover:bg-[var(--table-row-hover)] h-12">
                      <td className="py-3 px-6 font-bold text-[var(--text-primary)]">{a.worker?.name || "—"}</td>
                      <td className="py-3 px-6 font-mono text-[var(--text-muted)]">
                        {new Date(a.advance_date).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" })}
                      </td>
                      <td className="py-3 px-6 text-right font-bold font-mono text-rose-600">{fmt(a.amount)}</td>
                      <td className="py-3 px-6 capitalize text-[var(--text-muted)]">{a.payment_mode?.replace(/_/g, " ") || "—"}</td>
                      <td className="py-3 px-6 text-[var(--text-muted)]">{a.notes || "—"}</td>
                      <td className="py-3 px-6">
                        {a.is_settled ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Settled</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">Unsettled</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Advances Cards */}
          <div className="md:hidden divide-y divide-[var(--border-light)]">
            {advances.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">No advances recorded.</div>
            ) : (
              advances.map((a: any) => (
                <div key={a.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--text-primary)]">{a.worker?.name || "—"}</span>
                    {a.is_settled ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Settled</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">Unsettled</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">
                      {new Date(a.advance_date).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" })} · <span className="capitalize">{a.payment_mode?.replace(/_/g, " ") || "cash"}</span>
                    </span>
                    <span className="font-mono font-bold text-rose-600">{fmt(a.amount)}</span>
                  </div>
                  {a.notes && (
                    <p className="text-[11px] text-[var(--text-muted)] bg-[var(--table-header-bg)] rounded px-2 py-1 border border-[var(--border-light)]">{a.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Advance Modal */}
      <Modal
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) resetForm();
        }}
        title="Record Employee Advance"
        maxWidth="max-w-md"
      >
        <div className="space-y-3.5 text-xs font-semibold">
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Worker *</label>
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold outline-none cursor-pointer">
              <option value="">-- Select Worker --</option>
              {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[var(--text-muted)]">Date *</label>
              <input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)}
                className="h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[var(--text-muted)]">Amount (₹) *</label>
              <input type="number" value={amount || ""} placeholder="0.00"
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] text-xs font-bold" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Payment Mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-bold outline-none cursor-pointer">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[var(--text-muted)]">Notes</label>
            <input type="text" value={notes} placeholder="Optional"
              onChange={(e) => setNotes(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] text-xs font-bold" />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <Button variant="outline" onClick={() => { setShowModal(false); resetForm(); }} className="h-9 text-xs font-bold">Cancel</Button>
            <AsyncButton onClick={handleSubmit}
              className="h-9 px-4 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg">
              Record Advance
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </PageState>
  );
}
