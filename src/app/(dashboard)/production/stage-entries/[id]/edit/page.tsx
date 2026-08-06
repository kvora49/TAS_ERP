"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Save,
  Lock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";
import { NumericInput } from "@/components/ui/numeric-input";

interface EditStageEntryPageProps {
  params: { id: string };
}

export default function EditStageEntryPage({ params }: EditStageEntryPageProps) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form states
  const [entryDate, setEntryDate] = useState("");
  const [shift, setShift] = useState("day");
  const [workerId, setWorkerId] = useState("");
  const [qtyIn, setQtyIn] = useState(0);
  const [qtyOut, setQtyOut] = useState(0);
  const [wastageQty, setWastageQty] = useState(0);
  const [jobWorkRate, setJobWorkRate] = useState(0);
  const [paymentType, setPaymentType] = useState("piece_rate");
  const [noOfWorkers, setNoOfWorkers] = useState(1);
  const [remarks, setRemarks] = useState("");

  // Fetch entry detail
  const { data, isLoading, error } = useQuery({
    queryKey: ["stage-entry-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/production/stage-entries/${id}`);
      if (!res.ok) throw new Error("Failed to fetch stage entry details");
      return res.json();
    },
  });

  const entry = data?.entry || null;
  const isEditable = data?.isEditable ?? true;
  const editableBlockReason = data?.editableBlockReason ?? null;

  // Pre-fill state when entry loads
  useEffect(() => {
    if (entry) {
      setEntryDate(entry.entry_date || "");
      setShift(entry.shift || "day");
      setWorkerId(entry.worker_id || entry.worker?.id || "");
      setQtyIn(entry.qty_in || 0);
      setQtyOut(entry.qty_out || 0);
      setWastageQty(entry.wastage_qty || 0);
      setJobWorkRate(entry.job_work_rate || 0);
      setPaymentType(entry.payment_type || "piece_rate");
      setNoOfWorkers(entry.no_of_workers || 1);
      setRemarks(entry.remarks || "");
    }
  }, [entry]);

  // Fetch active workers
  const { data: workersData } = useQuery({
    queryKey: ["workers-active-list"],
    queryFn: async () => {
      const res = await fetch("/api/workers?active=true");
      return res.json();
    },
  });
  const workers = workersData?.workers || [];

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/production/stage-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update stage entry");
      return resData;
    },
    onSuccess: () => {
      toast.success("Stage entry updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["stage-entry-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["stage-entries"] });
      queryClient.invalidateQueries({ queryKey: ["lot-detail"] });
      router.push(`/production/stage-entries/${id}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update stage entry");
    },
  });

  const handleWorkerChange = (wId: string) => {
    setWorkerId(wId);
    if (wId) {
      const matched = workers.find((w: any) => w.id === wId);
      if (matched && matched.default_rate !== undefined && matched.default_rate !== null) {
        setJobWorkRate(matched.default_rate);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) {
      toast.error(editableBlockReason || "This entry is locked.");
      return;
    }
    if (!entryDate) {
      toast.error("Entry date is required.");
      return;
    }
    if (qtyIn <= 0) {
      toast.error("Quantity In must be greater than 0.");
      return;
    }

    updateMutation.mutate({
      entry_date: entryDate,
      shift,
      worker_id: workerId,
      qty_in: qtyIn,
      qty_out: qtyOut,
      wastage_qty: wastageQty,
      job_work_rate: jobWorkRate,
      payment_type: paymentType,
      no_of_workers: noOfWorkers,
      remarks,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[var(--text-muted)] font-medium">Loading stage entry data...</span>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <span className="text-sm font-semibold text-red-500">Failed to load stage entry</span>
        <Link href="/production/stage-entries" className="text-xs text-[var(--primary)] hover:underline font-bold">
          Back to Stage Entries
        </Link>
      </div>
    );
  }

  const wastagePercent = qtyIn > 0 ? ((wastageQty / qtyIn) * 100).toFixed(2) : "0.00";
  const qtyBalance = qtyIn - qtyOut - wastageQty;
  const totalLaborCost = qtyOut * jobWorkRate;

  const lotSummaryItems = [
    { label: "Entry Number", value: entry.entry_number },
    { label: "Lot No.", value: entry.lot?.lot_number || "—" },
    { label: "Stage Name", value: entry.stage?.stage_name || "—" },
    { label: "Stage Sequence", value: `${entry.stage?.sequence_no || 0}` },
  ];

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto animate-fadeIn">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[var(--primary)] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
            <Link href="/production/stage-entries" className="hover:text-[var(--primary)] transition-colors">
              Stage Entries
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
            <span className="text-[var(--text-secondary)]">Edit Entry {entry.entry_number}</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
            Edit Stage Entry <span className="font-mono text-[var(--primary)]">{entry.entry_number}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/production/stage-entries/${id}`}
            className="border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-semibold text-xs px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-[var(--card-bg)] shadow-2xs"
          >
            <ArrowLeft size={16} />
            Cancel &amp; Back
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={!isEditable || updateMutation.isPending}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold text-xs px-5 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <Save size={16} />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Lock Guard Banner */}
      {!isEditable && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <Lock className="h-5 w-5 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">
            <strong className="font-bold">Entry Locked:</strong> {editableBlockReason}
          </p>
        </div>
      )}

      {/* Info Bar */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-2xs flex flex-wrap items-center gap-x-8 gap-y-2 text-xs">
        <div>
          <span className="text-[var(--text-muted)] block">Lot Number:</span>
          <span className="font-bold text-[var(--primary)] font-mono">{entry.lot?.lot_number || "—"}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)] block">Stage:</span>
          <span className="font-bold text-[var(--text-primary)]">{entry.stage?.stage_name}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)] block">Lot Total Qty:</span>
          <span className="font-bold text-[var(--text-primary)]">{entry.lot?.total_quantity} Pcs</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Basic Info */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Basic Entry Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Entry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Shift <span className="text-red-500">*</span>
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] disabled:opacity-50"
                >
                  <option value="day">Day Shift (9 AM - 6 PM)</option>
                  <option value="night">Night Shift (8 PM - 5 AM)</option>
                  <option value="general">General Shift</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Quantities */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Quantity Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Quantity In <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  min="1"
                  value={qtyIn}
                  onChange={(e) => setQtyIn(parseInt(e.target.value, 10) || 0)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-sm font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Quantity Out <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  min="0"
                  value={qtyOut}
                  onChange={(e) => setQtyOut(parseInt(e.target.value, 10) || 0)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-emerald-600 font-bold text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Wastage Quantity
                </label>
                <NumericInput
                  min="0"
                  value={wastageQty}
                  onChange={(e) => setWastageQty(parseInt(e.target.value, 10) || 0)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-red-500 font-bold text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--border)] text-xs">
              <div className="bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block">Calculated Wastage %:</span>
                <span className="font-bold text-[var(--text-primary)] font-mono text-sm">{wastagePercent}%</span>
              </div>
              <div className="bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block">Balance Qty (In Progress):</span>
                <span className="font-bold text-[var(--text-primary)] font-mono text-sm">{qtyBalance} pcs</span>
              </div>
            </div>
          </div>

          {/* Section 3: Job Work & Worker */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Worker &amp; Financials
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Assigned Worker
                </label>
                <select
                  value={workerId}
                  onChange={(e) => handleWorkerChange(e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] disabled:opacity-50"
                >
                  <option value="">Select Worker</option>
                  {workers.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.worker_id || "WRK"}) — ₹{w.default_rate || 0}/pc
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Job Work Rate (INR / Pc)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={jobWorkRate}
                  onChange={(e) => setJobWorkRate(parseFloat(e.target.value) || 0)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  No. of Workers
                </label>
                <NumericInput
                  min="1"
                  value={noOfWorkers}
                  onChange={(e) => setNoOfWorkers(parseInt(e.target.value, 10) || 1)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Total Labor Cost
                </label>
                <input
                  type="text"
                  value={`₹${totalLaborCost.toFixed(2)}`}
                  disabled
                  className="w-full h-10 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] px-3 text-xs font-bold font-mono text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Remarks */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-xs flex items-center justify-center">
                4
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Remarks &amp; Notes
              </h3>
            </div>

            <div>
              <textarea
                rows={4}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={250}
                disabled={!isEditable}
                placeholder="Optional remarks about this entry..."
                className="w-full rounded-lg bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] p-3 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Summary */}
        <div className="lg:col-span-1 space-y-6">
          <LotSummaryPanel title="Entry Context" items={lotSummaryItems} />
          
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3 text-xs">
            <h4 className="font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border)] pb-2">
              Cost Preview
            </h4>
            <div className="flex justify-between py-1 text-[var(--text-muted)]">
              <span>Qty Produced:</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{qtyOut} pcs</span>
            </div>
            <div className="flex justify-between py-1 text-[var(--text-muted)]">
              <span>Rate / Pc:</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">₹{jobWorkRate.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-[var(--border)] font-bold text-sm text-[var(--primary)]">
              <span>Subtotal Labor:</span>
              <span className="font-mono">₹{totalLaborCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
