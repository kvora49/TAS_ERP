"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Edit,
  Trash2,
  ChevronRight,
  FileText,
  Lightbulb,
  Boxes,
  Lock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import CardSectionHeader from "@/components/shared/CardSectionHeader";
import HorizontalTimeline from "@/components/shared/HorizontalTimeline";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/utils";

interface StageEntryDetailProps {
  params: { id: string };
}

export default function StageEntryDetailPage({ params }: StageEntryDetailProps) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Modals state
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetGodownId, setTargetGodownId] = useState("");
  const [confirmDesignCode, setConfirmDesignCode] = useState("");
  const [movingToStock, setMovingToStock] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Edit form state
  const [editDate, setEditDate] = useState("");
  const [editShift, setEditShift] = useState("day");
  const [editWorkerId, setEditWorkerId] = useState("");
  const [editQtyIn, setEditQtyIn] = useState(0);
  const [editQtyOut, setEditQtyOut] = useState(0);
  const [editWastageQty, setEditWastageQty] = useState(0);
  const [editRate, setEditRate] = useState(0);
  const [editRemarks, setEditRemarks] = useState("");

  // Fetch stage entry detail
  const { data, isLoading, error } = useQuery({
    queryKey: ["stage-entry-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/production/stage-entries/${id}`);
      if (!res.ok) throw new Error("Failed to fetch stage entry details");
      return res.json();
    },
  });

  const entry = data?.entry || null;
  const totalStagesCount = data?.totalStagesCount || 0;
  const isEditable = data?.isEditable ?? true;
  const editableBlockReason = data?.editableBlockReason ?? null;

  // Initialize edit form when entry loads or modal opens
  useEffect(() => {
    if (entry) {
      setEditDate(entry.entry_date || "");
      setEditShift(entry.shift || "day");
      setEditWorkerId(entry.worker_id || entry.worker?.id || "");
      setEditQtyIn(entry.qty_in || 0);
      setEditQtyOut(entry.qty_out || 0);
      setEditWastageQty(entry.wastage_qty || 0);
      setEditRate(entry.job_work_rate || 0);
      setEditRemarks(entry.remarks || "");
    }
  }, [entry, editModalOpen]);

  // Fetch godowns list for Move to Stock target selection
  const { data: godownsData } = useQuery<{ godowns: any[] }>({
    queryKey: ["godowns-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      return res.json();
    },
  });
  const godowns = godownsData?.godowns || [];

  // Fetch active workers for Edit modal
  const { data: workersData } = useQuery({
    queryKey: ["workers-active-list"],
    queryFn: async () => {
      const res = await fetch("/api/workers?active=true");
      return res.json();
    },
    enabled: editModalOpen,
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
      setEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update stage entry");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/stage-entries/${id}`, {
        method: "DELETE",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to delete stage entry");
      return resData;
    },
    onSuccess: (resData) => {
      toast.success(resData.message || "Stage entry deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["stage-entries"] });
      queryClient.invalidateQueries({ queryKey: ["lot-detail"] });
      router.push(entry?.lot_id ? `/production/lots/${entry.lot_id}` : "/production/stage-entries");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete stage entry");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[var(--text-muted)] font-medium">Loading stage entry details...</span>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <span className="text-sm font-semibold text-red-500">Failed to load stage entry</span>
        <Link href="/production/lots" className="text-xs text-[var(--primary)] hover:underline font-bold">
          Back to Lots Directory
        </Link>
      </div>
    );
  }

  // Formatters
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const qtyIn = entry.qty_in || 0;
  const qtyOut = entry.qty_out || 0;
  const wastageQty = entry.wastage_qty || 0;
  const wastagePercent = ((entry.wastage_percent || 0) * 100).toFixed(2);
  const qtyBalance = entry.qty_balance || 0;

  // Timeline steps
  const timelineSteps = [
    {
      label: "Entry Created",
      date: new Date(entry.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      time: new Date(entry.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "completed" as const,
    },
    {
      label: "In Qty Recorded",
      date: entry.entry_date,
      time: "09:00 AM",
      status: "completed" as const,
    },
    {
      label: "Out Qty Recorded",
      date: entry.entry_date,
      time: "06:00 PM",
      status: "completed" as const,
    },
    {
      label: "Marked as Completed",
      date: entry.entry_date,
      time: "06:05 PM",
      status: "completed" as const,
    },
  ];

  // Right card summaries
  const lotSummaryItems = [
    { label: "Lot No.", value: entry.lot?.lot_number || "—" },
    { label: "Design", value: entry.lot?.design?.code ? `${entry.lot.design.code} - ${entry.lot.design.name}` : "—" },
    { label: "Colour", value: entry.lot?.colour?.colour_name || "—" },
    {
      label: "Size Set",
      value: entry.lot?.size_set?.name
        ? `${entry.lot.size_set.name}${Array.isArray(entry.lot.size_set.sizes) ? ` (${entry.lot.size_set.sizes.join(", ")})` : ""}`
        : Array.isArray(entry.lot?.size_set?.sizes)
          ? entry.lot.size_set.sizes.join(", ")
          : "—",
    },
    { label: "Stage", value: entry.stage?.stage_name || "—" },
    { label: "Stage Sequence", value: `${entry.stage?.sequence_no || 0} of ${totalStagesCount}` },
  ];

  const qtySummaryItems = [
    { label: "Total Lot Quantity", value: entry.lot?.total_quantity || 0 },
    { label: "Completed Qty (Till Prev Stage)", value: qtyIn },
    { label: "This Stage - Qty Out", value: qtyOut },
    { label: "Pending Quantity", value: (entry.lot?.total_quantity || 0) - (entry.lot?.completed_quantity || 0) },
  ];

  const financialSummaryItems = [
    { label: "Rate (Per Pc)", value: `₹${(entry.job_work_rate || 0).toFixed(2)}` },
    { label: "Total Job Work Amount", value: formatCurrency(entry.total_job_work_amount || 0), isQuantity: true },
    { label: "Labor Cost", value: formatCurrency(entry.total_labor_cost || 0) },
    {
      label: "Payment Status",
      value: (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            entry.payment_status === "paid"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : entry.payment_status === "partial"
              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}
        >
          {entry.payment_status || "unpaid"}
        </span>
      ),
    },
    { label: "Paid Amount", value: formatCurrency(entry.paid_amount || 0) },
    { label: "Balance Payable", value: formatCurrency((entry.total_job_work_amount || 0) - (entry.paid_amount || 0)) },
  ];

  const handleMoveToStock = async () => {
    if (!targetGodownId) {
      toast.error("Please select a target godown");
      return;
    }
    if (confirmDesignCode.trim().toLowerCase() !== entry.lot?.design?.code?.trim().toLowerCase()) {
      toast.error(`Design code mismatch. Please type ${entry.lot?.design?.code} to confirm.`);
      return;
    }

    setMovingToStock(true);
    try {
      const res = await fetch(`/api/production/lots/${entry.lot_id}/move-to-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          godown_id: targetGodownId,
          confirm_design_code: confirmDesignCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to move lot to stock");

      toast.success(data.message || "Lot moved to finished stock successfully!");
      setMoveModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["stage-entry-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["lot-detail", entry.lot_id] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setMovingToStock(false);
    }
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      entry_date: editDate,
      shift: editShift,
      worker_id: editWorkerId,
      qty_in: editQtyIn,
      qty_out: editQtyOut,
      wastage_qty: editWastageQty,
      job_work_rate: editRate,
      remarks: editRemarks,
    });
  };

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto animate-fadeIn">
      {/* Breadcrumbs and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[var(--primary)] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
            <Link href={`/production/lots/${entry.lot_id}`} className="hover:text-[var(--primary)] transition-colors">
              Lot Detail
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
            <span className="text-[var(--text-secondary)]">Stage Entry Detail</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
            Stage Entry Detail
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/production/lots/${entry.lot_id}`}
            className="border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-semibold text-xs px-3.5 h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[var(--card-bg)] shadow-2xs"
          >
            <ArrowLeft size={14} />
            Back to Lot
          </Link>

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => {
              if (!isEditable) {
                toast.error(editableBlockReason || "This entry is locked and cannot be edited.");
                return;
              }
              router.push(`/production/stage-entries/${id}/edit`);
            }}
            className={cn(
              "border text-xs font-semibold px-3.5 h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer",
              isEditable
                ? "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
                : "border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-faint)] opacity-60"
            )}
            title={editableBlockReason || "Edit stage entry"}
          >
            <Edit size={14} />
            Edit Entry
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => {
              if (!isEditable) {
                toast.error(editableBlockReason || "This entry is locked and cannot be deleted.");
                return;
              }
              setDeleteModalOpen(true);
            }}
            className={cn(
              "border text-xs font-semibold px-3.5 h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer",
              isEditable
                ? "border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                : "border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-faint)] opacity-60"
            )}
            title={editableBlockReason || "Delete stage entry"}
          >
            <Trash2 size={14} />
            Delete Entry
          </button>

          {entry.lot?.status !== "completed" && (
            <button
              onClick={() => setMoveModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Boxes size={14} />
              Move Lot to Stock
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-semibold text-xs px-3.5 h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[var(--card-bg)] shadow-2xs"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {/* Lock Guard Banner if entry cannot be edited/deleted */}
      {!isEditable && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <Lock className="h-4 w-4 shrink-0" />
          <p className="text-xs font-medium leading-relaxed">
            <strong className="font-bold">Entry Locked:</strong> {editableBlockReason}
          </p>
        </div>
      )}

      {/* ENTRY HEADER CARD */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 border-b lg:border-b-0 lg:border-r border-[var(--border)] pb-4 lg:pb-0 pr-6 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shadow-xs shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-[var(--text-primary)] font-mono leading-none">
                  {entry.entry_number}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Completed
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-faint)] font-bold mt-1.5 uppercase tracking-wide">
                Reference ID: {entry.id}
              </p>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-6 text-sm">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Lot No.</span>
              <span className="text-sm font-semibold text-[var(--primary)] mt-0.5 block font-mono">
                <Link href={`/production/lots/${entry.lot_id}`} className="hover:underline">
                  {entry.lot?.lot_number}
                </Link>
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Production Stage</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block">
                {entry.stage?.stage_name}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Entry Date</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block font-mono">
                {entry.entry_date}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Shift</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] capitalize mt-0.5 block">
                {entry.shift} Shift
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Created By</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block">
                System
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Logged On</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block font-mono">
                {new Date(entry.created_at).toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Quantity Details */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs">
            <CardSectionHeader variant="quantity" title="Quantity Details" />
            <div className="grid grid-cols-5 gap-4 text-center">
              <div className="bg-[var(--page-bg)] p-3.5 rounded-lg border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Qty In</span>
                <span className="text-lg font-bold text-[var(--text-primary)] mt-1 block font-mono">{qtyIn}</span>
              </div>
              <div className="bg-emerald-500/10 p-3.5 rounded-lg border border-emerald-500/20">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Qty Out</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 block font-mono">{qtyOut}</span>
              </div>
              <div className="bg-amber-500/10 p-3.5 rounded-lg border border-amber-500/20">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Wastage Qty</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 block font-mono">{wastageQty}</span>
              </div>
              <div className="bg-[var(--page-bg)] p-3.5 rounded-lg border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Wastage %</span>
                <span className="text-lg font-bold text-[var(--text-primary)] mt-1 block font-mono">{wastagePercent}%</span>
              </div>
              <div className="bg-[var(--page-bg)] p-3.5 rounded-lg border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Balance Qty</span>
                <span className="text-lg font-bold text-[var(--text-primary)] mt-1 block font-mono">{qtyBalance}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Job Work Details */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs">
            <CardSectionHeader variant="job_work" title="Job Work Details" />
            <div className="grid grid-cols-4 gap-4 text-sm text-center">
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">Job Work Type</span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1 block capitalize">
                  {entry.job_work_type || "—"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">Rate (Per Pc)</span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1 block font-mono">
                  ₹{(entry.job_work_rate || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">Payment Type</span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1 block capitalize">
                  {entry.payment_type ? entry.payment_type.replace("_", " ") : "Piece Rate"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">Total Amount</span>
                <span className="text-base font-bold text-[var(--primary)] mt-1 block font-mono">
                  {formatCurrency(entry.total_job_work_amount || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Worker Assignment */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs">
            <CardSectionHeader variant="worker" title="Worker Assignment" />
            <div className="grid grid-cols-4 gap-4 text-sm text-center">
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">Assigned Worker</span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1 block">
                  {entry.worker?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">Worker Type</span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1 block capitalize">
                  {entry.worker_type ? entry.worker_type.replace("_", " ") : "—"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">No. of Workers</span>
                <span className="text-sm font-semibold text-[var(--text-primary)] mt-1 block font-mono">
                  {entry.no_of_workers || 1}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs font-semibold block uppercase">Total Labor Cost</span>
                <span className="text-base font-bold text-[var(--text-primary)] mt-1 block font-mono">
                  {formatCurrency(entry.total_labor_cost || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Additional Information & Attachments */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs">
            <CardSectionHeader variant="info" title="Additional Information" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block border-b border-[var(--border)] pb-1.5 mb-2">Remarks</span>
                <p className="text-[var(--text-body)] leading-relaxed italic">{entry.remarks || "No remarks entered for this entry."}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block border-b border-[var(--border)] pb-1.5 mb-2">Stage Parameters</span>
                {entry.custom_field_values && Object.keys(entry.custom_field_values).length > 0 ? (
                  <div className="space-y-1.5 font-medium text-xs">
                    {Object.entries(entry.custom_field_values).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="text-[var(--text-muted)] font-semibold">{key}:</span>
                        <span className="text-[var(--text-primary)] font-bold bg-[var(--page-bg)] px-2 py-0.5 rounded border border-[var(--border)] font-mono">
                          {typeof val === "boolean" ? (val ? "Yes / Approved" : "No / Pending") : String(val || "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)] italic">No custom parameters recorded.</p>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block border-b border-[var(--border)] pb-1.5 mb-2">Finished Goods Photos</span>
                {entry.attachments && entry.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.attachments.map((url: string, idx: number) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative w-16 h-16 border border-[var(--border)] rounded overflow-hidden bg-[var(--page-bg)] flex items-center justify-center hover:ring-1 hover:ring-[var(--primary)]"
                      >
                        {url.endsWith(".pdf") ? (
                          <span className="text-[10px] font-bold text-red-500">PDF</span>
                        ) : (
                          <img src={url} alt={`attachment-${idx}`} className="w-full h-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-[var(--text-faint)] italic block text-xs">No photos uploaded</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 5: Timeline */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs">
            <CardSectionHeader variant="timeline" title="Entry Processing Timeline" />
            <HorizontalTimeline steps={timelineSteps} />
          </div>
        </div>

        {/* Right Column: Summaries */}
        <div className="lg:col-span-1 space-y-6">
          <LotSummaryPanel title="Lot & Stage Summary" items={lotSummaryItems} />
          <LotSummaryPanel title="Quantity Summary (Lot)" items={qtySummaryItems} />
          <LotSummaryPanel title="Financial Summary (This Entry)" items={financialSummaryItems} />

          {/* Note Card */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-2.5 text-amber-600 dark:text-amber-400">
            <Lightbulb className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wide block">Locking Policy Note</span>
              <p className="text-[11px] text-[var(--text-body)] leading-relaxed mt-1">
                Stage entries cannot be modified or deleted if the lot is completed, output is moved to stock, payment is recorded, or entries exist in subsequent stages.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MOVE TO STOCK DIALOG OVERLAY */}
      {moveModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide border-b border-[var(--border)] pb-2">
              Move Lot to Finished Stock
            </h3>
            <p className="text-xs text-[var(--text-muted)] leading-normal">
              This action will finalize the production lot and add the finished pieces of design **{entry.lot?.design?.code}** to the selected finished goods godown.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Target Godown</label>
                <select
                  value={targetGodownId}
                  onChange={(e) => setTargetGodownId(e.target.value)}
                  className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                >
                  <option value="">Select Godown</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">
                  Confirm Design Code (Type **{entry.lot?.design?.code}**)
                </label>
                <input
                  type="text"
                  value={confirmDesignCode}
                  onChange={(e) => setConfirmDesignCode(e.target.value)}
                  placeholder={entry.lot?.design?.code}
                  className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="px-3 h-8 rounded border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--table-row-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMoveToStock}
                disabled={movingToStock}
                className="px-3 h-8 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50"
              >
                {movingToStock ? "Moving..." : "Confirm & Move Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STAGE ENTRY MODAL */}
      {editModalOpen && (
        <Modal
          open={editModalOpen}
          onOpenChange={(open) => !open && setEditModalOpen(false)}
          title={`Edit Stage Entry ${entry.entry_number}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Entry Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Shift</label>
                <select
                  value={editShift}
                  onChange={(e) => setEditShift(e.target.value)}
                  className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                  <option value="general">General Shift</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Assigned Worker</label>
              <select
                value={editWorkerId}
                onChange={(e) => setEditWorkerId(e.target.value)}
                className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
              >
                <option value="">Select Worker</option>
                {workers.map((w: any) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.worker_id || "Worker"})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Qty In</label>
                <input
                  type="number"
                  min="0"
                  value={editQtyIn}
                  onChange={(e) => setEditQtyIn(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Qty Out</label>
                <input
                  type="number"
                  min="0"
                  value={editQtyOut}
                  onChange={(e) => setEditQtyOut(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Wastage Qty</label>
                <input
                  type="number"
                  min="0"
                  value={editWastageQty}
                  onChange={(e) => setEditWastageQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Job Work Rate (INR / Pc)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editRate}
                onChange={(e) => setEditRate(parseFloat(e.target.value) || 0)}
                className="w-full h-9 rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 text-xs focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase">Remarks</label>
              <textarea
                rows={3}
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Optional remarks..."
                className="w-full rounded bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] p-2 text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 h-9 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--table-row-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
                className="px-4 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <Modal
          open={deleteModalOpen}
          onOpenChange={(open) => !open && setDeleteModalOpen(false)}
          title={`Delete Entry ${entry.entry_number}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-[var(--text-body)] leading-relaxed">
              Are you sure you want to delete stage entry <strong className="text-[var(--text-primary)]">{entry.entry_number}</strong> for stage <strong>{entry.stage?.stage_name}</strong>?
            </p>
            <p className="text-[11px] text-[var(--text-faint)]">
              This will reconcile completed quantities for this stage. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 h-9 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--table-row-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Entry"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
