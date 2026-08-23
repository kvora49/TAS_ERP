"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  Sparkles,
  Scissors,
  Droplets,
  Package,
  Trash2,
  Coins,
  Warehouse,
  RotateCcw,
  Info,
  Layers,
  Search,
  Filter,
  Check,
  Flame,
  Shirt,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import ColourDot from "@/components/shared/ColourDot";
import { formatCurrency, cn } from "@/lib/utils";
import {
  LotDefect,
  useLotDefects,
  useCreateDefectMutation,
  useResolveDefectMutation,
} from "@/hooks/queries/useDefects";

interface Worker {
  id: string;
  name: string;
  worker_id?: string;
  code?: string;
}

interface Godown {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  stage_name: string;
  sequence_no: number;
  workers?: Worker[];
}

interface DefectManagementProps {
  lotId: string;
  totalLotQty: number;
  stages: Stage[];
  workers: Worker[];
  godowns: Godown[];
  lotRolls?: any[];
  stageEntries?: any[];
  unitFabricCost?: number;
  unitLaborCost?: number;
  lot?: any;
  sizeQuantities?: any[];
}

// Preset Category Chips for quick logging
const PRESET_CATEGORIES = [
  { id: "washing_issue", label: "Washing Issue", icon: Droplets, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  { id: "embroidery_issue", label: "Embroidery / Print", icon: Sparkles, color: "text-purple-500 bg-purple-500/10 border-purple-500/30" },
  { id: "silai_issue", label: "Silai / Stitching", icon: Scissors, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  { id: "pressing_issue", label: "Pressing / Shine Mark", icon: Flame, color: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
  { id: "cutting_fault", label: "Cutting Fault / Size Error", icon: Scissors, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30" },
  { id: "aatri", label: "Aatri (Small Holes)", icon: Package, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/30" },
  { id: "fully_damaged", label: "Full Damage / Ruined", icon: Trash2, color: "text-rose-500 bg-rose-500/10 border-rose-500/30" },
  { id: "packing_defect", label: "Packing / Tag Issue", icon: Shirt, color: "text-teal-500 bg-teal-500/10 border-teal-500/30" },
  { id: "fabric_defect", label: "Fabric Defect", icon: Layers, color: "text-slate-500 bg-slate-500/10 border-slate-500/30" },
  { id: "custom", label: "Custom Issue...", icon: HelpCircle, color: "text-primary bg-[var(--primary-light)] border-primary/30" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Inspection", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  in_rework: { label: "In Rework", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  sent_for_rework: { label: "Sent for Rework", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  reworked_fixed: { label: "Reworked & Fixed (Grade A)", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  rework_failed: { label: "Rework Failed", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  moved_to_b_grade: { label: "Moved to B-Grade Stock", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  written_off: { label: "Written Off (Scrapped)", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  resolved: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
};

export default function DefectManagement({
  lotId,
  totalLotQty,
  stages,
  workers,
  godowns,
  lotRolls = [],
  stageEntries = [],
  unitFabricCost = 0,
  unitLaborCost = 0,
  lot,
  sizeQuantities = [],
}: DefectManagementProps) {
  const { data, isLoading } = useLotDefects(lotId);
  const defects = data?.defects || [];

  const createDefectMutation = useCreateDefectMutation(lotId);
  const resolveDefectMutation = useResolveDefectMutation(lotId);

  // Modals state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<LotDefect | null>(null);

  // Available sizes extracted from lot size_quantities or size_set
  const availableSizes: string[] = useMemo(() => {
    if (sizeQuantities && sizeQuantities.length > 0) {
      const set = new Set<string>();
      sizeQuantities.forEach((sq: any) => {
        if (sq.size) set.add(sq.size);
      });
      if (set.size > 0) return Array.from(set);
    }
    if (lot?.size_set?.sizes && Array.isArray(lot.size_set.sizes)) {
      return lot.size_set.sizes;
    }
    if (lot?.design?.size_set?.sizes && Array.isArray(lot.design.size_set.sizes)) {
      return lot.design.size_set.sizes;
    }
    return ["28", "30", "32", "34", "36", "38", "40"];
  }, [sizeQuantities, lot]);

  // Available colours for this lot
  const availableColours = useMemo(() => {
    const map = new Map<string, { id: string; name: string; hex?: string }>();
    if (lot?.colour) {
      map.set(lot.colour.id || lot.colour_id, {
        id: lot.colour.id || lot.colour_id,
        name: lot.colour.colour_name || "Primary Colour",
        hex: lot.colour.colour_hex || lot.colour.hex_code,
      });
    }
    (sizeQuantities || []).forEach((sq: any) => {
      if (sq.colour && sq.colour_id) {
        map.set(sq.colour_id, {
          id: sq.colour_id,
          name: sq.colour.colour_name,
          hex: sq.colour.colour_hex || sq.colour.hex_code,
        });
      }
    });
    return Array.from(map.values());
  }, [lot, sizeQuantities]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Form states for Logging Defect
  // ─────────────────────────────────────────────────────────────────────────────
  const [selectedPreset, setSelectedPreset] = useState<string>("washing_issue");
  const [customCategoryText, setCustomCategoryText] = useState<string>("");
  const [defectDate, setDefectDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedColourId, setSelectedColourId] = useState<string>("");
  const [sizeMatrixQuantities, setSizeMatrixQuantities] = useState<Record<string, number>>({});
  const [detectedStageId, setDetectedStageId] = useState<string>("");
  const [responsibleWorkerId, setResponsibleWorkerId] = useState<string>("");
  const [responsibleStageId, setResponsibleStageId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [sentForRework, setSentForRework] = useState<boolean>(false);

  // Total defect pieces computed live from matrix
  const totalDefectMatrixQty = useMemo(() => {
    return Object.values(sizeMatrixQuantities).reduce((acc, val) => acc + (Math.max(0, Number(val)) || 0), 0);
  }, [sizeMatrixQuantities]);

  // Open Log Modal helper
  const handleOpenLogModal = (presetCategory?: string, presetStageId?: string) => {
    const initialPreset = presetCategory || "washing_issue";
    setSelectedPreset(initialPreset);
    setCustomCategoryText("");
    setDefectDate(new Date().toISOString().split("T")[0]);
    setSelectedColourId(availableColours.length > 0 ? availableColours[0].id : "");

    // Initialize size matrix with 0s
    const initMatrix: Record<string, number> = {};
    availableSizes.forEach((sz) => {
      initMatrix[sz] = 0;
    });
    setSizeMatrixQuantities(initMatrix);

    setDetectedStageId(presetStageId || (stages.length > 0 ? stages[stages.length - 1].id : ""));
    setResponsibleStageId(presetStageId || (stages.length > 0 ? stages[0].id : ""));
    setResponsibleWorkerId("");
    setDescription("");
    setSentForRework(false);
    setLogModalOpen(true);
  };

  // Submit Log Defect
  const handleSaveDefect = async () => {
    const finalCategory =
      selectedPreset === "custom"
        ? customCategoryText.trim()
        : PRESET_CATEGORIES.find((p) => p.id === selectedPreset)?.label || selectedPreset;

    if (!finalCategory) {
      toast.error("Please enter a defect category or description.");
      return;
    }

    if (totalDefectMatrixQty <= 0) {
      toast.error("Please enter defective quantities for at least one size.");
      return;
    }

    // Filter only positive size entries
    const nonZeroSizes: Record<string, number> = {};
    Object.entries(sizeMatrixQuantities).forEach(([sz, q]) => {
      const numQ = Number(q || 0);
      if (numQ > 0) nonZeroSizes[sz] = numQ;
    });

    await createDefectMutation.mutateAsync({
      lot_id: lotId,
      defect_date: defectDate,
      detected_at_stage_id: detectedStageId || undefined,
      defect_category: finalCategory,
      size_quantities: nonZeroSizes,
      colour_id: selectedColourId || undefined,
      description: description.trim() || undefined,
      responsible_worker_id: responsibleWorkerId || undefined,
      responsible_stage_id: responsibleStageId || undefined,
      sent_for_rework: sentForRework,
    });

    if (sentForRework) {
      toast.info(`${totalDefectMatrixQty} pieces marked as In Rework — deducted from lot quantity.`);
    }

    setLogModalOpen(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Form states for Resolving Defect
  // ─────────────────────────────────────────────────────────────────────────────
  const [resActionType, setResActionType] = useState<
    "reworked_to_lot" | "reworked_to_stock_grade_a" | "moved_to_b_grade" | "scrapped_waste" | "partial_rework_split"
  >("reworked_to_lot");

  const [resDate, setResDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Size-wise allocation state: { [size]: { recovered: number, b_grade: number, scrapped: number } }
  const [sizeAllocations, setSizeAllocations] = useState<
    Record<string, { recovered: number; b_grade: number; scrapped: number }>
  >({});

  const [reworkStageId, setReworkStageId] = useState<string>("");
  const [reworkCostMode, setReworkCostMode] = useState<"free" | "paid_normal" | "paid_custom">("free");
  const [customReworkCost, setCustomReworkCost] = useState<number>(0);
  const [reworkWorkerId, setReworkWorkerId] = useState<string>("");
  const [resResponsibleWorkerId, setResResponsibleWorkerId] = useState<string>("");

  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [clothCostRecovery, setClothCostRecovery] = useState<number>(0);
  const [targetGodownId, setTargetGodownId] = useState<string>("");
  const [sourceFinishedStockId, setSourceFinishedStockId] = useState<string>("");
  const [availableFinishedStockEntries, setAvailableFinishedStockEntries] = useState<any[]>([]);
  const [wasteReason, setWasteReason] = useState<string>("");
  const [resolutionRemarks, setResolutionRemarks] = useState<string>("");

  // Sum calculations for the resolve modal
  const resolveTotals = useMemo(() => {
    let recovered = 0;
    let b_grade = 0;
    let scrapped = 0;
    Object.values(sizeAllocations).forEach((alloc) => {
      recovered += Number(alloc.recovered || 0);
      b_grade += Number(alloc.b_grade || 0);
      scrapped += Number(alloc.scrapped || 0);
    });
    return {
      recovered,
      b_grade,
      scrapped,
      total: recovered + b_grade + scrapped,
    };
  }, [sizeAllocations]);

  // Rework / responsible stage rate lookup
  const stageJobWorkRate = useMemo(() => {
    const targetStageId = reworkStageId || selectedDefect?.responsible_stage_id;
    if (!targetStageId) return unitLaborCost || 15;
    const matched = stageEntries.find((se: any) => se.lot_stage_id === targetStageId);
    return Number(matched?.job_work_rate || unitLaborCost || 15);
  }, [reworkStageId, selectedDefect, stageEntries, unitLaborCost]);

  // Auto-calculated rework cost and penalty
  const computedReworkCost = useMemo(() => {
    if (reworkCostMode === "free") return 0;
    if (reworkCostMode === "paid_normal") {
      return resolveTotals.recovered * stageJobWorkRate;
    }
    return customReworkCost;
  }, [reworkCostMode, resolveTotals.recovered, stageJobWorkRate, customReworkCost]);

  // Auto-calculated worker deduction for free rework failures (B-grade + Scrapped)
  const autoFreePenalty = useMemo(() => {
    if (reworkCostMode === "free") {
      const failed = resolveTotals.b_grade + resolveTotals.scrapped;
      return failed * stageJobWorkRate;
    }
    return 0;
  }, [reworkCostMode, resolveTotals.b_grade, resolveTotals.scrapped, stageJobWorkRate]);

  // Material write-off value
  const estimatedMaterialLoss = useMemo(() => {
    return resolveTotals.scrapped * (unitFabricCost || 100);
  }, [resolveTotals.scrapped, unitFabricCost]);

  // Open Resolve Modal
  const handleOpenResolveModal = (defect: LotDefect) => {
    setSelectedDefect(defect);
    setResDate(new Date().toISOString().split("T")[0]);
    setResActionType("reworked_to_lot");
    setReworkCostMode("free");
    setCustomReworkCost(0);
    
    // Auto-detect default rework stage from defect's responsible stage or first stage
    const defaultReworkStage = defect.responsible_stage_id || (stages.length > 0 ? stages[0].id : "");
    setReworkStageId(defaultReworkStage);

    setReworkWorkerId(defect.responsible_worker_id || "");
    setResResponsibleWorkerId(defect.responsible_worker_id || "");
    setTargetGodownId(godowns.length > 0 ? godowns[0].id : "");
    setSourceFinishedStockId("");
    setWasteReason("");
    setResolutionRemarks("");
    setClothCostRecovery(0);

    // Initialize sizeAllocations from defect.size_quantities
    const defectSizes = (defect.size_quantities || {}) as Record<string, number>;
    const initAlloc: Record<string, { recovered: number; b_grade: number; scrapped: number }> = {};

    if (Object.keys(defectSizes).length > 0) {
      Object.entries(defectSizes).forEach(([sz, q]) => {
        const qty = Number(q || 0);
        // Default allocation: all recovered
        initAlloc[sz] = { recovered: qty, b_grade: 0, scrapped: 0 };
      });
    } else {
      // Fallback if defect had no size_quantities
      const sz = availableSizes[0] || "Default";
      initAlloc[sz] = { recovered: defect.quantity, b_grade: 0, scrapped: 0 };
    }

    setSizeAllocations(initAlloc);
    setDeductionAmount(0);
    setResolveModalOpen(true);
  };

  // Preset quick allocator for resolve actions
  const applyPresetActionToSizes = (action: typeof resActionType) => {
    setResActionType(action);
    const updated: Record<string, { recovered: number; b_grade: number; scrapped: number }> = {};
    const defectSizes = (selectedDefect?.size_quantities || {}) as Record<string, number>;

    Object.entries(defectSizes).forEach(([sz, q]) => {
      const qty = Number(q || 0);
      if (action === "reworked_to_lot" || action === "reworked_to_stock_grade_a") {
        updated[sz] = { recovered: qty, b_grade: 0, scrapped: 0 };
      } else if (action === "moved_to_b_grade") {
        updated[sz] = { recovered: 0, b_grade: qty, scrapped: 0 };
      } else if (action === "scrapped_waste") {
        updated[sz] = { recovered: 0, b_grade: 0, scrapped: qty };
      } else {
        // partial split default
        updated[sz] = { ...sizeAllocations[sz] };
      }
    });

    if (Object.keys(updated).length > 0) {
      setSizeAllocations(updated);
    }
  };

  // Submit Resolve Defect
  const handleSaveResolution = async () => {
    if (!selectedDefect) return;

    // Validate allocation sums
    if (resolveTotals.total !== selectedDefect.quantity) {
      toast.error(
        `Total allocated pieces (${resolveTotals.total}) must equal defect quantity (${selectedDefect.quantity}).`
      );
      return;
    }

    // Validate per-size totals
    const defectSizes = (selectedDefect.size_quantities || {}) as Record<string, number>;
    for (const [sz, expectedQty] of Object.entries(defectSizes)) {
      const exp = Number(expectedQty || 0);
      const alloc = sizeAllocations[sz] || { recovered: 0, b_grade: 0, scrapped: 0 };
      const totalSz = Number(alloc.recovered || 0) + Number(alloc.b_grade || 0) + Number(alloc.scrapped || 0);
      if (totalSz !== exp) {
        toast.error(`Size ${sz}: allocated ${totalSz} pieces, but defect has ${exp} pieces.`);
        return;
      }
    }

    if (
      (resolveTotals.b_grade > 0 ||
        (resActionType === "reworked_to_stock_grade_a" && resolveTotals.recovered > 0)) &&
      !targetGodownId
    ) {
      toast.error("Please select a target godown for stock storage.");
      return;
    }

    const recoveredMap: Record<string, number> = {};
    const bGradeMap: Record<string, number> = {};
    const scrappedMap: Record<string, number> = {};

    Object.entries(sizeAllocations).forEach(([sz, alloc]) => {
      if (Number(alloc.recovered || 0) > 0) recoveredMap[sz] = Number(alloc.recovered);
      if (Number(alloc.b_grade || 0) > 0) bGradeMap[sz] = Number(alloc.b_grade);
      if (Number(alloc.scrapped || 0) > 0) scrappedMap[sz] = Number(alloc.scrapped);
    });

    const payload: any = {
      resolution_type: resActionType,
      resolution_date: resDate,
      recovered_size_quantities: recoveredMap,
      b_grade_size_quantities: bGradeMap,
      scrapped_size_quantities: scrappedMap,
      rework_cost_mode: reworkCostMode,
      rework_cost: computedReworkCost,
      rework_stage_id: reworkStageId || undefined,
      rework_worker_id: reworkWorkerId || undefined,
      responsible_worker_id: resResponsibleWorkerId || undefined,
      deduction_amount: reworkCostMode === "free" ? autoFreePenalty + deductionAmount : deductionAmount,
      cloth_cost_recovery: clothCostRecovery,
      target_godown_id: targetGodownId || undefined,
      source_finished_stock_id: sourceFinishedStockId || undefined,
      waste_reason: wasteReason.trim() || undefined,
      remarks: resolutionRemarks.trim() || undefined,
    };

    await resolveDefectMutation.mutateAsync({
      defectId: selectedDefect.id,
      payload,
    });

    setResolveModalOpen(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Aggregated Summary Cards
  // ─────────────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalLogged = 0;
    let totalRecovered = 0;
    let totalBGrade = 0;
    let totalScrapped = 0;
    let totalWriteOffVal = 0;
    let totalDeductions = 0;
    let inReworkQty = 0;

    defects.forEach((d) => {
      totalLogged += Number(d.quantity || 0);
      if (d.status === "in_rework") {
        inReworkQty += Number(d.quantity || 0);
      }
      (d.resolutions || []).forEach((r) => {
        totalRecovered += Number(r.qty_recovered || 0);
        totalBGrade += Number(r.qty_b_grade || 0);
        totalScrapped += Number(r.qty_scrapped || 0);
        totalWriteOffVal += Number(r.material_write_off_value || 0);
        totalDeductions += Number(r.deduction_amount || 0) + Number(r.cloth_cost_recovery || 0);
      });
    });

    const pendingQty = Math.max(0, totalLogged - (totalRecovered + totalBGrade + totalScrapped));

    return {
      totalLogged,
      pendingQty,
      inReworkQty,
      totalRecovered,
      totalBGrade,
      totalScrapped,
      totalWriteOffVal,
      totalDeductions,
    };
  }, [defects]);

  const isCompletedLot = lot?.status === "completed";

  return (
    <div className="space-y-6">
      {/* ── TOP STATS BAR ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-[var(--text-muted)]">Total Defective</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalLogged}</span>
            <span className="text-xs text-[var(--text-faint)]">pcs</span>
          </div>
          <div className="mt-2 text-xs font-semibold text-amber-500">
            {stats.pendingQty} pending inspection
          </div>
        </div>

      {/* In Rework stat card — appears prominently if pieces are currently in rework */}
        {stats.inReworkQty > 0 && (
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 shadow-[var(--shadow-sm)] col-span-2 md:col-span-1 animate-pulse-slow">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Currently In Rework
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.inReworkQty}</span>
              <span className="text-xs text-blue-600/70">pcs</span>
            </div>
            <span className="mt-2 text-xs text-blue-600/80 block">Deducted from lot — pending return</span>
          </div>
        )}

        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Fixed & Grade A</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.totalRecovered}</span>
            <span className="text-xs text-emerald-600/70">pcs</span>
          </div>
          <span className="mt-2 text-xs text-emerald-600/80 block">Re-entered Grade A stock</span>
        </div>

        <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">B-Grade / Aatri</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.totalBGrade}</span>
            <span className="text-xs text-orange-600/70">pcs</span>
          </div>
          <span className="mt-2 text-xs text-orange-600/80 block">In B-Grade Register</span>
        </div>

        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Scrapped / Waste</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700 dark:text-rose-300">{stats.totalScrapped}</span>
            <span className="text-xs text-rose-600/70">pcs</span>
          </div>
          <span className="mt-2 text-xs text-rose-600/80 block">
            {formatCurrency(stats.totalWriteOffVal)} write-off
          </span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] col-span-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">Worker Deductions Applied</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {formatCurrency(stats.totalDeductions)}
            </span>
          </div>
          <span className="mt-2 text-xs text-[var(--text-faint)] block">
            Auto-debited from worker job-work ledgers
          </span>
        </div>
      </div>

      {/* ── HEADER ACTION & QUICK PRESETS ─────────────────────────────────── */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Defect & Quality Audit Control
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Log size-wise defects at any stage (cutting, embroidery, silai, washing, pressing, packing).
              Resolve by rewashing, moving to B-grade, or scrapping with worker accountability.
            </p>
          </div>

          <button
            onClick={() => handleOpenLogModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Log Defect
          </button>
        </div>

        {/* Quick presets bar */}
        <div className="pt-3 border-t border-[var(--border-light)]">
          <span className="text-xs font-semibold text-[var(--text-muted)] block mb-2">
            Quick Log by Defect Type:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_CATEGORIES.slice(0, 7).map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleOpenLogModal(preset.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:scale-105",
                    preset.color
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── DEFECTS LIST TABLE ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            Defect Records ({defects.length})
          </h4>
        </div>

        {defects.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3 opacity-80" />
            <h5 className="text-sm font-semibold text-[var(--text-primary)]">No Defects Logged</h5>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
              All pieces in this lot are currently healthy. Click &ldquo;Log Defect&rdquo; above if any washing, stitching, or finishing defects are identified.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-light)] overflow-x-auto">
            {defects.map((defect) => {
              const isResolved =
                defect.status === "resolved" ||
                defect.status === "reworked_fixed" ||
                defect.status === "moved_to_b_grade" ||
                defect.status === "written_off";

              const statusMeta = STATUS_LABELS[defect.status] || {
                label: defect.status,
                color: "bg-gray-500/10 text-gray-600",
              };

              const sizes = defect.size_quantities || {};

              return (
                <div key={defect.id} className="p-4 hover:bg-[var(--table-row-hover)] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Defect Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--text-primary)] bg-[var(--page-bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                          {defect.defect_number}
                        </span>

                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          {defect.defect_category}
                        </span>

                        {defect.source === "post_stock" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            Post-Stock Defect
                          </span>
                        )}

                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            statusMeta.color
                          )}
                        >
                          {statusMeta.label}
                        </span>

                        {defect.colour && (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--page-bg)] border border-[var(--border)] text-xs text-[var(--text-body)]">
                            <ColourDot colourHex={defect.colour.hex_code || defect.colour.colour_hex} size="sm" />
                            <span>{defect.colour.colour_name}</span>
                          </div>
                        )}

                        <span className="text-xs text-[var(--text-faint)]">
                          {defect.defect_date}
                        </span>
                      </div>

                      {/* Size Matrix Breakdown Badge */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-xs font-medium text-[var(--text-muted)]">Sizes:</span>
                        {Object.entries(sizes).map(([sz, q]) => (
                          <span
                            key={sz}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--page-bg)] border border-[var(--border)] text-xs font-mono font-medium text-[var(--text-primary)]"
                          >
                            <span className="text-[var(--text-muted)]">{sz}:</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">{q}</span>
                          </span>
                        ))}
                        <span className="text-xs font-bold text-[var(--text-primary)] ml-1">
                          (Total: {defect.quantity} pcs)
                        </span>
                      </div>

                      {/* Workers and Stage info */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                        {defect.responsible_worker && (
                          <span>
                            Responsible Worker:{" "}
                            <strong className="text-[var(--text-secondary)]">
                              {defect.responsible_worker.name}
                            </strong>
                          </span>
                        )}
                        {defect.detected_at_stage && (
                          <span>
                            Detected at:{" "}
                            <strong className="text-[var(--text-secondary)]">
                              {defect.detected_at_stage.stage_name}
                            </strong>
                          </span>
                        )}
                        {defect.description && (
                          <p className="text-xs text-[var(--text-body)] italic w-full">
                            &ldquo;{defect.description}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Resolution details if resolved */}
                      {defect.resolutions && defect.resolutions.length > 0 && (
                        <div className="mt-3 p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--border-light)] space-y-2">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Resolution Breakdown
                          </span>
                          {defect.resolutions.map((res, idx) => (
                            <div key={idx} className="space-y-1 text-xs text-[var(--text-body)]">
                              <div className="flex flex-wrap items-center gap-3">
                                {res.qty_recovered > 0 && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ✓ {res.qty_recovered} Recovered (Grade A)
                                  </span>
                                )}
                                {res.qty_b_grade > 0 && (
                                  <span className="text-orange-600 dark:text-orange-400 font-semibold">
                                    ⚠ {res.qty_b_grade} B-Grade Stock
                                  </span>
                                )}
                                {res.qty_scrapped > 0 && (
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                    ✕ {res.qty_scrapped} Scrapped (Loss: {formatCurrency(res.material_write_off_value || 0)})
                                  </span>
                                )}
                                {res.target_godown && (
                                  <span className="text-[var(--text-muted)]">
                                    Stored in: <strong>{res.target_godown.name}</strong>
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                                {res.deduction_amount > 0 && (
                                  <span>Worker Penalty: <strong>{formatCurrency(res.deduction_amount)}</strong></span>
                                )}
                                {res.rework_cost > 0 && (
                                  <span>Rework Cost: <strong>{formatCurrency(res.rework_cost)}</strong></span>
                                )}
                                {res.waste_reason && (
                                  <span>Waste Reason: <em>{res.waste_reason}</em></span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end lg:self-center">
                      {!isResolved ? (
                        <button
                          onClick={() => handleOpenResolveModal(defect)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Resolve / Allocate
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <Check className="h-4 w-4" /> Fully Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 1: LOG DEFECT (WITH SIZE MATRIX & PRESETS)
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={logModalOpen}
        onOpenChange={setLogModalOpen}
        title="Log Production Defect"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Post-stock warning if lot completed */}
          {isCompletedLot && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Post-Stock Defect Warning:</strong>
                This production lot has already been moved to finished stock. Logging a defect here will mark it as a &ldquo;post-stock defect&rdquo;. During resolution, defective pieces will be deducted from your existing finished stock.
              </div>
            </div>
          )}

          {/* 1. Category Preset Selector */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-2">
              Defect Category / Issue Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESET_CATEGORIES.map((preset) => {
                const isSel = selectedPreset === preset.id;
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    className={cn(
                      "p-2.5 rounded-lg border text-left flex items-center gap-2 text-xs font-medium transition-all",
                      isSel
                        ? "border-primary bg-[var(--primary-light)] text-[var(--text-primary)] shadow-sm ring-1 ring-primary"
                        : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isSel ? "text-primary" : "text-[var(--text-faint)]")} />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedPreset === "custom" && (
              <input
                type="text"
                value={customCategoryText}
                onChange={(e) => setCustomCategoryText(e.target.value)}
                placeholder="Describe custom defect issue (e.g. Broken zipper, Needle cut, Oil stain)..."
                className="mt-2.5 w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                autoFocus
              />
            )}
          </div>

          {/* 2. Colour & Date Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableColours.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                  Affected Colour Variant
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableColours.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColourId(c.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                        selectedColourId === c.id
                          ? "border-primary bg-[var(--primary-light)] text-[var(--text-primary)] ring-1 ring-primary"
                          : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-body)]"
                      )}
                    >
                      <ColourDot colourHex={c.hex} size="sm" />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Defect Date
              </label>
              <input
                type="date"
                value={defectDate}
                onChange={(e) => setDefectDate(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          {/* 3. SIZE MATRIX DEFECT QUANTITY INPUT */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Size-Wise Defective Quantities <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Total Defective: {totalDefectMatrixQty} pcs
              </span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--page-bg)]">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {availableSizes.map((sz) => {
                  const val = sizeMatrixQuantities[sz] || 0;
                  return (
                    <div key={sz} className="text-center">
                      <span className="text-xs font-mono font-bold text-[var(--text-primary)] block mb-1">
                        Size {sz}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={val === 0 ? "" : val}
                        placeholder="0"
                        onChange={(e) => {
                          const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setSizeMatrixQuantities((prev) => ({
                            ...prev,
                            [sz]: n,
                          }));
                        }}
                        className="w-full text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg h-9 text-sm font-semibold transition-colors"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Responsible Worker & Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Responsible Worker <span className="text-[10px] text-[var(--text-faint)] font-normal">(Who caused the issue — e.g. Washer / Stitcher)</span>
              </label>
              <select
                value={responsibleWorkerId}
                onChange={(e) => setResponsibleWorkerId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                <option value="">-- Optional: Select Responsible Worker --</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.code ? `(${w.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Stage Where Defect Was Caught <span className="text-[10px] text-[var(--text-faint)] font-normal">(QC / Pressing / Checking)</span>
              </label>
              <select
                value={detectedStageId}
                onChange={(e) => setDetectedStageId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                <option value="">-- Select Detection Stage --</option>
                {stages.map((stg) => (
                  <option key={stg.id} value={stg.id}>
                    Stage {stg.sequence_no}: {stg.stage_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Description */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
              Specific Defect Notes / Observation
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Washing tone too light on back pockets, thread breakage on waist band..."
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg p-3 text-sm transition-colors"
            />
          </div>

          {/* 5b. Send for Rework toggle (only for in-production lots) */}
          {!isCompletedLot && (
            <div
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer",
                sentForRework
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-[var(--border)] bg-[var(--page-bg)]"
              )}
              onClick={() => setSentForRework(!sentForRework)}
            >
              <div
                className={cn(
                  "mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                  sentForRework
                    ? "border-blue-500 bg-blue-500"
                    : "border-[var(--input-border)] bg-[var(--input-bg)]"
                )}
              >
                {sentForRework && <Check className="h-3 w-3 text-white" />}
              </div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-blue-500" />
                  Send for Rework Immediately
                </span>
                <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                  These {totalDefectMatrixQty > 0 ? `${totalDefectMatrixQty} ` : ""}pieces will be deducted from the lot count now.
                  They will be restored when the rework is resolved and pieces return to the lot.
                </span>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setLogModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition"
            >
              Cancel
            </button>
            <AsyncButton
              onClick={handleSaveDefect}
              variant="primary"
              disabled={totalDefectMatrixQty <= 0}
            >
              Save Defect ({totalDefectMatrixQty} pcs)
            </AsyncButton>
          </div>
        </div>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 2: RESOLVE / ALLOCATE DEFECT (SIZE-WISE BREAKDOWN)
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal
        open={resolveModalOpen}
        onOpenChange={setResolveModalOpen}
        title="Resolve & Allocate Defective Pieces"
        maxWidth="max-w-3xl"
      >
        {selectedDefect && (
          <div className="space-y-5">
            {/* Defect Summary Header */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {selectedDefect.defect_number}
                </span>{" "}
                — <strong className="text-amber-600 dark:text-amber-400">{selectedDefect.defect_category}</strong>
              </div>
              <div className="flex items-center gap-3 text-[var(--text-muted)]">
                <span>Defect Qty: <strong className="text-[var(--text-primary)] font-bold">{selectedDefect.quantity} pcs</strong></span>
                <span>Stage Rate: <strong>{formatCurrency(stageJobWorkRate)}/pc</strong></span>
              </div>
            </div>

            {/* Quick Action Mode Selector */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-2">
                Primary Resolution Action
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyPresetActionToSizes("reworked_to_lot")}
                  className={cn(
                    "p-2.5 rounded-lg border text-left text-xs font-medium transition-all",
                    resActionType === "reworked_to_lot"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-emerald-600">Rework → Merge to Lot</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">Restores pieces to active lot</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetActionToSizes("reworked_to_stock_grade_a")}
                  className={cn(
                    "p-2.5 rounded-lg border text-left text-xs font-medium transition-all",
                    resActionType === "reworked_to_stock_grade_a"
                      ? "border-primary bg-[var(--primary-light)] text-primary ring-1 ring-primary"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-primary">Rework → Grade A Stock</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">Pushes directly to godown</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetActionToSizes("moved_to_b_grade")}
                  className={cn(
                    "p-2.5 rounded-lg border text-left text-xs font-medium transition-all",
                    resActionType === "moved_to_b_grade"
                      ? "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-orange-600">Move to B-Grade Stock</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">Stores in B-Grade register</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetActionToSizes("scrapped_waste")}
                  className={cn(
                    "p-2.5 rounded-lg border text-left text-xs font-medium transition-all",
                    resActionType === "scrapped_waste"
                      ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-rose-600">Scrap / Write Off</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">Fabric & labor written off</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetActionToSizes("partial_rework_split")}
                  className={cn(
                    "p-2.5 rounded-lg border text-left text-xs font-medium transition-all col-span-2 sm:col-span-2",
                    resActionType === "partial_rework_split"
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-indigo-600">Mixed Split (Some Fixed, Some B-Grade, Some Scrap)</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">Custom size-by-size breakdown below</span>
                </button>
              </div>
            </div>

            {/* SIZE-WISE ALLOCATION TABLE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Size-Wise Allocation Matrix
                </label>
                <div className="text-xs font-bold space-x-2">
                  <span className="text-emerald-600">Recovered: {resolveTotals.recovered}</span>
                  <span className="text-orange-600">B-Grade: {resolveTotals.b_grade}</span>
                  <span className="text-rose-600">Scrapped: {resolveTotals.scrapped}</span>
                  <span
                    className={cn(
                      "font-mono px-2 py-0.5 rounded",
                      resolveTotals.total === selectedDefect.quantity
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    )}
                  >
                    Allocated: {resolveTotals.total} / {selectedDefect.quantity} pcs
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold">
                    <tr>
                      <th className="p-3">Size</th>
                      <th className="p-3 text-center">Defect Qty</th>
                      <th className="p-3 text-center text-emerald-600">Recovered (Grade A)</th>
                      <th className="p-3 text-center text-orange-600">B-Grade (Aatri)</th>
                      <th className="p-3 text-center text-rose-600">Scrapped (Waste)</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {Object.entries(selectedDefect.size_quantities || {}).map(([sz, q]) => {
                      const defectSizeQty = Number(q || 0);
                      const alloc = sizeAllocations[sz] || { recovered: 0, b_grade: 0, scrapped: 0 };
                      const sumSz = Number(alloc.recovered || 0) + Number(alloc.b_grade || 0) + Number(alloc.scrapped || 0);
                      const isBalanced = sumSz === defectSizeQty;

                      return (
                        <tr key={sz} className="hover:bg-[var(--table-row-hover)]">
                          <td className="p-3 font-mono font-bold text-[var(--text-primary)]">
                            Size {sz}
                          </td>
                          <td className="p-3 text-center font-bold text-[var(--text-secondary)]">
                            {defectSizeQty}
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max={defectSizeQty}
                              value={alloc.recovered === 0 ? "" : alloc.recovered}
                              placeholder="0"
                              onChange={(e) => {
                                const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setSizeAllocations((prev) => ({
                                  ...prev,
                                  [sz]: { ...prev[sz], recovered: n },
                                }));
                              }}
                              className="w-20 text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-emerald-600 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg h-8 text-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max={defectSizeQty}
                              value={alloc.b_grade === 0 ? "" : alloc.b_grade}
                              placeholder="0"
                              onChange={(e) => {
                                const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setSizeAllocations((prev) => ({
                                  ...prev,
                                  [sz]: { ...prev[sz], b_grade: n },
                                }));
                              }}
                              className="w-20 text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-orange-600 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg h-8 text-xs"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max={defectSizeQty}
                              value={alloc.scrapped === 0 ? "" : alloc.scrapped}
                              placeholder="0"
                              onChange={(e) => {
                                const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setSizeAllocations((prev) => ({
                                  ...prev,
                                  [sz]: { ...prev[sz], scrapped: n },
                                }));
                              }}
                              className="w-20 text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-rose-600 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-lg h-8 text-xs"
                            />
                          </td>
                          <td className="p-3 text-right font-mono">
                            {isBalanced ? (
                              <span className="text-emerald-600 font-semibold">✓ Balanced</span>
                            ) : (
                              <span className="text-rose-500 font-semibold">
                                {defectSizeQty - sumSz > 0 ? `-${defectSizeQty - sumSz} left` : `+${sumSz - defectSizeQty} over`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Target Godown Selection (if storing stock) */}
            {(resolveTotals.b_grade > 0 ||
              (resActionType === "reworked_to_stock_grade_a" && resolveTotals.recovered > 0)) && (
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                  Target Godown for Storing Stock <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetGodownId}
                  onChange={(e) => setTargetGodownId(e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                >
                  <option value="">-- Select Godown --</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Rework Cost & Worker Accounting Mode */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] space-y-4">
              {/* Rework Stage & Worker Selection */}
              {(resolveTotals.recovered > 0 ||
                resActionType === "reworked_to_lot" ||
                resActionType === "reworked_to_stock_grade_a" ||
                resActionType === "partial_rework_split") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-[var(--border-light)]">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                      Rework Production Stage <span className="text-[10px] text-[var(--text-faint)] font-normal">(Where pieces are sent to fix)</span> <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={reworkStageId}
                      onChange={(e) => setReworkStageId(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-sm transition-colors"
                    >
                      <option value="">-- Select Rework Stage --</option>
                      {stages.map((stg) => (
                        <option key={stg.id} value={stg.id}>
                          Stage {stg.sequence_no}: {stg.stage_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                      Worker Performing Rework
                    </label>
                    <select
                      value={reworkWorkerId}
                      onChange={(e) => setReworkWorkerId(e.target.value)}
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-sm transition-colors"
                    >
                      <option value="">-- Optional: Select Worker --</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.code ? `(${w.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-primary)] block">
                  Rework Cost & Worker Accounting:
                </label>
                <span className="text-xs text-[var(--text-muted)]">
                  Stage Rate: <strong>{formatCurrency(stageJobWorkRate)}/pc</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setReworkCostMode("free")}
                  className={cn(
                    "p-3 rounded-lg border text-left text-xs transition-all",
                    reworkCostMode === "free"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-emerald-600">Free Rework (Worker Fault)</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Worker redoes for free; auto-deducts penalty for failed pieces ({resolveTotals.b_grade + resolveTotals.scrapped} pcs × {formatCurrency(stageJobWorkRate)} = {formatCurrency(autoFreePenalty)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReworkCostMode("paid_normal")}
                  className={cn(
                    "p-3 rounded-lg border text-left text-xs transition-all",
                    reworkCostMode === "paid_normal"
                      ? "border-primary bg-[var(--primary-light)] text-primary ring-1 ring-primary"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-primary">Paid Standard Rate</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Pay standard stage rate ({formatCurrency(stageJobWorkRate)} × {resolveTotals.recovered} pcs = {formatCurrency(resolveTotals.recovered * stageJobWorkRate)})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setReworkCostMode("paid_custom")}
                  className={cn(
                    "p-3 rounded-lg border text-left text-xs transition-all",
                    reworkCostMode === "paid_custom"
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)]"
                  )}
                >
                  <strong className="block text-indigo-600">Custom Rate</strong>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Enter explicit rework labor charge
                  </span>
                </button>
              </div>

              {reworkCostMode === "paid_custom" && (
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                    Custom Rework Labor Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={customReworkCost === 0 ? "" : customReworkCost}
                    placeholder="0"
                    onChange={(e) => setCustomReworkCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-sm"
                  />
                </div>
              )}

              {/* Penalty / Cloth Damage Recovery */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-light)]">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                    Worker Job-Work Penalty (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={reworkCostMode === "free" ? autoFreePenalty + deductionAmount : deductionAmount}
                    onChange={(e) => setDeductionAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                    Cloth Damage Recovery (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={clothCostRecovery === 0 ? "" : clothCostRecovery}
                    placeholder="0"
                    onChange={(e) => setClothCostRecovery(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Waste Reason (if scrapping any) */}
            {resolveTotals.scrapped > 0 && (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                    Waste & Scrap Reason <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs font-bold text-rose-600">
                    Estimated Loss: {formatCurrency(estimatedMaterialLoss)}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  placeholder="Explain why these pieces could not be salvaged or repaired (e.g. Unrecoverable burn mark from press, giant tear from cutter)..."
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-lg p-3 text-sm"
                />
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">
                Resolution Remarks / Audit Notes
              </label>
              <textarea
                rows={2}
                value={resolutionRemarks}
                onChange={(e) => setResolutionRemarks(e.target.value)}
                placeholder="Audit notes for management..."
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg p-3 text-sm"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setResolveModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition"
              >
                Cancel
              </button>
              <AsyncButton
                onClick={handleSaveResolution}
                variant="primary"
                disabled={resolveTotals.total !== selectedDefect.quantity}
              >
                Confirm Resolution ({resolveTotals.total} pcs)
              </AsyncButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
