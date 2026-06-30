"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Edit,
  ChevronRight,
  FileText,
  Package,
  IndianRupee,
  Users,
  Settings,
  Clock,
  ClipboardList,
  BarChart2,
  Lightbulb,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import CardSectionHeader from "@/components/shared/CardSectionHeader";
import HorizontalTimeline from "@/components/shared/HorizontalTimeline";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";

interface StageEntryDetailProps {
  params: { id: string };
}

export default function StageEntryDetailPage({ params }: StageEntryDetailProps) {
  const { id } = params;
  const router = useRouter();

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

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[#64748B]">Loading stage entry details...</span>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <span className="text-sm font-semibold text-red-500">Failed to load stage entry</span>
        <Link href="/production/lots" className="text-xs text-[#6366F1] hover:underline">
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
      time: new Date(entry.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
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
    { label: "Size Set", value: entry.lot?.size_set?.sizes ? entry.lot.size_set.sizes.join(", ") : "—" },
    { label: "Stage", value: entry.stage?.stage_name || "—" },
    { label: "Stage Sequence", value: `${entry.stage?.sequence_no || 0} of ${totalStagesCount}` },
  ];

  const qtySummaryItems = [
    { label: "Total Lot Quantity", value: entry.lot?.total_quantity || 0 },
    { label: "Completed Qty (Till Prev Stage)", value: qtyIn },
    { label: "This Stage - Qty Out", value: qtyOut },
    { label: "Pending Quantity", value: entry.lot?.total_quantity - entry.lot?.completed_quantity },
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
              ? "bg-[#DCFCE7] text-[#15803D]"
              : entry.payment_status === "partial"
              ? "bg-[#FFF7ED] text-[#D97706]"
              : "bg-[#FEE2E2] text-[#DC2626]"
          }`}
        >
          {entry.payment_status || "unpaid"}
        </span>
      ),
    },
    { label: "Paid Amount", value: formatCurrency(entry.paid_amount || 0) },
    { label: "Balance Payable", value: formatCurrency((entry.total_job_work_amount || 0) - (entry.paid_amount || 0)) },
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
            <Link href={`/production/lots/${entry.lot_id}`} className="hover:text-[#6366F1] transition-colors">
              Lot Detail
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Stage Entry Detail</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Stage Entry Detail
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/production/lots/${entry.lot_id}`}
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <ArrowLeft size={16} />
            Back to Lot Detail
          </Link>
          <button
            onClick={() => window.print()}
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <Printer size={16} />
            Print Entry
          </button>
        </div>
      </div>

      {/* ENTRY HEADER CARD */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 border-b lg:border-b-0 lg:border-r border-[#F3F4F6] pb-4 lg:pb-0 pr-6 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center shadow-sm shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-black text-[#0F172A] font-mono leading-none">
                  {entry.entry_number}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#DCFCE7] text-[#15803D]">
                  Completed
                </span>
              </div>
              <p className="text-[10px] text-[#94A3B8] font-bold mt-1.5 uppercase tracking-wide">
                Reference ID: {entry.id}
              </p>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-6 text-sm">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Lot No.</span>
              <span className="text-sm font-semibold text-[#6366F1] mt-0.5 block font-mono">
                <Link href={`/production/lots/${entry.lot_id}`} className="hover:underline">
                  {entry.lot?.lot_number}
                </Link>
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Production Stage</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">
                {entry.stage?.stage_name}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Entry Date</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">
                {entry.entry_date}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Shift</span>
              <span className="text-sm font-semibold text-[#374151] capitalize mt-0.5 block">
                {entry.shift} Shift
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Created By</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">
                System
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Logged On</span>
              <span className="text-sm font-semibold text-[#374151] mt-0.5 block">
                {new Date(entry.created_at).toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Read-Only Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Quantity Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="quantity" title="Quantity Details" />
            <div className="grid grid-cols-5 gap-4 text-center">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Qty In</span>
                <span className="text-lg font-bold text-[#374151] mt-1 block">{qtyIn}</span>
              </div>
              <div className="bg-green-50 p-3.5 rounded-lg border border-green-100">
                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider block">Qty Out</span>
                <span className="text-lg font-bold text-green-700 mt-1 block">{qtyOut}</span>
              </div>
              <div className="bg-orange-50 p-3.5 rounded-lg border border-orange-100">
                <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">Wastage Qty</span>
                <span className="text-lg font-bold text-orange-700 mt-1 block">{wastageQty}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Wastage %</span>
                <span className="text-lg font-bold text-[#374151] mt-1 block">{wastagePercent}%</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Balance Qty</span>
                <span className="text-lg font-bold text-[#374151] mt-1 block">{qtyBalance}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Job Work Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="job_work" title="Job Work Details" />
            <div className="grid grid-cols-4 gap-4 text-sm text-center">
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">Job Work Type</span>
                <span className="text-sm font-semibold text-[#374151] mt-1 block capitalize">
                  {entry.job_work_type || "—"}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">Rate (Per Pc)</span>
                <span className="text-sm font-semibold text-[#374151] mt-1 block font-mono">
                  ₹{(entry.job_work_rate || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">Payment Type</span>
                <span className="text-sm font-semibold text-[#374151] mt-1 block capitalize">
                  {entry.payment_type ? entry.payment_type.replace("_", " ") : "Piece Rate"}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">Total Amount</span>
                <span className="text-base font-bold text-[#6366F1] mt-1 block">
                  {formatCurrency(entry.total_job_work_amount || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Worker Assignment */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="worker" title="Worker Assignment" />
            <div className="grid grid-cols-4 gap-4 text-sm text-center">
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">Assigned Worker</span>
                <span className="text-sm font-semibold text-[#374151] mt-1 block">
                  {entry.worker?.name || "—"}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">Worker Type</span>
                <span className="text-sm font-semibold text-[#374151] mt-1 block capitalize">
                  {entry.worker_type ? entry.worker_type.replace("_", " ") : "—"}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">No. of Workers</span>
                <span className="text-sm font-semibold text-[#374151] mt-1 block">
                  {entry.no_of_workers || 1}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] text-xs font-semibold block uppercase">Total Labor Cost</span>
                <span className="text-base font-bold text-[#374151] mt-1 block">
                  {formatCurrency(entry.total_labor_cost || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Additional Information */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="info" title="Additional Information" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block border-b border-[#F3F4F6] pb-1.5 mb-2">Remarks</span>
                <p className="text-[#374151] leading-relaxed italic">{entry.remarks || "No remarks entered for this entry."}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block border-b border-[#F3F4F6] pb-1.5 mb-2">Custom Fields</span>
                <div className="space-y-1.5 font-medium">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Thread Colour:</span>
                    <span className="text-[#374151]">{entry.custom_field_values?.thread_colour || "White"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Machine Used:</span>
                    <span className="text-[#374151]">{entry.custom_field_values?.machine_used || "JUKI DDL-8700"}</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block border-b border-[#F3F4F6] pb-1.5 mb-2">Attachments</span>
                <span className="text-[#94A3B8] italic block text-xs">No attachments uploaded</span>
              </div>
            </div>
          </div>

          {/* Card 5: Timeline */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <CardSectionHeader variant="timeline" title="Entry Processing Timeline" />
            <HorizontalTimeline steps={timelineSteps} />
          </div>
        </div>

        {/* Right Column: Summaries */}
        <div className="lg:col-span-1 space-y-6">
          {/* Lot Summary */}
          <LotSummaryPanel title="Lot & Stage Summary" items={lotSummaryItems} />

          {/* Quantity Summary */}
          <LotSummaryPanel title="Quantity Summary (Lot)" items={qtySummaryItems} />

          {/* Financial Summary */}
          <LotSummaryPanel title="Financial Summary (This Entry)" items={financialSummaryItems} />

          {/* Note Card */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 flex gap-2.5">
            <Lightbulb className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-[#D97706] block">Note</span>
              <p className="text-[11px] text-[#374151] leading-relaxed mt-1">
                This entry is locked. You can edit it only if you have admin permissions and need to make manual corrections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
