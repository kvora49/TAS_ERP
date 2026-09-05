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
  Layers,
  Shirt,
  Boxes,
  Package,
  BookOpen
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PageState from "@/components/shared/PageState";
import StageProgressTracker from "@/components/shared/StageProgressTracker";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";
import { MoveToStockDialog } from "./_components/MoveToStockDialog";
import { LotCostingPanel } from "./_components/LotCostingPanel";
import { AddStageDialog } from "./_components/AddStageDialog";
import DefectManagement from "./_components/DefectManagement";
import { AlertTriangle } from "lucide-react";

interface LotDetailProps {
  params: { id: string };
}

export default function LotDetailPage({ params }: LotDetailProps) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("progress");
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [accessoryCost, setAccessoryCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [isCostSynced, setIsCostSynced] = useState(false);

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
  const lotAccessories = data?.lotAccessories || [];
  const specifications = data?.specifications || null;
  const specSheet = data?.specSheet || null;
  const defects = data?.defects || [];

  // Fetch godowns list for Move to Stock target selection
  const { data: godownsData } = useQuery<{ godowns: any[] }>({
    queryKey: ["godowns-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      return res.json();
    },
  });
  const godowns = godownsData?.godowns || [];

  // Fetch master stages and active workers for Add Stage modal
  const { data: masterStagesData } = useQuery({
    queryKey: ["master-stages-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-stages");
      return res.json();
    },
  });
  const masterStages = masterStagesData?.stages || [];

  const { data: workersData } = useQuery({
    queryKey: ["workers-active-list"],
    queryFn: async () => {
      const res = await fetch("/api/workers?active=true");
      return res.json();
    },
  });
  const workers = workersData?.workers || [];

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

  // Remove: handleSaveCosts moved to LotCostingPanel
  // Remove: handleMoveToStock moved to MoveToStockDialog
  // Remove: useEffect for rollUsages moved to MoveToStockDialog

  const isDataStale = data && data.lot && data.lot.id !== id;

  if (isLoading || isDataStale) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <PageState
          isLoading={true}
          skeletonVariant="card"
          skeletonCount={3}
        >
          <div />
        </PageState>
      </div>
    );
  }

  if (error || !lot) {
    return (
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <PageState
          isLoading={false}
          isError={true}
          error={error instanceof Error ? error.message : "Failed to load production lot"}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["lot-detail", id] })}
        >
          <div />
        </PageState>
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

  // Colour lookup map for resolving colour UUIDs to names & swatches
  const colourLookup = new Map<string, any>();
  if (lot.colour) colourLookup.set(lot.colour.id, lot.colour);
  (lot.colours || []).forEach((c: any) => colourLookup.set(c.id, c));
  sizes.forEach((s: any) => {
    if (s.colour?.id) colourLookup.set(s.colour.id, s.colour);
  });

  // Map database stages into StageProgressTracker nodes
  const trackerStages = stages.map((st: any) => {
    const entries = stageEntries.filter((e: any) => e.lot_stage_id === st.id);
    const lastEntryDate = entries.length > 0 ? entries[entries.length - 1].entry_date : null;
    const stageQtyOut = entries.reduce((acc: number, curr: any) => acc + (curr.qty_out || 0), 0);

    return {
      id: st.id,
      name: st.stage_name,
      status: st.status,
      date: lastEntryDate,
      qty: stageQtyOut > 0 ? stageQtyOut : null,
      targetQty: totalQty,
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
    {
      label: "Days in Working Stage",
      value: (
        <span className="font-semibold text-blue-600">
          ⏱️ {lot.days_in_working_stage || 1} {lot.days_in_working_stage === 1 ? "day" : "days"}
        </span>
      ),
    },
    {
      label: "Worker Completion Time",
      value: (
        <span className="font-semibold text-emerald-600">
          🏁 {lot.status === "completed" ? `${lot.days_taken_to_complete || lot.days_in_working_stage || 1} days` : "In Progress"}
        </span>
      ),
    },
    {
      label: "Labor Payment Status",
      value: (
        <span
          className={`font-bold uppercase text-xs px-2 py-0.5 rounded-full ${
            lot.lot_payment_status === "paid"
              ? "bg-emerald-100 text-emerald-700"
              : lot.lot_payment_status === "partial"
              ? "bg-amber-100 text-amber-700"
              : lot.lot_payment_status === "unpaid"
              ? "bg-rose-100 text-rose-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {lot.lot_payment_status || "none"}
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
    <div className="p-4 md:p-6 space-y-6 select-none max-w-[1400px] mx-auto pb-20 md:pb-6">

      {/* Breadcrumbs and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-1 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[var(--primary)] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
            <Link href="/production/lots" className="hover:text-[var(--primary)] transition-colors">
              Production Lots
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
            <span className="text-[var(--text-secondary)]">{lot.lot_number}</span>
          </nav>
          <h1 className="text-xl sm:text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
            Lot Detail
          </h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/production/lots"
            className="flex-1 sm:flex-initial border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-semibold text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[var(--card-bg)]"
          >
            <ArrowLeft size={15} />
            <span>Back</span>
          </Link>
          <Link
            href={`/production/lots/${id}/edit`}
            className="flex-1 sm:flex-initial border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-semibold text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[var(--card-bg)]"
          >
            <Pencil size={15} />
            <span>Edit</span>
          </Link>
          {lot.is_moved_to_stock ? (
            <span className="flex-1 sm:flex-initial bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold text-xs px-3 sm:px-3.5 h-9 sm:h-10 rounded-lg flex items-center justify-center gap-1.5 shadow-xs">
              <CheckCircle2 size={15} className="text-emerald-500" />
              <span>Stock Moved</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setMoveModalOpen(true)}
              className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Boxes size={15} />
              <span>Move to Stock</span>
            </button>
          )}
        </div>
      </div>

      {/* LOT HEADER CARD */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 sm:gap-6 items-stretch">
          <div className="lg:col-span-2 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-[var(--border-light)] pb-4 lg:pb-0 pr-0 lg:pr-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl font-black text-[var(--text-primary)] font-mono leading-none">
                {lot.lot_number}
              </span>
              <span
                className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider select-none",
                  lot.status === "in_progress" ? "bg-blue-500/10 text-blue-500" :
                  lot.status === "completed" ? "bg-green-500/10 text-green-500" :
                  lot.status === "on_hold" ? "bg-amber-500/10 text-amber-500" :
                  lot.status === "cancelled" ? "bg-red-500/10 text-red-500" :
                  "bg-[var(--page-bg)] text-[var(--text-muted)]"
                )}
              >
                {lot.status.replace("_", " ")}
              </span>
            </div>
            {lot.lot_name && (
              <p className="text-sm font-bold text-[var(--text-primary)] mt-1">{lot.lot_name}</p>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-1.5 font-medium">
              Registered Date: {lot.lot_date}
            </p>
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-3 gap-y-3 sm:gap-y-4 gap-x-4 sm:gap-x-6 py-2">
            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Brand</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block">{lot.brand?.name || "-"}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Design</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block">
                {lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : "-"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Colour(s)</span>
              <div className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 flex flex-wrap items-center gap-1.5">
                {(lot.colours && lot.colours.length > 0 ? lot.colours : lot.colour ? [lot.colour] : []).map((c: any, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)] bg-[var(--page-bg)] px-2 py-0.5 rounded-md border border-[var(--border)]">
                    {c.hex_code && (
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/20"
                        style={{ backgroundColor: c.hex_code }}
                      />
                    )}
                    {c.colour_name}
                  </span>
                ))}
                {!lot.colour && (!lot.colours || lot.colours.length === 0) && "-"}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Size Set</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block">
                {lot.size_set?.name ? `${lot.size_set.name} (${lot.size_set.sizes.join(", ")})` : lot.size_set?.sizes ? lot.size_set.sizes.join(", ") : "-"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Total Quantity</span>
              <span className="text-sm font-bold text-[var(--primary)] mt-0.5 block">
                {totalQty.toLocaleString("en-IN")} Pcs
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Completed Quantity</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 block">
                {completedQty.toLocaleString("en-IN")} ({percentage}%)
              </span>
            </div>
          </div>

          <div className="lg:col-span-1 flex items-center justify-center shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-light)] pt-3 lg:pt-0 lg:pl-4">
            {lot.design?.image_url ? (
              <img
                src={lot.design.image_url}
                alt="Design image"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-[var(--border)]"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[var(--page-bg)] rounded-lg flex items-center justify-center border border-[var(--border)]">
                <Shirt className="h-8 w-8 sm:h-10 sm:w-10 text-[var(--text-faint)]" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TABS SELECTOR (Scrollable on mobile so Defects & Rework is never clipped) */}
      <div className="flex border-b border-[var(--border)] overflow-x-auto no-scrollbar whitespace-nowrap gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("progress")}
          className={`px-4 sm:px-5 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "progress"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Progress & Logs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("costing")}
          className={`px-4 sm:px-5 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "costing"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Lot Costing & Valuation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`px-4 sm:px-5 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "details"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Lot Specifications & Routing
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("defects")}
          className={`px-4 sm:px-5 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === "defects"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <AlertTriangle size={14} className="text-amber-500" />
          <span>Defects & Rework</span>
          {Number(lot?.defect_quantity || data?.defects?.length || 0) > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] font-extrabold bg-amber-500/15 text-amber-600 rounded-full">
              {lot.defect_quantity || data?.defects?.length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================
          TAB 1: PROGRESS & LOGS
          ======================================================== */}
      {activeTab === "progress" && (
        <div className="space-y-6 animate-fadeIn">
          {/* STAGE PROGRESS TRACKER */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3 mb-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-[var(--primary)]" />
                Production Stages Progress
              </h3>
              <button
                type="button"
                onClick={() => setAddStageOpen(true)}
                className="bg-[var(--primary-light)] hover:opacity-90 text-[var(--primary)] font-bold text-xs px-3 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[var(--border)]"
              >
                <Plus size={14} />
                Add Stage
              </button>
            </div>
            <StageProgressTracker stages={trackerStages} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3 mb-4">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Stage Entries Logs
                  </h3>
                  <button
                    type="button"
                    onClick={() => router.push(`/production/stage-entries/new?lot_id=${lot.id}`)}
                    disabled={lot.status === "completed"}
                    className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-semibold text-xs px-3 h-8 sm:h-9 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Add Stage Entry</span>
                  </button>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-2.5">
                  {stageEntries.length === 0 ? (
                    <div className="py-6 text-center text-[var(--text-faint)] text-xs">
                      No stage entries logged yet.
                    </div>
                  ) : (
                    stageEntries.map((entry: any, idx: number) => {
                      const wastagePercent = entry.qty_in > 0 ? ((entry.wastage_qty || 0) / entry.qty_in * 100).toFixed(1) : "0.0";
                      return (
                        <div key={entry.id} className="bg-[var(--page-bg)] border border-[var(--border)] rounded-lg p-3 space-y-2 shadow-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-[var(--text-muted)]">#{idx + 1}</span>
                              <span className="text-xs font-bold text-[var(--text-primary)]">{entry.stage?.stage_name || "—"}</span>
                            </div>
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                              entry.status === "completed" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" :
                              entry.status === "in_progress" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" :
                              "bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                            )}>
                              {entry.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs py-1.5 border-y border-[var(--border-light)]">
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)] block">Qty In / Out</span>
                              <span className="font-semibold text-[var(--text-primary)]">{entry.qty_in} &rarr; {entry.qty_out || "—"} pcs</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)] block">Rate / Wastage</span>
                              <span className="font-semibold text-[var(--text-primary)]">₹{(entry.job_work_rate || 0).toFixed(2)} | <span className="text-amber-600 dark:text-amber-400">{entry.wastage_qty > 0 ? `${entry.wastage_qty} (${wastagePercent}%)` : "0"}</span></span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                            <span>Worker: <strong className="text-[var(--text-secondary)]">{entry.worker?.name || "—"}</strong></span>
                            <span>{entry.entry_date}</span>
                          </div>

                          <div className="pt-1 flex justify-end">
                            <Link
                              href={`/production/stage-entries/${entry.id}`}
                              className="px-2.5 py-1 text-xs font-semibold rounded border border-[var(--border)] bg-[var(--card-bg)] text-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-colors inline-flex items-center gap-1"
                            >
                              <Eye size={12} />
                              <span>View Entry</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
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
                    <tbody className="divide-y divide-[var(--border)] text-sm">
                      {stageEntries.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-[var(--text-faint)] text-xs">
                            No stage entries logged yet.
                          </td>
                        </tr>
                      ) : (
                        stageEntries.map((entry: any, idx: number) => {
                          const wastagePercent = entry.qty_in > 0 ? ((entry.wastage_qty || 0) / entry.qty_in * 100).toFixed(1) : "0.0";
                          return (
                            <tr key={entry.id} className="hover:bg-[var(--table-row-hover)] text-xs transition-colors">
                              <td className="py-3 px-3 text-[var(--text-muted)] font-medium">{idx + 1}</td>
                              <td className="py-3 px-3 font-semibold text-[var(--text-primary)]">
                                <div>
                                  <span>{entry.stage?.stage_name || "—"}</span>
                                  {entry.custom_field_values && Object.keys(entry.custom_field_values).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Object.entries(entry.custom_field_values).map(([k, v]) => {
                                        const isColourField = k === "colour_id" || k === "color_id";
                                        const matchedColour = isColourField ? (colourLookup.get(String(v)) || entry.colour) : null;

                                        if (isColourField) {
                                          return (
                                            <span
                                              key={k}
                                              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--page-bg)] border border-[var(--border)] rounded-full text-[9px] font-bold text-[var(--text-primary)]"
                                            >
                                              <span
                                                className="w-2 h-2 rounded-full border border-black/20 shrink-0"
                                                style={{ backgroundColor: matchedColour?.hex_code || matchedColour?.colour_hex || "#6366F1" }}
                                              />
                                              <span>{matchedColour?.colour_name || "Colour"}</span>
                                            </span>
                                          );
                                        }

                                        return (
                                          <span key={k} className="px-1.5 py-0.5 bg-[var(--primary-light)] border border-[var(--border)] rounded text-[9px] font-mono font-bold text-[var(--primary)]">
                                            {k}: {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-[var(--text-secondary)]">{entry.entry_date}</td>
                              <td className="py-3 px-3 text-right font-medium text-[var(--text-primary)]">{entry.qty_in}</td>
                              <td className="py-3 px-3 text-right font-semibold text-[var(--text-primary)]">
                                {entry.qty_out || "—"}
                              </td>
                              <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400 font-medium">
                                {entry.wastage_qty > 0 ? `${entry.wastage_qty} (${wastagePercent}%)` : "0"}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-xs text-[var(--text-primary)]">
                                ₹{(entry.job_work_rate || 0).toFixed(2)}
                              </td>
                              <td className="py-3 px-3 font-medium text-[var(--text-secondary)]">
                                {entry.worker?.name || "—"}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    entry.status === "completed"
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : entry.status === "in_progress"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                      : "bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                                  }`}
                                >
                                  {entry.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Link
                                  href={`/production/stage-entries/${entry.id}`}
                                  className="w-7 h-7 border border-[var(--border)] rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-colors mx-auto"
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

      {/* TAB 2: COSTING — rendered by LotCostingPanel */}
      {activeTab === "costing" && (
        <LotCostingPanel
          lotId={id}
          lotRolls={lotRolls}
          lotAccessories={lotAccessories}
          stageEntries={stageEntries}
          accessoryCost={accessoryCost}
          otherCost={otherCost}
          savedAccessoryCost={Number(lot.accessory_cost || 0)}
          savedOtherCost={Number(lot.other_cost || 0)}
          totalQty={totalQty}
          onCostSaved={() => queryClient.invalidateQueries({ queryKey: ["lot-detail", id] })}
        />
      )}

      {/* TAB 3: LOT SPECIFICATIONS, ROUTING & 7-STEP SUMMARY */}
      {activeTab === "details" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">

              {/* 1. SIZE & COLOUR BREAKDOWN MATRIX (Step 4) */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-light)] pb-3 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Boxes className="h-4.5 w-4.5 text-[var(--primary)]" />
                    Color & Size Breakdown Matrix
                  </span>
                  <span className="text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2.5 py-1 rounded-full border border-[var(--border)]">
                    Total: {totalQty} Pcs
                  </span>
                </h3>

                {sizes.length > 0 ? (
                  <div className="overflow-x-auto touch-pan-x">
                    <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                      <thead>
                        <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-2.5">Colour</th>
                          <th className="p-2.5">Size Breakdown</th>
                          <th className="p-2.5 text-right">Total Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-medium">
                        {/* Group sizes by colour */}
                        {Object.entries(
                          sizes.reduce((acc: any, item: any) => {
                            const cName = item.colour?.colour_name || lot.colour?.colour_name || "Standard";
                            if (!acc[cName]) acc[cName] = [];
                            acc[cName].push(item);
                            return acc;
                          }, {})
                        ).map(([cName, items]: [string, any], idx: number) => {
                          const subtotal = items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
                          return (
                            <tr key={idx} className="hover:bg-[var(--table-row-hover)] transition-colors">
                              <td className="p-2.5 font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                                {items[0]?.colour?.hex_code && (
                                  <span
                                    className="w-3 h-3 rounded-full border border-black/20 inline-block"
                                    style={{ backgroundColor: items[0].colour.hex_code }}
                                  />
                                )}
                                {cName}
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-wrap gap-2">
                                  {items.map((sq: any, i: number) => (
                                    <span key={i} className="bg-[var(--page-bg)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px] font-semibold text-[var(--text-secondary)]">
                                      {sq.size}: <strong className="text-[var(--primary)]">{sq.quantity}</strong>
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2.5 text-right font-bold text-[var(--primary)]">
                                {subtotal} Pcs
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)] italic bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">No size quantities logged.</p>
                )}
              </div>

              {/* 2. ALLOCATED FABRIC & ROLLS (Step 1) */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-light)] pb-3 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4.5 w-4.5 text-[var(--primary)]" />
                  Fabric & Roll Allocation ({lotRolls.length} Rolls)
                </h3>

                {lotRolls.length > 0 ? (
                  <div className="overflow-x-auto touch-pan-x">
                    <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                      <thead>
                        <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-2.5">Roll No.</th>
                          <th className="p-2.5">Fabric / Material</th>
                          <th className="p-2.5">Shade / Color</th>
                          <th className="p-2.5 text-right">Allocated Meters</th>
                          <th className="p-2.5 text-right">Est. Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-secondary)]">
                        {lotRolls.map((lr: any, idx: number) => {
                          const roll = lr.purchase_roll;
                          const matName = roll?.item?.material_type?.name || "Fabric Roll";
                          return (
                            <tr key={idx} className="hover:bg-[var(--table-row-hover)] transition-colors">
                              <td className="p-2.5 font-mono font-bold text-[var(--primary)]">{roll?.roll_no || `Roll #${idx + 1}`}</td>
                              <td className="p-2.5 font-semibold text-[var(--text-primary)]">{matName}</td>
                              <td className="p-2.5">{roll?.shade || roll?.color || "—"}</td>
                              <td className="p-2.5 text-right font-bold text-[var(--text-primary)]">{Number(lr.allocated_meters || 0).toFixed(2)} m</td>
                              <td className="p-2.5 text-right font-mono text-[var(--text-muted)]">₹{Number(roll?.item?.rate || 0).toFixed(2)}/m</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)] italic bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">No fabric rolls allocated for this lot.</p>
                )}
              </div>

              {/* 2b. ALLOCATED ACCESSORIES (Step 1) */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
                  <Package className="h-4.5 w-4.5 text-emerald-600" />
                  Allocated Accessories ({lotAccessories.length} Items)
                </h3>

                {lotAccessories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-2.5">Item Name</th>
                          <th className="p-2.5">Godown</th>
                          <th className="p-2.5 text-center">Allocated Qty</th>
                          <th className="p-2.5 text-center">Issued Qty</th>
                          <th className="p-2.5 text-center">Available Pool</th>
                          <th className="p-2.5 text-right">Unit Rate</th>
                          <th className="p-2.5 text-right">Total Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)] bg-[var(--card-bg)]">
                        {lotAccessories.map((acc: any, idx: number) => {
                          const rate = Number(acc.unit_rate || 0);
                          const val = Number(acc.allocated_qty || 0) * rate;
                          return (
                            <tr key={idx} className="hover:bg-[var(--table-row-hover)] transition-colors">
                              <td className="p-2.5 font-semibold text-[var(--text-primary)]">{acc.item_name}</td>
                              <td className="p-2.5 text-[var(--text-muted)]">{acc.godown_name || "—"}</td>
                              <td className="p-2.5 text-center font-mono font-bold text-[var(--text-secondary)]">
                                {acc.allocated_qty} {acc.unit}
                              </td>
                              <td className="p-2.5 text-center font-mono text-[var(--text-muted)]">
                                {acc.total_issued_qty ?? 0} {acc.unit}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-emerald-600">
                                {acc.available_qty ?? acc.allocated_qty} {acc.unit}
                              </td>
                              <td className="p-2.5 text-right font-mono text-[var(--text-muted)]">
                                ₹{rate.toFixed(2)}/{acc.unit}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-[var(--text-primary)]">
                                ₹{val.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)] italic bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">
                    No accessories allocated for this lot.
                  </p>
                )}
              </div>

              {/* 3. ASSIGNED STAGES & WORKERS (Step 5) */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border-light)] pb-3 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-[var(--primary)]" />
                  Assigned Stages & Workers
                </h3>

                {stages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {stages.map((st: any, idx: number) => {
                      const stageEntriesForThis = stageEntries.filter((e: any) => e.lot_stage_id === st.id);
                      const stageQty = stageEntriesForThis.reduce((acc: number, curr: any) => acc + (curr.qty_out || 0), 0);
                      const stageDefects = defects.filter((d: any) => d.detected_at_stage_id === st.id);
                      const inRework = stageDefects
                        .filter((d: any) => ["sent_for_rework", "in_rework", "pending"].includes(d.status))
                        .reduce((s: number, d: any) => s + (d.quantity || 0), 0);

                      let bGradeQty = 0;
                      let scrapQty = 0;
                      stageDefects.forEach((d: any) => {
                        (d.resolutions || []).forEach((res: any) => {
                          bGradeQty += Number(res.qty_b_grade || 0);
                          scrapQty += Number(res.qty_scrapped || 0);
                        });
                      });

                      return (
                        <div key={idx} className="bg-[var(--card-bg)] border border-[var(--border)] p-3 rounded-xl flex flex-col justify-between space-y-2.5 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-[11px] font-bold flex items-center justify-center">
                                {st.sequence_no}
                              </span>
                              {st.stage_name}
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              st.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                              st.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                              'bg-[var(--page-bg)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}>
                              {st.status?.replace('_', ' ') || 'pending'}
                            </span>
                          </div>

                          {/* Stage Output & Defect Indicators */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-[var(--text-muted)]">Output:</span>
                            <strong className="text-[var(--text-primary)] font-semibold">{stageQty} Pcs</strong>
                            {inRework > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                ⚠️ {inRework} in rework
                              </span>
                            )}
                            {bGradeQty > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-bold">
                                📦 {bGradeQty} B-grade
                              </span>
                            )}
                            {scrapQty > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[10px] font-bold">
                                🗑️ {scrapQty} scrap
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block mb-1">Assigned Worker(s)</span>
                            {st.workers && st.workers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {st.workers.map((w: any, wi: number) => (
                                  <span key={wi} className="bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-secondary)] px-2 py-0.5 rounded text-[11px] font-semibold">
                                    {w.name} ({w.worker_id || "Worker"})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--text-faint)] italic">No worker assigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)] italic bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">No production stages configured.</p>
                )}
              </div>

              {/* 4. GARMENT SPEC SHEET PARAMETERS (Step 6) */}
              {specSheet?.template && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-3">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
                    <Shirt className="h-4.5 w-4.5 text-[var(--primary)]" />
                    Design Spec Sheet ({specSheet.template.name})
                  </h3>

                  {specSheet.spec_values && Object.keys(specSheet.spec_values).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(specSheet.spec_values).map(([k, v]: [string, any], idx: number) => (
                        <div key={idx} className="bg-[var(--page-bg)] border border-[var(--border)] p-2.5 rounded-lg flex justify-between items-center text-xs">
                          <span className="font-bold text-[var(--text-muted)] uppercase text-[10px]">{k}</span>
                          <span className="font-semibold text-[var(--text-primary)]">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic bg-[var(--page-bg)] border border-[var(--border)] p-3 rounded-lg">No spec values recorded.</p>
                  )}
                </div>
              )}

              {/* 5. SPECIFICATIONS & REFERENCE PHOTOS (Step 3) */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] space-y-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="h-4.5 w-4.5 text-[var(--primary)]" />
                  Lot Specifications & Reference Photos
                </h3>
                
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">Design Reference Info</span>
                    <p className="font-medium text-[var(--text-secondary)] bg-[var(--page-bg)] border border-[var(--border)] p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                      {specifications?.design_reference_text || lot.specifications?.design_reference_text || "No design reference text provided."}
                    </p>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-1">Additional Details</span>
                    <p className="font-medium text-[var(--text-secondary)] bg-[var(--page-bg)] border border-[var(--border)] p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                      {specifications?.additional_details || lot.specifications?.additional_details || "No additional details specified."}
                    </p>
                  </div>

                  {/* Reference Photos Gallery */}
                  {(() => {
                    const photos = specifications?.design_reference_photos || lot.specifications?.design_reference_photos || [];
                    return (
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider mb-2">
                          Design Reference Photos ({photos.length})
                        </span>
                        {photos.length > 0 ? (
                          <div className="flex flex-wrap gap-3">
                            {photos.map((photoUrl: string, idx: number) => (
                              <a
                                key={idx}
                                href={photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--page-bg)] shadow-xs hover:border-[var(--primary)] hover:shadow-md transition-all"
                                title="Click to view full image"
                              >
                                <img
                                  src={photoUrl}
                                  alt={`Reference photo ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--text-muted)] italic bg-[var(--page-bg)] border border-[var(--border)] p-3 rounded-lg">No reference photos uploaded for this lot.</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Custom QA Checklist */}
                  {(() => {
                    const customQaList = specifications?.custom_qa || lot.specifications?.custom_qa || [];
                    return customQaList.length > 0 ? (
                      <div className="pt-3 border-t border-[var(--border)] space-y-2">
                        <span className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Custom QA Checklist</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {customQaList.map((qa: any, idx: number) => (
                            <div key={idx} className="bg-[var(--page-bg)] border border-[var(--border)] p-2.5 rounded-lg flex flex-col justify-between">
                              <span className="text-[11px] font-bold text-[var(--text-primary)]">{qa.question || "Checklist Item"}</span>
                              <span className="text-xs font-semibold text-[var(--primary)] mt-1">{qa.answer || "N/A"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <LotSummaryPanel title="Lot Summary" items={rightPanelItems} />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 4: DEFECTS & REWORK MANAGEMENT
          ======================================================== */}
      {activeTab === "defects" && (
        <div className="animate-fadeIn">
          <DefectManagement
            lotId={id}
            totalLotQty={totalQty}
            stages={stages || []}
            workers={workers || []}
            godowns={godowns || []}
            lotRolls={lotRolls || []}
            stageEntries={stageEntries || []}
            unitFabricCost={totalQty > 0 ? totalFabricCost / totalQty : 0}
            unitLaborCost={totalQty > 0 ? totalLaborCost / totalQty : 0}
            lot={lot}
            sizeQuantities={sizes}
          />
        </div>
      )}

      {/* MOVE TO STOCK DIALOG — extracted component */}
      <MoveToStockDialog
        open={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        lotId={id}
        designCode={lot?.design?.code}
        totalQty={totalQty}
        bGradeQty={lot?.b_grade_quantity || 0}
        scrappedQty={lot?.scrapped_quantity || 0}
        godowns={godowns}
        lotRolls={lotRolls}
        avgMetersPerPiece={lot?.specifications?.avg_meters_per_piece || lot?.design?.avg_meters}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["lot-detail", id] })}
      />

      <AddStageDialog
        open={addStageOpen}
        onClose={() => setAddStageOpen(false)}
        lotId={id}
        masterStages={masterStages}
        workers={workers}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["lot-detail", id] })}
      />

      {/* BOTTOM NOTE BANNER */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0" />
        <div className="text-sm text-[#1E40AF]">
          <span className="font-bold">Note:</span> Mark the lot as complete once all stages are finished and production quantities are verified. Completed lots will update finished stock counts.
        </div>
      </div>
      {/* ── MOBILE: STICKY BOTTOM ACTION BAR ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border)] p-3 flex items-center justify-around gap-2 shadow-lg">
        <Link href="/production/lots"
          className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
        ><ArrowLeft size={16} /></Link>

        <Link href={`/production/lots/${id}/edit`}
          className="h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        ><Pencil size={15} /><span>Edit Lot</span></Link>

        {lot.is_moved_to_stock ? (
          <span className="flex-1 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1">
            <CheckCircle2 size={15} /> Stock Moved
          </span>
        ) : (
          <button type="button" onClick={() => setMoveModalOpen(true)}
            className="flex-1 h-10 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          ><Boxes size={15} /><span>Move to Stock</span></button>
        )}
      </div>
    </div>
  );
}

