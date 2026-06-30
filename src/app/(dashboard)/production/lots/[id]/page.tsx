"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  CheckCircle2,
  ChevronRight,
  Eye,
  Plus,
  Info,
  Calendar,
  Layers,
  Shirt,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import StageProgressTracker from "@/components/shared/StageProgressTracker";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";

interface LotDetailProps {
  params: { id: string };
}

export default function LotDetailPage({ params }: LotDetailProps) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch lot detail along with sizes, stages, and stage entries
  const { data, isLoading, error } = useQuery({
    queryKey: ["lot-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/production/lots/${id}`);
      if (!res.ok) throw new Error("Failed to fetch lot details");
      return res.json();
    },
  });

  const lot = data?.lot || null;
  const sizes = data?.sizes || [];
  const stages = data?.stages || [];
  const stageEntries = data?.stageEntries || [];

  // Complete Lot Mutation
  const completeLotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/production/lots/${id}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to complete production lot");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lot-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["lots-list"] });
      toast.success("Production lot marked as completed successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to complete lot");
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[#64748B]">Loading lot details...</span>
      </div>
    );
  }

  if (error || !lot) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <span className="text-sm font-semibold text-red-500">Failed to load production lot</span>
        <Link href="/production/lots" className="text-xs text-[#6366F1] hover:underline">
          Back to Lots List
        </Link>
      </div>
    );
  }

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const completedQty = lot.completed_quantity || 0;
  const totalQty = lot.total_quantity || 0;
  const percentage = Math.min(Math.round((completedQty / (totalQty || 1)) * 100), 100);

  // Map database stages into StageProgressTracker nodes
  // Each stage node shows name, status, date (last entry date), and qty
  const trackerStages = stages.map((st: any) => {
    // Find the latest entry for this stage
    const entries = stageEntries.filter((e: any) => e.lot_stage_id === st.id);
    const lastEntryDate = entries.length > 0 ? entries[0].entry_date : null;
    // Calculate cumulative qty out for this stage
    const stageQtyOut = entries.reduce((acc: number, curr: any) => acc + (curr.qty_out || 0), 0);

    return {
      id: st.id,
      name: st.stage_name,
      status: st.status,
      date: lastEntryDate,
      qty: stageQtyOut > 0 ? stageQtyOut : null,
    };
  });

  // Calculate summary counts
  const totalStagesCount = stages.length;
  const completedStagesCount = stages.filter((st: any) => st.status === "completed").length;
  const inProgressStagesCount = stages.filter((st: any) => st.status === "in_progress").length;
  const pendingStagesCount = stages.filter((st: any) => st.status === "pending").length;

  const inProgressQty = totalQty - completedQty;

  const rightPanelItems = [
    { label: "Total Quantity", value: totalQty.toLocaleString("en-IN") },
    {
      label: "Completed Quantity",
      value: (
        <span className="text-[#15803D] font-semibold">
          {completedQty.toLocaleString("en-IN")} ({percentage}%)
        </span>
      ),
    },
    {
      label: "In Progress Quantity",
      value: (
        <span className="text-[#1D4ED8] font-semibold">
          {inProgressQty.toLocaleString("en-IN")} ({100 - percentage}%)
        </span>
      ),
    },
    {
      label: "Pending Quantity",
      value: <span className="text-[#94A3B8]">0 (0%)</span>,
    },
    { label: "Total Stages", value: totalStagesCount },
    { label: "Completed Stages", value: completedStagesCount },
    { label: "In Progress Stages", value: inProgressStagesCount },
    { label: "Pending Stages", value: pendingStagesCount },
  ];

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Breadcrumbs and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[#6366F1] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <Link href="/production/lots" className="hover:text-[#6366F1] transition-colors">
              Production Lots
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">{lot.lot_number}</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Lot Detail
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/production/lots"
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <ArrowLeft size={16} />
            Back to List
          </Link>
          <Link
            href={`/production/lots/${id}/edit`}
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <Pencil size={16} />
            Edit Lot
          </Link>
          {lot.status !== "completed" && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to mark this lot as complete? This will finalize production quantities.")) {
                  completeLotMutation.mutate();
                }
              }}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
            >
              <CheckCircle2 size={16} />
              Mark Lot Complete
            </button>
          )}
        </div>
      </div>

      {/* LOT HEADER CARD */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 items-stretch">
          {/* Col 1: Lot No. and Status */}
          <div className="lg:col-span-2 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-[#F3F4F6] pb-4 lg:pb-0 pr-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-black text-[#0F172A] font-mono leading-none">
                {lot.lot_number}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider select-none ${
                  lot.status === "in_progress"
                    ? "bg-[#DBEAFE] text-[#1D4ED8]"
                    : lot.status === "completed"
                    ? "bg-[#DCFCE7] text-[#15803D]"
                    : lot.status === "on_hold"
                    ? "bg-[#FEF3C7] text-[#D97706]"
                    : lot.status === "cancelled"
                    ? "bg-[#FEE2E2] text-[#DC2626]"
                    : "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {lot.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-2 font-medium">
              Registered Date: {lot.lot_date}
            </p>
          </div>

          {/* Cols 2-6: Info grid */}
          <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 py-2">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Brand</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">{lot.brand?.name || "—"}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Design</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">
                {lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : "—"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Colour</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 flex items-center gap-1.5">
                {lot.colour?.hex_code && (
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-[#D1D5DB]"
                    style={{ backgroundColor: lot.colour.hex_code }}
                  />
                )}
                {lot.colour?.colour_name || "—"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Size Set</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">
                {lot.size_set?.sizes ? lot.size_set.sizes.join(", ") : "—"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Total Quantity</span>
              <span className="text-sm font-bold text-[#6366F1] mt-0.5 block">
                {totalQty.toLocaleString("en-IN")} Pcs
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Completed Quantity</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">
                {completedQty.toLocaleString("en-IN")} ({percentage}%)
              </span>
            </div>
          </div>

          {/* Col 7: Design Image */}
          <div className="lg:col-span-1 flex items-center justify-center shrink-0 border-t lg:border-t-0 lg:border-l border-[#F3F4F6] pt-4 lg:pt-0 lg:pl-4">
            {lot.design?.image_url ? (
              <img
                src={lot.design.image_url}
                alt="Design image"
                className="w-24 h-24 rounded-lg object-cover border border-[#E2E8F0]"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-24 h-24 bg-[#F1F5F9] rounded-lg flex items-center justify-center border border-[#E2E8F0]">
                <Shirt className="h-10 w-10 text-[#94A3B8]" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STAGE PROGRESS TRACKER */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Layers className="h-4.5 w-4.5 text-[#6366F1]" />
          Production Stages Progress
        </h3>
        <StageProgressTracker stages={trackerStages} />
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Stage Entries */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Stage Entries Logs
              </h3>
              <button
                type="button"
                onClick={() => router.push(`/production/stage-entries/new?lot_id=${lot.id}`)}
                disabled={lot.status === "completed"}
                className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold text-xs px-3.5 h-9 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                Add Stage Entry
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Entry Date</th>
                    <th className="py-2.5 px-3 text-right">Qty In</th>
                    <th className="py-2.5 px-3 text-right">Qty Out</th>
                    <th className="py-2.5 px-3 text-right">Wastage</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3">Worker</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-sm">
                  {stageEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-[#64748B]">
                        No stage entries logged yet.
                      </td>
                    </tr>
                  ) : (
                    stageEntries.map((entry: any, idx: number) => {
                      const wastagePercent = entry.qty_in > 0 ? ((entry.wastage_qty || 0) / entry.qty_in * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={entry.id} className="hover:bg-[#F9FAFB]">
                          <td className="py-3 px-3 text-[#64748B] font-medium">{idx + 1}</td>
                          <td className="py-3 px-3 font-semibold text-[#374151]">
                            {entry.stage?.stage_name || "—"}
                          </td>
                          <td className="py-3 px-3">{entry.entry_date}</td>
                          <td className="py-3 px-3 text-right font-medium">{entry.qty_in}</td>
                          <td className="py-3 px-3 text-right font-semibold text-[#374151]">
                            {entry.qty_out || "—"}
                          </td>
                          <td className="py-3 px-3 text-right text-[#D97706] font-medium">
                            {entry.wastage_qty > 0 ? `${entry.wastage_qty} (${wastagePercent}%)` : "0"}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-xs">
                            ₹{(entry.job_work_rate || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 font-medium">
                            {entry.worker?.name || "—"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                entry.status === "completed"
                                  ? "bg-[#DCFCE7] text-[#15803D]"
                                  : entry.status === "in_progress"
                                  ? "bg-[#DBEAFE] text-[#1D4ED8]"
                                  : "bg-[#F1F5F9] text-[#64748B]"
                              }`}
                            >
                              {entry.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Link
                              href={`/production/stage-entries/${entry.id}`}
                              className="w-7 h-7 border border-[#E5E7EB] rounded flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors"
                              title="View Details"
                            >
                              <Eye size={12} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <span className="text-xs text-[#64748B] px-1">
            Showing {stageEntries.length} entries.
          </span>
        </div>

        {/* Right Col: Lot Summary card */}
        <div className="lg:col-span-1 space-y-6">
          <LotSummaryPanel title="Lot Summary" items={rightPanelItems} />
        </div>
      </div>

      {/* BOTTOM NOTE BANNER */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0" />
        <div className="text-sm text-[#1E40AF]">
          <span className="font-bold">Note:</span> Mark the lot as complete once all stages are finished and production quantities are verified. Completed lots will update finished stock counts.
        </div>
      </div>
    </div>
  );
}
