"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Package,
  IndianRupee,
  Users,
  FileText,
  Save,
  CheckCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NumericInput } from "@/components/ui/numeric-input";
import PageState from "@/components/shared/PageState";

interface EditStageEntryProps {
  params: { id: string };
}

interface Worker {
  id: string;
  name: string;
  worker_id: string;
  type: string;
  default_rate: number;
}

export default function EditStageEntryPage({ params }: EditStageEntryProps) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form State
  const [entryDate, setEntryDate] = useState("");
  const [qtyIn, setQtyIn] = useState(0);
  const [qtyOut, setQtyOut] = useState(0);
  const [wastageQty, setWastageQty] = useState(0);
  const [jobWorkRate, setJobWorkRate] = useState(0);
  const [workerId, setWorkerId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch stage entry detail
  const { data: entryData, isLoading, error } = useQuery({
    queryKey: ["stage-entry-edit", id],
    queryFn: async () => {
      const res = await fetch(`/api/production/stage-entries/${id}`);
      if (!res.ok) throw new Error("Failed to fetch stage entry details");
      return res.json();
    },
  });

  const entry = entryData?.entry || null;

  // Fetch Workers List
  const { data: workersData } = useQuery<{ workers: Worker[] }>({
    queryKey: ["workers-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/workers");
      return res.json();
    },
  });

  const workers = workersData?.workers || [];

  // Populate form fields when entry loads
  useEffect(() => {
    if (entry) {
      setEntryDate(entry.entry_date || new Date().toISOString().substring(0, 10));
      setQtyIn(Number(entry.qty_in || 0));
      setQtyOut(Number(entry.qty_out || 0));
      setWastageQty(Number(entry.wastage_qty || 0));
      setJobWorkRate(Number(entry.job_work_rate || 0));
      setWorkerId(entry.worker_id || "");
      setRemarks(entry.remarks || "");
    }
  }, [entry]);

  // Derived calculations
  const totalJobWorkAmount = qtyOut * jobWorkRate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryDate) {
      toast.error("Please select entry date");
      return;
    }
    if (qtyOut <= 0) {
      toast.error("Processed output quantity must be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        lot_id: entry.lot_id,
        lot_stage_id: entry.lot_stage_id,
        entry_date: entryDate,
        qty_in: qtyIn,
        qty_out: qtyOut,
        wastage_qty: wastageQty,
        job_work_rate: jobWorkRate,
        total_job_work_amount: totalJobWorkAmount,
        worker_id: workerId || null,
        remarks: remarks || null,
      };

      const res = await fetch(`/api/production/stage-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update stage entry");

      toast.success("Stage entry updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["stage-entry-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["job-work-entries-list"] });
      queryClient.invalidateQueries({ queryKey: ["worker-ledger"] });

      router.push("/production/job-work");
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage entry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Breadcrumbs & Header */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/production/job-work"
              className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 shadow-sm"
            >
              <ArrowLeft className="h-5 w-5 text-slate-500" />
            </Link>
            <div>
              <nav className="flex items-center gap-2 text-xs font-semibold text-[#64748B] mb-0.5 select-none">
                <Link href="/" className="hover:text-[#6366F1] transition-colors">
                  Dashboard
                </Link>
                <ChevronRight size={12} className="text-[#94A3B8]" />
                <Link href="/production/job-work" className="hover:text-[#6366F1] transition-colors">
                  Job Work
                </Link>
                <ChevronRight size={12} className="text-[#94A3B8]" />
                <span className="text-[#0F172A] font-bold">Edit Entry</span>
              </nav>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="text-[#5B63D3]" size={24} />
                <span>Edit Stage Entry: {entry?.entry_number}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-[#5B63D3] hover:bg-[#4F55C3] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <Save size={16} />
              <span>{submitting ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        {entry && (
          <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            {/* Info Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Production Lot</span>
                <span className="font-extrabold text-[#6366F1]">{entry.lot?.lot_number || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Production Stage</span>
                <span className="font-bold text-slate-800">{entry.stage?.stage_name || "—"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Payment Status</span>
                <span className="font-bold uppercase text-amber-600">{entry.payment_status || "unpaid"}</span>
              </div>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Entry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--input-border)] text-xs font-bold focus:ring-2 focus:ring-[#5B63D3] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Assigned Job Worker
                </label>
                <select
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-2 focus:ring-[#5B63D3] outline-none"
                >
                  <option value="">Select Worker</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.worker_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Input Quantity (Pcs)
                </label>
                <NumericInput
                  value={qtyIn}
                  onChange={(e) => setQtyIn(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--input-border)] text-xs font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Processed Output Quantity (Pcs) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  value={qtyOut}
                  onChange={(e) => setQtyOut(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--input-border)] text-xs font-extrabold text-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Scrap / Wastage Qty (Pcs)
                </label>
                <NumericInput
                  value={wastageQty}
                  onChange={(e) => setWastageQty(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--input-border)] text-xs font-bold text-rose-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Job Work Piece Rate (₹)
                </label>
                <NumericInput
                  value={jobWorkRate}
                  onChange={(e) => setJobWorkRate(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 rounded-xl border border-[var(--input-border)] text-xs font-bold text-slate-900 outline-none"
                />
              </div>
            </div>

            {/* Calculated Total Amount Box */}
            <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Calculated Total Job Work Amount</p>
                <p className="text-[#6366F1] text-xs font-semibold mt-0.5">
                  {qtyOut} Pcs × ₹{jobWorkRate.toFixed(2)} / Pc
                </p>
              </div>
              <p className="text-xl font-extrabold text-[#6366F1]">
                ₹{totalJobWorkAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                Remarks / Work Notes
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Optional work entry notes..."
                className="w-full p-3 rounded-xl border border-[var(--input-border)] text-xs font-medium outline-none focus:ring-2 focus:ring-[#5B63D3] resize-none"
              />
            </div>
          </form>
        )}
      </div>
    </PageState>
  );
}
