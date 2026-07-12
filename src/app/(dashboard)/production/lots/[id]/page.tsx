"use client";

import { useState, useEffect } from "react";
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
  Percent,
  TrendingUp,
  DollarSign,
  Settings,
  Boxes
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

  const [activeTab, setActiveTab] = useState("progress");
  
  // Costing inputs state
  const [accessoryCost, setAccessoryCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [isCostSynced, setIsCostSynced] = useState(false);
  const [updatingCost, setUpdatingCost] = useState(false);

  // Move to stock modal state
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetGodownId, setTargetGodownId] = useState("");
  const [confirmDesignCode, setConfirmDesignCode] = useState("");
  const [movingToStock, setMovingToStock] = useState(false);
  const [rollUsages, setRollUsages] = useState<Record<string, number>>({});

  // Fetch lot detail along with sizes, stages, stage entries, rolls, specifications, and spec sheet
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
  const lotRolls = data?.lotRolls || [];
  const specifications = data?.specifications || null;
  const specSheet = data?.specSheet || null;

  // Fetch godowns list for Move to Stock target selection
  const { data: godownsData } = useQuery<{ godowns: any[] }>({
    queryKey: ["godowns-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      return res.json();
    },
  });
  const godowns = godownsData?.godowns || [];

  // Initialize or sync local costing states when lot data is loaded
  if (lot && !isCostSynced) {
    setAccessoryCost(Number(lot.accessory_cost || 0));
    setOtherCost(Number(lot.other_cost || 0));
    setIsCostSynced(true);
  }

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
      toast.success("Production lot marked as completed successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to complete lot");
    },
  });

  const handleSaveCosts = async () => {
    setUpdatingCost(true);
    try {
      const res = await fetch(`/api/production/lots/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessory_cost: accessoryCost,
          other_cost: otherCost,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update costing details");
      }

      toast.success("Costing details updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["lot-detail", id] });
    } catch (err: any) {
      toast.error(err.message || "Error updating costing details");
    } finally {
      setUpdatingCost(false);
    }
  };

  // Sync rollUsages when moveModalOpen changes
  useEffect(() => {
    if (moveModalOpen && lotRolls.length > 0) {
      const initialUsages: Record<string, number> = {};
      lotRolls.forEach((r: any) => {
        initialUsages[r.purchase_roll_id] = Number(r.allocated_meters || 0);
      });
      setRollUsages(initialUsages);
    }
  }, [moveModalOpen, lotRolls]);

  const handleMoveToStock = async () => {
    if (!targetGodownId) {
      toast.error("Please select a target godown");
      return;
    }

    setMovingToStock(true);
    try {
      const res = await fetch(`/api/production/lots/${id}/move-to-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design_number: lot.design?.code,
          godown_id: targetGodownId,
          rolls_usage: Object.entries(rollUsages).map(([rollId, used]) => ({
            purchase_roll_id: rollId,
            used_meters: Number(used)
          }))
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to move lot to finished stock");
      }

      toast.success("Lot successfully moved to Finished Stock!");
      setMoveModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["lot-detail", id] });
    } catch (err: any) {
      toast.error(err.message || "Error moving lot to stock");
    } finally {
      setMovingToStock(false);
    }
  };

  const isDataStale = data && data.lot && data.lot.id !== id;

  if (isLoading || isDataStale) {
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
  const trackerStages = stages.map((st: any) => {
    const entries = stageEntries.filter((e: any) => e.lot_stage_id === st.id);
    const lastEntryDate = entries.length > 0 ? entries[0].entry_date : null;
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

  // Cost calculations
  const totalFabricCost = lotRolls.reduce((acc: number, curr: any) => {
    const rate = Number(curr.purchase_roll?.item?.rate || 0);
    return acc + (Number(curr.allocated_meters || 0) * rate);
  }, 0);

  const totalLaborCost = stageEntries.reduce((acc: number, curr: any) => {
    const rate = Number(curr.job_work_rate || 0);
    const qty = Number(curr.qty_out || 0);
    return acc + (qty * rate);
  }, 0);

  const totalLotCost = totalFabricCost + totalLaborCost + Number(lot.accessory_cost || 0) + Number(lot.other_cost || 0);
  const perPieceCost = totalQty > 0 ? (totalLotCost / totalQty) : 0;

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
    { label: "Total Stages", value: totalStagesCount },
    { label: "Completed Stages", value: completedStagesCount },
    { label: "In Progress Stages", value: inProgressStagesCount },
    { label: "Pending Stages", value: pendingStagesCount },
    { label: "Unit Costing Est.", value: <span className="font-mono font-bold text-slate-800">{formatCurrency(perPieceCost)} / pc</span> },
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
              type="button"
              onClick={() => setMoveModalOpen(true)}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
            >
              <Boxes size={16} />
              Complete Lot & Move to Stock
            </button>
          )}
        </div>
      </div>

      {/* LOT HEADER CARD */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6 items-stretch">
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
            {lot.lot_name && (
              <p className="text-sm font-bold text-slate-700 mt-1">{lot.lot_name}</p>
            )}
            <p className="text-xs text-[#64748B] mt-2 font-medium">
              Registered Date: {lot.lot_date}
            </p>
          </div>

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

      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("progress")}
          className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "progress"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Progress & Logs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("costing")}
          className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === "costing"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Lot Costing & Valuation
        </button>
      </div>

      {/* ========================================================
          TAB 1: PROGRESS & LOGS
          ======================================================== */}
      {activeTab === "progress" && (
        <div className="space-y-6 animate-fadeIn">
          {/* STAGE PROGRESS TRACKER */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-[#6366F1]" />
              Production Stages Progress
            </h3>
            <StageProgressTracker stages={trackerStages} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
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
                          <td colSpan={10} className="py-6 text-center text-[#64748B] text-xs">
                            No stage entries logged yet.
                          </td>
                        </tr>
                      ) : (
                        stageEntries.map((entry: any, idx: number) => {
                          const wastagePercent = entry.qty_in > 0 ? ((entry.wastage_qty || 0) / entry.qty_in * 100).toFixed(1) : "0.0";
                          return (
                            <tr key={entry.id} className="hover:bg-[#F9FAFB] text-xs">
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
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
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
                                  className="w-7 h-7 border border-[#E5E7EB] rounded flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors mx-auto"
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
              <span className="text-xs text-[#64748B] px-1 mt-4 block">
                Showing {stageEntries.length} entries.
              </span>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <LotSummaryPanel title="Lot Summary" items={rightPanelItems} />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: COSTING & VALUATION
          ======================================================== */}
      {activeTab === "costing" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Left Cost Detail Cards (Span 2) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Fabric consumption costing (Option B) */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
                <Shirt className="h-4.5 w-4.5 text-indigo-600" />
                1. Allocated Fabric Cost
              </h3>
              
              {lotRolls.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">No fabric rolls allocated to this production lot.</div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[9px]">
                        <th className="p-2.5">Roll identifier</th>
                        <th className="p-2.5 text-center">Allocated (Mtr)</th>
                        <th className="p-2.5 text-right">Purchase Rate (Mtr)</th>
                        <th className="p-2.5 text-right">Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lotRolls.map((roll: any) => {
                        const rate = Number(roll.purchase_roll?.item?.rate || 0);
                        const cost = Number(roll.allocated_meters || 0) * rate;
                        return (
                          <tr key={roll.id}>
                            <td className="p-2.5 font-semibold text-slate-700">
                              Roll #{roll.purchase_roll?.roll_number} ({roll.purchase_roll?.shade}) - {roll.purchase_roll?.item?.material_type?.name}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                              {roll.allocated_meters} {roll.purchase_roll?.item?.material_type?.unit || "Mtr"}
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(rate)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatCurrency(cost)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50/50 font-bold">
                        <td className="p-2.5 text-slate-800">Total Fabric Cost</td>
                        <td className="p-2.5 text-center font-mono">{lotRolls.reduce((a: number, b: any) => a + Number(b.allocated_meters), 0).toFixed(1)} Mtr</td>
                        <td className="p-2.5"></td>
                        <td className="p-2.5 text-right font-mono text-indigo-700">{formatCurrency(totalFabricCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Labor / Job work costing */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-green-600" />
                2. Production Labor / Job-Work Cost
              </h3>

              {stageEntries.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">No stage entries logged with labor costs.</div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[9px]">
                        <th className="p-2.5">Stage</th>
                        <th className="p-2.5">Worker Name</th>
                        <th className="p-2.5 text-center">Qty Produced</th>
                        <th className="p-2.5 text-right">Job-Work Rate</th>
                        <th className="p-2.5 text-right">Subtotal Labor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stageEntries.map((entry: any) => {
                        const qty = Number(entry.qty_out || 0);
                        const rate = Number(entry.job_work_rate || 0);
                        const cost = qty * rate;
                        return (
                          <tr key={entry.id}>
                            <td className="p-2.5 font-semibold text-slate-700">{entry.stage?.stage_name}</td>
                            <td className="p-2.5 text-slate-500">{entry.worker?.name || "General"}</td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-700">{qty} pcs</td>
                            <td className="p-2.5 text-right font-mono text-slate-600">{formatCurrency(rate)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatCurrency(cost)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50/50 font-bold">
                        <td className="p-2.5 text-slate-800" colSpan={2}>Total Labor Cost</td>
                        <td className="p-2.5 text-center font-mono">{stageEntries.reduce((a: number, b: any) => a + Number(b.qty_out || 0), 0)} pcs</td>
                        <td className="p-2.5"></td>
                        <td className="p-2.5 text-right font-mono text-green-700">{formatCurrency(totalLaborCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Accessory & other costs editor */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
                <Settings className="h-4.5 w-4.5 text-amber-600" />
                3. Accessory & Other Custom Costs
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Accessory Costs (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={accessoryCost || ""}
                    onChange={(e) => setAccessoryCost(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. Buttons, thread, labels"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Other / Transport Costs (INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={otherCost || ""}
                    onChange={(e) => setOtherCost(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. Packing, logistics"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveCosts}
                  disabled={updatingCost}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                >
                  {updatingCost ? "Saving..." : "Save Custom Costs"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Summary Costing Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-5">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="h-4.5 w-4.5 text-indigo-600" />
                Overall Lot Costing
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Fabric Consumption Cost:</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatCurrency(totalFabricCost)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Total Labor Cost:</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatCurrency(totalLaborCost)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Accessory Cost:</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatCurrency(lot.accessory_cost || 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Other Costs:</span>
                  <span className="font-semibold text-slate-800 font-mono">{formatCurrency(lot.other_cost || 0)}</span>
                </div>
                
                <div className="flex justify-between py-3 border-b border-slate-200 text-sm font-black bg-indigo-50/20 px-2 rounded">
                  <span className="text-indigo-900">Total Lot Cost:</span>
                  <span className="text-indigo-700 font-mono">{formatCurrency(totalLotCost)}</span>
                </div>

                <div className="flex justify-between py-3 border-b border-slate-200 text-sm font-black bg-emerald-50/20 px-2 rounded">
                  <span className="text-emerald-900">Per-Piece Cost:</span>
                  <span className="text-emerald-700 font-mono">{formatCurrency(perPieceCost)} / pc</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOVE TO STOCK DIALOG OVERLAY */}
      {moveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">
              Move Lot to Finished Stock
            </h3>
            <p className="text-xs text-slate-500 leading-normal">
              This action will finalize the production lot and add <strong className="font-bold text-slate-900">{totalQty} pieces</strong> of design <strong className="font-bold text-slate-900">{lot.design?.code}</strong> to the selected finished goods godown.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Godown</label>
                <select
                  value={targetGodownId}
                  onChange={(e) => setTargetGodownId(e.target.value)}
                  className="w-full h-9 rounded border border-slate-200 px-3 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select Godown</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {lotRolls.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Actually Consumed Fabric (Meters)
                  </label>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Enter the actual quantity consumed for each allocated roll. Any remaining balance will be returned to purchase stock.
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {lotRolls.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-600 truncate">
                          Roll #{r.purchase_roll?.roll_number} ({r.purchase_roll?.shade})
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max={r.allocated_meters}
                            value={rollUsages[r.purchase_roll_id] ?? r.allocated_meters}
                            onChange={(e) => setRollUsages({
                              ...rollUsages,
                              [r.purchase_roll_id]: parseFloat(e.target.value) || 0
                            })}
                            className="w-16 h-8 text-right px-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">/ {r.allocated_meters}m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMoveModalOpen(false)}
                className="h-9 px-4 border border-slate-200 rounded text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMoveToStock}
                disabled={movingToStock}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {movingToStock ? "Moving..." : "Confirm & Move"}
              </button>
            </div>
          </div>
        </div>
      )}

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
