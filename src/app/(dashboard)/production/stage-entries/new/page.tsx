"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Package,
  IndianRupee,
  Users,
  FileText,
  GitBranch,
  Save,
  CheckCircle,
  Lightbulb,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";

interface Lot {
  id: string;
  lot_number: string;
  total_quantity: number;
  completed_quantity: number;
  brand?: { name: string };
  design?: { name: string; code: string };
  colour?: { colour_name: string; hex_code: string | null };
  size_set?: { name: string; sizes: string[] };
}

interface Worker {
  id: string;
  name: string;
  worker_id: string;
  type: string;
  default_rate: number;
}

interface LotStage {
  id: string;
  stage_id: string;
  stage_name: string;
  stage_type: string;
  sequence_no: number;
  status: string;
}

export default function NewStageEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Selected Lot ID (prefilled from URL query if present)
  const [selectedLotId, setSelectedLotId] = useState(searchParams.get("lot_id") || "");

  // Form Fields
  const [stageId, setStageId] = useState(""); // lot_stage_id
  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
  const [shift, setShift] = useState("day");

  const [qtyIn, setQtyIn] = useState(0);
  const [qtyOut, setQtyOut] = useState(0);
  const [wastageQty, setWastageQty] = useState(0);
  const [jobWorkType, setJobWorkType] = useState("");
  const [jobWorkRate, setJobWorkRate] = useState(0);
  const [paymentType, setPaymentType] = useState("piece_rate");
  const [workerId, setWorkerId] = useState("");
  const [noOfWorkers, setNoOfWorkers] = useState(1);
  const [remarks, setRemarks] = useState("");

  // Custom fields
  const [threadColour, setThreadColour] = useState("White");
  const [machineUsed, setMachineUsed] = useState("JUKI DDL-8700");

  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch In-Progress Production Lots
  const { data: lotsData } = useQuery<{ lots: Lot[] }>({
    queryKey: ["lots-in-progress"],
    queryFn: async () => {
      const res = await fetch("/api/production/lots?status=in_progress");
      return res.json();
    },
  });

  // 2. Fetch Active Workers
  const { data: workersData } = useQuery<{ workers: Worker[] }>({
    queryKey: ["workers-active"],
    queryFn: async () => {
      const res = await fetch("/api/workers?active=true");
      return res.json();
    },
  });

  // 3. Fetch Selected Lot Details (stages, sizes, prev entries)
  const { data: lotDetailData, isLoading: loadingLotDetail } = useQuery({
    queryKey: ["lot-detail", selectedLotId],
    queryFn: async () => {
      if (!selectedLotId) return null;
      const res = await fetch(`/api/production/lots/${selectedLotId}`);
      if (!res.ok) throw new Error("Failed to fetch lot detail");
      return res.json();
    },
    enabled: !!selectedLotId,
  });

  const lots = lotsData?.lots || [];
  const workers = workersData?.workers || [];
  const activeLot = lotDetailData?.lot || null;
  const lotStages: LotStage[] = lotDetailData?.stages || [];
  const stageEntries = lotDetailData?.stageEntries || [];

  // Filter out stages to only show pending or in_progress stages
  const activeStages = lotStages.filter((s) => s.status !== "completed");

  // Selected lot stage info
  const selectedLotStage = lotStages.find((s) => s.id === stageId);

  // Sync Job Work Type and prefilled Qty In when stage changes
  useEffect(() => {
    if (selectedLotStage && activeLot) {
      setJobWorkType(selectedLotStage.stage_name);

      // Find previous stage in sequence
      const prevStage = lotStages.find(
        (s) => s.sequence_no === selectedLotStage.sequence_no - 1
      );

      if (prevStage) {
        // Find sum of qty_out of previous stage entries
        const prevEntries = stageEntries.filter((e: any) => e.lot_stage_id === prevStage.id);
        const prevQtyOutSum = prevEntries.reduce((acc: number, curr: any) => acc + (curr.qty_out || 0), 0);
        setQtyIn(prevQtyOutSum);
        setQtyOut(prevQtyOutSum);
      } else {
        // First stage: Qty In is the total lot quantity
        setQtyIn(activeLot.total_quantity || 0);
        setQtyOut(activeLot.total_quantity || 0);
      }
    }
  }, [stageId, selectedLotStage, activeLot, lotStages, stageEntries]);

  // Sync worker default rate when worker changes
  useEffect(() => {
    if (workerId) {
      const selectedWorker = workers.find((w) => w.id === workerId);
      if (selectedWorker) {
        setJobWorkRate(selectedWorker.default_rate || 0);
      }
    }
  }, [workerId, workers]);

  // Auto-calculate wastage when qtyOut changes
  useEffect(() => {
    const diff = qtyIn - qtyOut;
    setWastageQty(diff > 0 ? diff : 0);
  }, [qtyIn, qtyOut]);

  // Computations for right panels
  const wastagePercent = qtyIn > 0 ? ((wastageQty / qtyIn) * 100).toFixed(2) : "0.00";
  const qtyBalance = qtyIn - qtyOut - wastageQty;
  const totalJobWorkAmount = qtyOut * jobWorkRate;
  const totalLaborCost = totalJobWorkAmount;

  const handleSaveEntry = async () => {
    if (!selectedLotId || !stageId || !entryDate || qtyOut <= 0) {
      toast.error("Please fill in all required fields and complete quantity details");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        lot_id: selectedLotId,
        lot_stage_id: stageId,
        entry_date: entryDate,
        shift,
        qty_in: qtyIn,
        qty_out: qtyOut,
        wastage_qty: wastageQty,
        job_work_type: jobWorkType,
        job_work_rate: jobWorkRate,
        payment_type: paymentType,
        worker_id: workerId || null,
        no_of_workers: noOfWorkers,
        remarks,
        custom_field_values: {
          thread_colour: threadColour,
          machine_used: machineUsed,
        },
      };

      const res = await fetch("/api/production/stage-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save entry");

      toast.success("Stage entry logged successfully");
      router.push(`/production/lots/${selectedLotId}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to log entry");
    } finally {
      setSubmitting(false);
    }
  };

  // Summary items
  const lotSummaryItems = activeLot
    ? [
        { label: "Lot No.", value: activeLot.lot_number },
        { label: "Design", value: activeLot.design?.code ? `${activeLot.design.code} - ${activeLot.design.name}` : "—" },
        { label: "Colour", value: activeLot.colour?.colour_name || "—" },
        { label: "Size Set", value: activeLot.size_set?.sizes ? activeLot.size_set.sizes.join(", ") : "—" },
        { label: "Total Lot Qty", value: `${activeLot.total_quantity?.toLocaleString("en-IN")} Pcs`, isQuantity: true },
        { label: "Completed Qty", value: `${activeLot.completed_quantity?.toLocaleString("en-IN")} Pcs` },
      ]
    : [];

  const stageSummaryItems = selectedLotStage
    ? [
        { label: "Expected In Qty", value: qtyIn.toLocaleString("en-IN") },
        { label: "Qty Out (This Entry)", value: qtyOut.toLocaleString("en-IN") },
        { label: "Wastage Qty", value: wastageQty.toLocaleString("en-IN") },
        { label: "Balance Qty", value: qtyBalance.toLocaleString("en-IN") },
      ]
    : [];

  const financialSummaryItems = [
    { label: "Rate (Per Pc)", value: `₹${jobWorkRate.toFixed(2)}` },
    { label: "Total Job Work Amount", value: formatCurrency(totalJobWorkAmount), isQuantity: true },
    { label: "Labor Cost", value: formatCurrency(totalLaborCost) },
  ];

  function formatCurrency(val: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  }

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Production
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <Link href="/production/stage-entries" className="hover:text-[#6366F1] transition-colors">
          Stage Entries
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Add Stage Entry</span>
      </nav>

      {/* Title & Actions */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedLotId) router.push(`/production/lots/${selectedLotId}`);
              else router.push("/production/lots");
            }}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Add Stage Entry</h2>
            <p className="text-xs text-[#64748B]">Log daily production output and wastage metrics</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveEntry}
          disabled={submitting || qtyOut <= 0}
          className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold text-sm px-5 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
        >
          <Save size={16} />
          Save Entry
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Lot & Stage Information */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF2FF] text-[#6366F1] font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Lot & Stage Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Lot Number <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedLotId}
                  onChange={(e) => {
                    setSelectedLotId(e.target.value);
                    setStageId("");
                  }}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="">Select Lot</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lot_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Production Stage <span className="text-red-500">*</span>
                </label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  disabled={!selectedLotId}
                >
                  <option value="">Select Stage</option>
                  {activeStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sequence_no} - {s.stage_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Entry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Shift</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="day">Day Shift (9:00 AM - 6:00 PM)</option>
                  <option value="night">Night Shift (8:00 PM - 5:00 AM)</option>
                </select>
              </div>
            </div>

            {/* INFO ROW BAR */}
            {activeLot && (
              <div className="bg-[#F9FAFB] rounded-lg px-4 py-3 border border-[#E5E7EB] flex flex-wrap items-center gap-x-8 gap-y-2 text-xs font-medium text-[#475569]">
                <div>
                  <span className="text-[#64748B] block">Brand:</span>
                  <span className="font-bold text-[#374151]">{activeLot.brand?.name || "—"}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Design:</span>
                  <span className="font-bold text-[#374151]">{activeLot.design?.code} - {activeLot.design?.name}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Colour:</span>
                  <span className="font-bold text-[#374151] flex items-center gap-1">
                    {activeLot.colour?.hex_code && (
                      <span className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{ backgroundColor: activeLot.colour.hex_code }} />
                    )}
                    {activeLot.colour?.colour_name || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Size Set:</span>
                  <span className="font-bold text-[#374151]">{activeLot.size_set?.sizes?.join(", ") || "—"}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Total Lot Qty:</span>
                  <span className="font-bold text-[#6366F1]">{activeLot.total_quantity} Pcs</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Quantity Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Quantity Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Qty In (From Prev) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={qtyIn}
                  onChange={(e) => setQtyIn(parseInt(e.target.value, 10) || 0)}
                  disabled={!!stageId} // read only if stage calculated it
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm focus:outline-none font-semibold text-[#475569]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Qty Out (Processed) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={qtyOut}
                  onChange={(e) => setQtyOut(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-bold text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Wastage Qty</label>
                <input
                  type="number"
                  min="0"
                  value={wastageQty}
                  onChange={(e) => setWastageQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-semibold text-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Wastage %</label>
                <input
                  type="text"
                  value={`${wastagePercent}%`}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm font-semibold text-[#475569]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Qty Balance</label>
                <input
                  type="number"
                  value={qtyBalance}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm font-semibold text-[#475569]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Job Work Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#F0FDF4] text-[#16A34A] font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Job Work Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Job Work Type</label>
                <input
                  type="text"
                  value={jobWorkType}
                  onChange={(e) => setJobWorkType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                  placeholder="e.g. Stitching"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Rate (Per Pc)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748B] font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={jobWorkRate}
                    onChange={(e) => setJobWorkRate(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white pl-7 pr-3 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Total Amount
                </label>
                <input
                  type="text"
                  value={formatCurrency(totalJobWorkAmount)}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm font-bold text-[#374151]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                >
                  <option value="piece_rate">Piece Rate</option>
                  <option value="fixed">Fixed Rate</option>
                  <option value="per_day">Per Day / Daily Wage</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Worker Assignment */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF2FF] text-[#6366F1] font-bold text-xs flex items-center justify-center">
                4
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Worker Assignment
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Assign Worker <span className="text-red-500">*</span>
                </label>
                <select
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                >
                  <option value="">Select Worker</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.worker_id} - {w.name} ({w.type.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Worker Type</label>
                <input
                  type="text"
                  value={
                    workerId
                      ? workers.find((w) => w.id === workerId)?.type?.replace("_", " ") || "—"
                      : "—"
                  }
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm capitalize text-[#64748B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">No. of Workers</label>
                <input
                  type="number"
                  min="1"
                  value={noOfWorkers}
                  onChange={(e) => setNoOfWorkers(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Total Labor Cost
                </label>
                <input
                  type="text"
                  value={formatCurrency(totalLaborCost)}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm font-bold text-[#374151]"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Additional Info */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#FEF9C3] text-[#D97706] font-bold text-xs flex items-center justify-center">
                5
              </span>
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Additional Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Remarks</label>
                <textarea
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={250}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm resize-none"
                  placeholder="Additional entry details..."
                />
                <span className="text-[10px] text-[#94A3B8] font-bold block text-right mt-1">
                  {remarks.length} / 250 characters
                </span>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-[#374151] uppercase tracking-wide">
                  Custom Fields
                </label>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase">Thread Colour</label>
                  <select
                    value={threadColour}
                    onChange={(e) => setThreadColour(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs"
                  >
                    <option value="White">White</option>
                    <option value="Black">Black</option>
                    <option value="Red">Red</option>
                    <option value="Blue">Blue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] mb-1.5 uppercase">Machine Used</label>
                  <input
                    type="text"
                    value={machineUsed}
                    onChange={(e) => setMachineUsed(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Attachments</label>
                <div className="flex flex-col items-center justify-center border border-dashed border-[#D1D5DB] rounded-lg p-5 bg-[#F9FAFB] hover:border-[#6366F1] transition-colors">
                  <span className="text-[10px] font-bold text-[#475569] text-center mb-1">
                    Drag files here to upload
                  </span>
                  <span className="text-[9px] text-[#94A3B8] text-center mb-3">
                    JPG, PNG, PDF (Max. 5MB)
                  </span>
                  <label className="bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-bold text-[9px] px-3 py-1.5 rounded transition-all cursor-pointer">
                    Browse Files
                    <input type="file" className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summaries */}
        <div className="space-y-6">
          {/* Lot Summary */}
          {activeLot && (
            <LotSummaryPanel title="Lot Details Summary" items={lotSummaryItems} />
          )}

          {/* Stage Summary */}
          {selectedLotStage && (
            <LotSummaryPanel
              title={`Stage Summary (${selectedLotStage.stage_name})`}
              items={stageSummaryItems}
            />
          )}

          {/* Financial Summary */}
          <LotSummaryPanel title="Financial Summary (This Entry)" items={financialSummaryItems} />

          {/* Note Card */}
          <div className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-4 flex gap-3">
            <CheckCircle className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-bold text-[#15803D] block">Note</span>
              <p className="text-xs text-[#374151] leading-relaxed mt-1">
                After saving, the quantity will be updated and made available for the next stage in the lot&apos;s production line.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
