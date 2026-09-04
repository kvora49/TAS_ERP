"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NumericInput } from "@/components/ui/numeric-input";
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
import { useFileUpload } from "@/hooks/useFileUpload";

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
  wage_rate?: number;
  wage_type?: string;
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
  const [selectedColourId, setSelectedColourId] = useState("");

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
  
  // Photo attachments state and hook
  const [attachments, setAttachments] = useState<string[]>([]);
  const { upload, uploading } = useFileUpload("stage-entries");

  // Dynamic Custom Fields State: { "Shrinkage %": "3%", "QC Verified": true }
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const [submitting, setSubmitting] = useState(false);

  // Section 5: Accessory Assignment (Optional)
  const [accessoriesExpanded, setAccessoriesExpanded] = useState(false);
  const [accessoryIssuances, setAccessoryIssuances] = useState<Record<string, number>>({}); // lot_accessory_id -> issued_qty

  // Inline Wastage Size Breakdown State (Approach 2)
  const [wastageColourId, setWastageColourId] = useState<string>("");
  const [wastageSizeAllocations, setWastageSizeAllocations] = useState<Record<string, Record<string, number>>>({});


  // Fetch Master Stages to obtain custom_fields definitions
  const { data: masterStagesData } = useQuery({
    queryKey: ["master-stages-definitions"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-stages");
      if (!res.ok) return { stages: [] };
      return res.json();
    },
  });

  const masterStages = masterStagesData?.stages || [];

  // 1. Fetch In-Progress Production Lots
  const { data: lotsData } = useQuery({
    queryKey: ["lots-in-progress"],
    queryFn: async () => {
      const res = await fetch("/api/production/lots?status=in_progress&limit=100");
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

  // 3. Fetch Selected Lot Details (stages, sizes, prev entries, stage workers)
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

  const lots: Lot[] = lotsData?.data || lotsData?.lots || [];
  const workers = workersData?.workers || [];
  const activeLot = lotDetailData?.lot || null;
  const lotStages: LotStage[] = lotDetailData?.stages || [];
  const lotSizeQuantities = lotDetailData?.sizes || [];
  const stageEntries = lotDetailData?.stageEntries || [];
  const stageWorkers = lotDetailData?.stageWorkers || [];
  const lotAccessoryPool: any[] = lotDetailData?.lotAccessories || [];
  const defects: any[] = lotDetailData?.defects || [];

  // Build available colours list for this lot
  const colourMap = new Map();
  if (activeLot?.colour && activeLot.colour.colour_name) {
    const key = activeLot.colour.id || activeLot.colour.colour_name;
    colourMap.set(key, activeLot.colour);
  }
  if (Array.isArray(activeLot?.colours)) {
    activeLot.colours.forEach((c: any) => {
      if (c && c.colour_name) {
        const key = c.id || c.colour_name;
        colourMap.set(key, c);
      }
    });
  }
  if (Array.isArray(lotSizeQuantities)) {
    lotSizeQuantities.forEach((sq: any) => {
      if (sq && sq.colour && sq.colour.colour_name) {
        const key = sq.colour.id || sq.colour.colour_name;
        colourMap.set(key, sq.colour);
      }
    });
  }
  const availableColours = Array.from(colourMap.values());

  // Extract available sizes from lotSizeQuantities or lot definition
  const availableSizes: string[] = useMemo(() => {
    if (lotSizeQuantities && lotSizeQuantities.length > 0) {
      const set = new Set<string>();
      lotSizeQuantities.forEach((sq: any) => {
        if (sq.size) set.add(sq.size);
      });
      if (set.size > 0) return Array.from(set);
    }
    if (Array.isArray(activeLot?.size_set?.sizes) && activeLot.size_set.sizes.length > 0) {
      return activeLot.size_set.sizes;
    }
    if (Array.isArray(activeLot?.design?.size_set?.sizes) && activeLot.design.size_set.sizes.length > 0) {
      return activeLot.design.size_set.sizes;
    }
    return ["28", "30", "32", "34", "36"];
  }, [lotSizeQuantities, activeLot]);

  // Sequential stage order and readiness analysis
  const sortedStages = useMemo(() => {
    return [...lotStages].sort((a, b) => (a.sequence_no || 0) - (b.sequence_no || 0));
  }, [lotStages]);

  const stagesWithReadiness = useMemo(() => {
    return sortedStages.map((s, idx) => {
      const isFirst = s.sequence_no === 1 || idx === 0;
      const prevStage = !isFirst ? sortedStages[idx - 1] : null;
      let prevOut = 0;
      if (prevStage) {
        prevOut = stageEntries
          .filter((e: any) => e.lot_stage_id === prevStage.id)
          .reduce((sum: number, e: any) => sum + Number(e.qty_out || 0), 0);
      }

      // Check current stage processed
      const currentStageProcessed = stageEntries
        .filter((e: any) => e.lot_stage_id === s.id)
        .reduce((sum: number, e: any) => sum + Number(e.qty_out || 0) + Number(e.wastage_qty || 0), 0);

      const targetLotQty = Number(activeLot?.total_quantity || 0);
      const isCompleted = s.status === "completed" || (targetLotQty > 0 && currentStageProcessed >= targetLotQty);
      const isLocked = !isFirst && prevOut === 0;
      const isReady = !isCompleted && !isLocked;

      return {
        ...s,
        isFirst,
        prevOut,
        currentStageProcessed,
        isCompleted,
        isLocked,
        isReady,
      };
    });
  }, [sortedStages, stageEntries, activeLot]);

  // Selected lot stage info
  const selectedLotStage = lotStages.find((s) => s.id === stageId);

  // Find corresponding stage definition to read custom_fields directly from lot stage relation or fallback
  const matchedMasterStage = masterStages.find(
    (ms: any) =>
      ms.id === selectedLotStage?.stage_id ||
      ms.name?.trim().toLowerCase() === selectedLotStage?.stage_name?.trim().toLowerCase()
  );

  const stageCustomFields: { name: string; type: "text" | "number" | "boolean" | "date"; required: boolean }[] =
    (selectedLotStage as any)?.stage?.custom_fields ||
    (selectedLotStage as any)?.custom_fields ||
    matchedMasterStage?.custom_fields ||
    [];

  // Reset/Initialize custom field values whenever selected stage changes
  useEffect(() => {
    if (stageCustomFields.length > 0) {
      const initialValues: Record<string, any> = {};
      stageCustomFields.forEach((field) => {
        initialValues[field.name] = field.type === "boolean" ? false : "";
      });
      setCustomFieldValues(initialValues);
    } else {
      setCustomFieldValues({});
    }
  }, [stageId, selectedLotStage?.id, matchedMasterStage?.id]);

  // ── Available Qty Calculation (accounting for prev output, existing stage entries, and defects/reworks/diverted pieces) ──
  const stageAvailability = useMemo(() => {
    if (!selectedLotStage || !activeLot) {
      return {
        availableQty: 0,
        activeReworkCount: 0,
        divertedCount: 0,
        bGradeDiverted: 0,
        scrappedDiverted: 0,
        stockGradeADiverted: 0,
        currentStageProcessed: 0,
        prevQtyOut: 0,
      };
    }

    const isFirstStage = selectedLotStage.sequence_no === 1;
    const prevStage = lotStages.find(
      (s) => s.sequence_no === selectedLotStage.sequence_no - 1
    );

    // 1. Base input from previous stage (or lot total for stage 1)
    let prevQtyOut = 0;
    if (isFirstStage) {
      if (selectedColourId) {
        prevQtyOut = lotSizeQuantities
          .filter((sq: any) => sq.colour_id === selectedColourId)
          .reduce((sum: number, sq: any) => sum + Number(sq.quantity || 0), 0);
      } else {
        prevQtyOut = Number(activeLot.total_quantity || 0);
      }
    } else if (prevStage) {
      const prevEntries = stageEntries.filter((e: any) => e.lot_stage_id === prevStage.id);
      const matchingPrevEntries = selectedColourId
        ? prevEntries.filter((e: any) => {
            const cid = e.colour_id || e.custom_field_values?.colour_id;
            return !cid || cid === selectedColourId;
          })
        : prevEntries;
      prevQtyOut = matchingPrevEntries.reduce((sum: number, e: any) => sum + Number(e.qty_out || 0), 0);
    }

    // 2. Entries already processed in CURRENT stage
    const currentEntries = stageEntries.filter((e: any) => e.lot_stage_id === selectedLotStage.id);
    const matchingCurrentEntries = selectedColourId
      ? currentEntries.filter((e: any) => {
          const cid = e.colour_id || e.custom_field_values?.colour_id;
          return !cid || cid === selectedColourId;
        })
      : currentEntries;
    const currentStageProcessed = matchingCurrentEntries.reduce(
      (sum: number, e: any) => sum + Number(e.qty_out || 0) + Number(e.wastage_qty || 0),
      0
    );

    // 3. Active defects in rework / pending at or before this stage
    const matchingDefects = defects.filter((d: any) => {
      const isColourMatch = !selectedColourId || !d.colour_id || d.colour_id === selectedColourId;
      if (!isColourMatch) return false;
      const detectedSeq = d.detected_at_stage?.sequence_no ?? 999;
      return detectedSeq <= selectedLotStage.sequence_no || d.detected_at_stage_id === selectedLotStage.id;
    });

    const activeReworkCount = matchingDefects
      .filter((d: any) => ["sent_for_rework", "in_rework", "pending"].includes(d.status))
      .reduce((sum: number, d: any) => sum + Number(d.quantity || 0), 0);

    // 4. Defect quantities permanently diverted (B-grade, scrap, direct Grade-A stock)
    let bGradeDiverted = 0;
    let scrappedDiverted = 0;
    let stockGradeADiverted = 0;

    matchingDefects.forEach((d: any) => {
      (d.resolutions || []).forEach((res: any) => {
        bGradeDiverted += Number(res.qty_b_grade || 0);
        scrappedDiverted += Number(res.qty_scrapped || 0);
        if (res.resolution_type === "reworked_to_stock_grade_a") {
          stockGradeADiverted += Number(res.qty_recovered || 0);
        }
      });
    });

    const divertedCount = bGradeDiverted + scrappedDiverted + stockGradeADiverted;

    // 5. Total live available pieces remaining in the lot for this colour / overall
    const liveLotRemaining = selectedColourId
      ? lotSizeQuantities
          .filter((sq: any) => sq.colour_id === selectedColourId)
          .reduce((sum: number, sq: any) => sum + Number(sq.quantity || 0), 0)
      : Number(activeLot.total_quantity || 0);

    // Live available cannot exceed prev stage output minus already processed and deductions
    const flowAvailable = Math.max(0, prevQtyOut - currentStageProcessed - activeReworkCount - divertedCount);
    const availableQty = Math.min(flowAvailable, Math.max(0, liveLotRemaining - currentStageProcessed));

    return {
      availableQty,
      activeReworkCount,
      divertedCount,
      bGradeDiverted,
      scrappedDiverted,
      stockGradeADiverted,
      currentStageProcessed,
      prevQtyOut,
    };
  }, [selectedLotStage, activeLot, lotStages, stageEntries, defects, selectedColourId, lotSizeQuantities]);

  // Sync Job Work Type and prefilled Qty In, and pre-fill worker when stage or colour changes
  useEffect(() => {
    if (selectedLotStage && activeLot) {
      setJobWorkType(selectedLotStage.stage_name);
      setQtyIn(stageAvailability.availableQty);
      setQtyOut(stageAvailability.availableQty);

      // Pre-fill worker from lot_stage_workers if assigned
      const assignedStageWorkers = stageWorkers
        .filter((sw: any) => sw.lot_stage_id === stageId)
        .map((sw: any) => sw.worker)
        .filter(Boolean);

      if (assignedStageWorkers.length > 0 && assignedStageWorkers[0]) {
        const sw = assignedStageWorkers[0];
        const matched = workers.find((w) => w.id === sw.id || w.worker_id === sw.worker_id || w.id === sw.worker_id);
        const resolvedWorker = matched || sw;
        setWorkerId(resolvedWorker.id);
        const initialRate = Number(resolvedWorker.wage_rate ?? resolvedWorker.default_rate ?? 0);
        setJobWorkRate(initialRate);
        if (resolvedWorker.wage_type) {
          setPaymentType(resolvedWorker.wage_type);
        }
      } else {
        setWorkerId("");
        setJobWorkRate(0);
      }
    }
  }, [stageId, selectedColourId, stageAvailability.availableQty, selectedLotStage, activeLot, stageWorkers, workers]);

  // Sync worker default rate when worker changes or when workers data arrives
  useEffect(() => {
    if (workerId) {
      const selectedWorker = workers.find((w) => w.id === workerId);
      const rate = (selectedWorker as any)?.wage_rate ?? selectedWorker?.default_rate;
      if (rate !== undefined && rate !== null && Number(rate) > 0) {
        setJobWorkRate(Number(rate));
        if ((selectedWorker as any)?.wage_type) {
          setPaymentType((selectedWorker as any).wage_type);
        }
      }
    }
  }, [workerId, workers]);

  // Auto-calculate wastage when qtyOut changes
  useEffect(() => {
    const diff = qtyIn - qtyOut;
    const newWastage = diff > 0 ? diff : 0;
    setWastageQty(newWastage);
    if (newWastage === 0) {
      setWastageSizeAllocations({});
    }
  }, [qtyIn, qtyOut]);

  // Total allocated wastage pieces across sizes and colours
  const totalAllocatedWastage = useMemo(() => {
    let total = 0;
    Object.values(wastageSizeAllocations).forEach((sizeMap) => {
      Object.values(sizeMap).forEach((q) => {
        total += Math.max(0, Number(q) || 0);
      });
    });
    return total;
  }, [wastageSizeAllocations]);

  // Sync wastageColourId with selectedColourId or availableColours
  useEffect(() => {
    if (selectedColourId) {
      setWastageColourId(selectedColourId);
    } else if (availableColours.length > 0 && !wastageColourId) {
      setWastageColourId(availableColours[0].id);
    }
  }, [selectedColourId, availableColours, wastageColourId]);

  const effectiveWastageColId = selectedColourId || wastageColourId || (availableColours[0]?.id || "all");

  const handleWastageSizeChange = (colourId: string, size: string, value: string) => {
    const parsed = parseInt(value, 10);
    const qty = isNaN(parsed) ? 0 : Math.max(0, parsed);

    setWastageSizeAllocations((prev) => {
      const updated = { ...prev };
      const colKey = colourId || "all";
      const colMap = { ...(updated[colKey] || {}) };
      if (qty > 0) {
        colMap[size] = qty;
      } else {
        delete colMap[size];
      }
      if (Object.keys(colMap).length > 0) {
        updated[colKey] = colMap;
      } else {
        delete updated[colKey];
      }
      return updated;
    });
  };

  // Computations for right panels
  const wastagePercent = qtyIn > 0 ? ((wastageQty / qtyIn) * 100).toFixed(2) : "0.00";
  const qtyBalance = qtyIn - qtyOut - wastageQty;
  const totalJobWorkAmount = qtyOut * jobWorkRate;
  const totalLaborCost = totalJobWorkAmount;

  // Determine assigned workers for option list sorting and highlighting
  const assignedStageWorkers = stageWorkers
    .filter((sw: any) => sw.lot_stage_id === stageId)
    .map((sw: any) => sw.worker)
    .filter(Boolean);

  const assignedWorkerIds = new Set(assignedStageWorkers.map((w: any) => w.id));

  // Sort workers so that assigned ones are at the top
  const sortedWorkers = [
    ...workers.filter((w) => assignedWorkerIds.has(w.id)),
    ...workers.filter((w) => !assignedWorkerIds.has(w.id)),
  ];

  const handleSaveEntry = async () => {
    if (!selectedLotId || !stageId || !entryDate || qtyOut <= 0) {
      toast.error("Please fill in all required fields and complete quantity details");
      return;
    }

    // Validate Wastage Size Allocation (Approach 2)
    if (wastageQty > 0 && totalAllocatedWastage !== wastageQty) {
      toast.error(
        `Please allocate all ${wastageQty} wasted pieces across sizes before saving. Currently allocated: ${totalAllocatedWastage} Pcs.`
      );
      return;
    }

    // Validate Required Custom Fields
    for (const field of stageCustomFields) {
      if (field.required) {
        const val = customFieldValues[field.name];
        if (val === undefined || val === null || val === "" || (field.type === "boolean" && val !== true && val !== false)) {
          toast.error(`Please provide required stage parameter: '${field.name}'`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        lot_id: selectedLotId,
        lot_stage_id: stageId,
        colour_id: selectedColourId || null,
        entry_date: entryDate,
        shift,
        qty_in: qtyIn,
        qty_out: qtyOut,
        wastage_qty: wastageQty,
        wastage_size_allocations: wastageSizeAllocations,
        job_work_type: jobWorkType,
        job_work_rate: jobWorkRate,
        payment_type: paymentType,
        worker_id: workerId || null,
        no_of_workers: noOfWorkers,
        remarks,
        custom_field_values: customFieldValues,
        attachments,
        // Section 5: optional accessory issuances
        accessories: Object.entries(accessoryIssuances)
          .filter(([, qty]) => qty > 0)
          .map(([lot_accessory_id, issued_qty]) => ({ lot_accessory_id, issued_qty })),
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

  // Format all active colours for display
  const activeColours = activeLot
    ? (Array.isArray(activeLot.colours) && activeLot.colours.length > 0 ? activeLot.colours : activeLot.colour ? [activeLot.colour] : [])
    : [];
  const colourNamesStr = activeColours.map((c: any) => c?.colour_name || "").filter(Boolean).join(", ") || "—";
  const sizeSetStr = activeLot?.size_set?.name
    ? `${activeLot.size_set.name}${Array.isArray(activeLot.size_set.sizes) ? ` (${activeLot.size_set.sizes.join(", ")})` : ""}`
    : Array.isArray(activeLot?.size_set?.sizes)
    ? activeLot.size_set.sizes.join(", ")
    : "—";

  // Summary items
  const lotSummaryItems = activeLot
    ? [
        { label: "Lot No.", value: activeLot.lot_number },
        { label: "Design", value: activeLot.design?.code ? `${activeLot.design.code} - ${activeLot.design.name}` : "—" },
        { label: "Colour(s)", value: colourNamesStr },
        { label: "Size Set", value: sizeSetStr },
        { label: "Total Lot Qty", value: `${activeLot.total_quantity?.toLocaleString("en-IN")} Pcs`, isQuantity: true },
        { label: "Completed Qty", value: `${activeLot.completed_quantity?.toLocaleString("en-IN")} Pcs` },
      ]
    : [];

  const stageSummaryItems = selectedLotStage
    ? [
        { label: "Available To Process", value: `${stageAvailability.availableQty.toLocaleString("en-IN")} Pcs` },
        ...(stageAvailability.activeReworkCount > 0
          ? [{ label: "In Rework (Pending)", value: `${stageAvailability.activeReworkCount.toLocaleString("en-IN")} Pcs` }]
          : []),
        ...(stageAvailability.bGradeDiverted > 0
          ? [{ label: "Moved to B-Grade", value: `${stageAvailability.bGradeDiverted.toLocaleString("en-IN")} Pcs` }]
          : []),
        ...(stageAvailability.scrappedDiverted > 0
          ? [{ label: "Scrapped / Written Off", value: `${stageAvailability.scrappedDiverted.toLocaleString("en-IN")} Pcs` }]
          : []),
        ...(stageAvailability.currentStageProcessed > 0
          ? [{ label: "Already Logged in Stage", value: `${stageAvailability.currentStageProcessed.toLocaleString("en-IN")} Pcs` }]
          : []),
        { label: "Qty In (This Entry)", value: qtyIn.toLocaleString("en-IN") },
        { label: "Qty Out (Processed)", value: qtyOut.toLocaleString("en-IN") },
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
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F9FAFB] transition-colors cursor-pointer animate-fadeIn"
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
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-xs flex items-center justify-center border border-[var(--primary)]/20">
                1
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Lot & Stage Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Lot Number <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedLotId}
                  onChange={(e) => {
                    setSelectedLotId(e.target.value);
                    setStageId("");
                    setSelectedColourId("");
                  }}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
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
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Colour Batch
                </label>
                <select
                  value={selectedColourId}
                  onChange={(e) => {
                    setSelectedColourId(e.target.value);
                  }}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] pl-3 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                  disabled={!selectedLotId}
                >
                  <option value="">All Colours ({activeLot?.total_quantity || 0} Pcs)</option>
                  {availableColours.map((c: any) => {
                    const qty = lotSizeQuantities
                      .filter((sq: any) => sq.colour_id === c.id)
                      .reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0);
                    return (
                      <option key={c.id} value={c.id}>
                        ● {c.colour_name} ({qty > 0 ? `${qty} Pcs` : "Batch"})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Production Stage <span className="text-red-500">*</span>
                </label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                  disabled={!selectedLotId}
                >
                  <option value="">Select Stage</option>
                  {stagesWithReadiness.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.isLocked}>
                      {s.sequence_no} - {s.stage_name} {
                        s.isLocked
                          ? "🔒 (Waiting for prev stage)"
                          : s.isCompleted
                          ? `✓ (${s.currentStageProcessed} Pcs Completed)`
                          : s.currentStageProcessed > 0
                          ? `⏳ (Partial: ${s.currentStageProcessed}/${activeLot?.total_quantity || "—"} Pcs)`
                          : "⏳ (Ready)"
                      }
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Entry Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Shift</label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] pl-3 pr-8 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                >
                  <option value="day">Day Shift (9 AM - 6 PM)</option>
                  <option value="night">Night Shift (8 PM - 5 AM)</option>
                  <option value="general">General Shift</option>
                </select>
              </div>
            </div>

            {/* INFO ROW BAR */}
            {activeLot && (
              <div className="bg-[var(--page-bg)] rounded-lg px-4 py-3 border border-[var(--border)] flex flex-wrap items-center gap-x-8 gap-y-2 text-xs font-medium text-[var(--text-muted)]">
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Brand:</span>
                  <span className="font-bold text-[var(--text-primary)]">{activeLot.brand?.name || "—"}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Design:</span>
                  <span className="font-bold text-[var(--text-primary)]">{activeLot.design?.code} - {activeLot.design?.name}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Colour(s):</span>
                  <div className="font-bold text-[var(--text-primary)] flex flex-wrap items-center gap-1">
                    {activeColours.length > 0 ? (
                      activeColours.map((c: any, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-[var(--card-bg)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[11px]">
                          {c.hex_code && (
                            <span className="w-2 h-2 rounded-full border border-[var(--border)]" style={{ backgroundColor: c.hex_code }} />
                          )}
                          {c.colour_name}
                        </span>
                      ))
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Size Set:</span>
                  <span className="font-bold text-[var(--text-primary)]">{sizeSetStr}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block text-[11px]">Total Lot Qty:</span>
                  <span className="font-bold text-[var(--primary)]">{activeLot.total_quantity} Pcs</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Quantity Details */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/20">
                2
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Quantity Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Qty In (From Prev) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  value={qtyIn}
                  onChange={(e) => setQtyIn(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-semibold text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Qty Out (Processed) <span className="text-red-500">*</span>
                </label>
                <NumericInput
                  min="0"
                  value={qtyOut}
                  onChange={(e) => setQtyOut(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-bold text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Wastage Qty</label>
                <NumericInput
                  min="0"
                  value={wastageQty}
                  onChange={(e) => setWastageQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-semibold text-orange-600 dark:text-orange-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Wastage %</label>
                <input
                  type="text"
                  value={`${wastagePercent}%`}
                  disabled
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm font-semibold text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Qty Balance</label>
                <NumericInput
                  value={qtyBalance}
                  disabled
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm font-semibold text-[var(--text-muted)]"
                />
              </div>
            </div>

            {/* Live Flow & Defect / Rework Breakdown Badge */}
            {selectedLotStage && (
              <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-secondary)]">Available to Process:</span>
                    <span className="font-bold text-[var(--primary)] text-sm">
                      {stageAvailability.availableQty} Pcs
                    </span>
                    {selectedColourId && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        (Batch: {availableColours.find((c: any) => c.id === selectedColourId)?.colour_name || "Selected"})
                      </span>
                    )}
                  </div>
                  {stageAvailability.prevQtyOut > 0 && (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Previous Stage Out: <strong className="text-[var(--text-primary)]">{stageAvailability.prevQtyOut} Pcs</strong>
                    </span>
                  )}
                </div>

                {(stageAvailability.divertedCount > 0 || stageAvailability.activeReworkCount > 0 || stageAvailability.currentStageProcessed > 0) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)] text-[11px]">
                    {stageAvailability.activeReworkCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                        ⚠️ {stageAvailability.activeReworkCount} Pcs in active rework
                      </span>
                    )}
                    {stageAvailability.bGradeDiverted > 0 && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium">
                        📦 {stageAvailability.bGradeDiverted} Pcs allocated to B-Grade stock
                      </span>
                    )}
                    {stageAvailability.scrappedDiverted > 0 && (
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-medium">
                        🗑️ {stageAvailability.scrappedDiverted} Pcs scrapped / written off
                      </span>
                    )}
                    {stageAvailability.currentStageProcessed > 0 && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                        ✓ {stageAvailability.currentStageProcessed} Pcs already logged in this stage
                      </span>
                    )}
                  </div>
                )}

                {wastageQty > 0 && selectedLotId && (
                  <div className="pt-3 border-t border-[var(--border)] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Defective / Wastage Size Breakdown
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          (Deduct exact sizes from lot stock)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {totalAllocatedWastage === wastageQty ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                            ✓ {totalAllocatedWastage} / {wastageQty} Pcs Allocated
                          </span>
                        ) : totalAllocatedWastage < wastageQty ? (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 flex items-center gap-1">
                            ⚠️ {totalAllocatedWastage} / {wastageQty} Allocated ({wastageQty - totalAllocatedWastage} remaining)
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 flex items-center gap-1">
                            ❌ Overallocated ({totalAllocatedWastage} / {wastageQty})
                          </span>
                        )}

                        {totalAllocatedWastage > 0 && (
                          <button
                            type="button"
                            onClick={() => setWastageSizeAllocations({})}
                            className="text-[10px] text-[var(--text-muted)] hover:text-red-500 underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Colour Selector if Multiple Colours and Not pre-filtered to 1 colour */}
                    {!selectedColourId && availableColours.length > 1 && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs font-semibold text-[var(--text-secondary)] shrink-0">Select Colour:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {availableColours.map((c: any) => {
                            const isSelected = effectiveWastageColId === c.id;
                            const colourAllocCount = Object.values(wastageSizeAllocations[c.id] || {}).reduce(
                              (sum, q) => sum + (Number(q) || 0),
                              0
                            );
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setWastageColourId(c.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                                  isSelected
                                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                                    : "bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)]"
                                }`}
                              >
                                {c.hex_code && (
                                  <span
                                    className="w-2 h-2 rounded-full border border-black/20"
                                    style={{ backgroundColor: c.hex_code }}
                                  />
                                )}
                                {c.colour_name}
                                {colourAllocCount > 0 && (
                                  <span className={`text-[10px] px-1 rounded font-bold ${isSelected ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-600"}`}>
                                    {colourAllocCount} pcs
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Per-Size Matrix Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--border)]">
                      {availableSizes.map((size) => {
                        const allocated = wastageSizeAllocations[effectiveWastageColId]?.[size] || 0;
                        const curLotSize = lotSizeQuantities.find(
                          (sq: any) =>
                            (!effectiveWastageColId || effectiveWastageColId === "all" || sq.colour_id === effectiveWastageColId) &&
                            sq.size === size
                        );
                        const curStock = curLotSize ? Number(curLotSize.quantity || 0) : null;
                        const unallocated = Math.max(0, wastageQty - totalAllocatedWastage);

                        return (
                          <div
                            key={size}
                            className={`p-2 rounded-lg border flex flex-col items-center justify-between gap-1.5 transition-colors ${
                              allocated > 0
                                ? "bg-amber-500/10 border-amber-500/30"
                                : "bg-[var(--card-bg)] border-[var(--border)]"
                            }`}
                          >
                            <div className="w-full flex items-center justify-between text-[11px]">
                              <span className="font-bold text-[var(--text-primary)]">Size {size}</span>
                              {curStock !== null && (
                                <span className="text-[10px] text-[var(--text-muted)]" title="Total pieces in lot for this size">
                                  {curStock} in lot
                                </span>
                              )}
                            </div>

                            <div className="w-full flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleWastageSizeChange(effectiveWastageColId, size, String(Math.max(0, allocated - 1)))}
                                disabled={allocated <= 0}
                                className="w-7 h-8 rounded border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-secondary)] font-bold text-xs hover:bg-[var(--page-bg)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={allocated > 0 ? allocated : ""}
                                placeholder="0"
                                onChange={(e) => handleWastageSizeChange(effectiveWastageColId, size, e.target.value)}
                                className="w-full h-8 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] text-center text-xs font-bold transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleWastageSizeChange(effectiveWastageColId, size, String(allocated + 1))}
                                className="w-7 h-8 rounded border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-secondary)] font-bold text-xs hover:bg-[var(--page-bg)] flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </div>

                            {unallocated > 0 && allocated === 0 && (
                              <button
                                type="button"
                                onClick={() => handleWastageSizeChange(effectiveWastageColId, size, String(unallocated))}
                                className="w-full text-[10px] text-[var(--primary)] hover:underline font-medium text-center pt-0.5"
                              >
                                + Fill remaining ({unallocated})
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1">
                      <span>
                        💡 Allocated pieces will be deducted immediately from <strong>lot_size_quantities</strong> upon saving.
                      </span>
                      <Link
                        href={`/production/lots/${selectedLotId}?tab=defects`}
                        target="_blank"
                        className="underline font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500"
                      >
                        Advanced Defect & Rework Management →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Job Work Details */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                3
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Job Work Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Job Work Type</label>
                <input
                  type="text"
                  value={jobWorkType}
                  onChange={(e) => setJobWorkType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                  placeholder="e.g. Stitching"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Rate (Per Pc)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)] font-semibold">₹</span>
                  <NumericInput
                    step="0.01"
                    value={jobWorkRate}
                    onChange={(e) => setJobWorkRate(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Total Amount
                </label>
                <input
                  type="text"
                  value={formatCurrency(totalJobWorkAmount)}
                  disabled
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm font-bold text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                >
                  <option value="piece_rate">Piece Rate</option>
                  <option value="fixed">Fixed Rate</option>
                  <option value="per_day">Per Day / Daily Wage</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Worker Assignment */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-bold text-xs flex items-center justify-center border border-[var(--primary)]/20">
                4
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Worker Assignment
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5 uppercase">
                  Assign Worker <span className="text-red-500">*</span>
                </label>
                <select
                  value={workerId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setWorkerId(nextId);
                    if (nextId) {
                      const selectedWorker = workers.find((w) => w.id === nextId);
                      if (selectedWorker) {
                        const rate = (selectedWorker as any).wage_rate ?? selectedWorker.default_rate ?? 0;
                        setJobWorkRate(rate);
                        if ((selectedWorker as any).wage_type) {
                          setPaymentType((selectedWorker as any).wage_type);
                        }
                      }
                    } else {
                      setJobWorkRate(0);
                    }
                  }}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] pl-3 pr-8 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] truncate"
                >
                  <option value="">Select Worker</option>
                  {sortedWorkers.map((w) => {
                    const isAssigned = assignedWorkerIds.has(w.id);
                    const rate = (w as any).wage_rate ?? w.default_rate;
                    return (
                      <option
                        key={w.id}
                        value={w.id}
                        className={isAssigned ? "font-bold text-[var(--primary)]" : ""}
                      >
                        {isAssigned ? "⭐ " : ""}{w.name} ({w.worker_id}) {rate ? `· ₹${rate}/pc` : ""}{isAssigned ? " [Assigned]" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Worker Type</label>
                <input
                  type="text"
                  value={
                    workerId
                      ? workers.find((w) => w.id === workerId)?.type?.replace("_", " ") || "—"
                      : "—"
                  }
                  disabled
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm capitalize text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">No. of Workers</label>
                <NumericInput
                  min="1"
                  value={noOfWorkers}
                  onChange={(e) => setNoOfWorkers(parseInt(e.target.value, 10) || 1)}
                  className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">
                  Total Labor Cost
                </label>
                <input
                  type="text"
                  value={formatCurrency(totalLaborCost)}
                  disabled
                  className="w-full h-10 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm font-bold text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────── */}
          {/* Section 5: Accessory Assignment (Optional, collapsed) */}
          {/* ───────────────────────────────────────────────────── */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => setAccessoriesExpanded((v) => !v)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    Accessory Assignment
                    <span className="text-[10px] font-normal text-[var(--text-faint)] normal-case tracking-normal">(Optional)</span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    {lotAccessoryPool.length === 0
                      ? "No accessories allocated to this lot"
                      : `${lotAccessoryPool.length} accessory type(s) · ${Object.values(accessoryIssuances).filter(q => q > 0).length} to be issued`
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {Object.values(accessoryIssuances).some(q => q > 0) && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {Object.values(accessoryIssuances).filter(q => q > 0).length} item(s) to issue
                  </span>
                )}
                <span className={`text-[var(--text-muted)] transition-transform duration-200 ${accessoriesExpanded ? "rotate-90" : ""}`}>
                  ▶
                </span>
              </div>
            </button>

            {/* Accordion Body */}
            {accessoriesExpanded && (
              <div className="px-5 pb-5 border-t border-[var(--border)]">
                {!selectedLotId ? (
                  <p className="text-xs text-[var(--text-faint)] italic mt-4">
                    Select a Lot in Section 1 to see its allocated accessories.
                  </p>
                ) : lotAccessoryPool.length === 0 ? (
                  <div className="mt-4 py-6 text-center border border-dashed border-[var(--border)] rounded-xl">
                    <p className="text-xs text-[var(--text-faint)]">
                      No accessories allocated to this lot.
                    </p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-1">
                      Accessories are allocated during Lot Creation (Step 1 → Accessories tab).
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Issue accessories to <span className="font-bold text-[var(--text-primary)]">
                        {workerId ? (workers.find(w => w.id === workerId)?.name || "selected worker") : "worker (select in Section 4)"}
                      </span>. Leave qty as 0 to skip.
                    </p>
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase text-[10px] font-bold">
                            <th className="p-2.5 text-left">Accessory</th>
                            <th className="p-2.5 text-left">Godown</th>
                            <th className="p-2.5 text-center">Allocated</th>
                            <th className="p-2.5 text-center">Already Issued</th>
                            <th className="p-2.5 text-center">Available</th>
                            <th className="p-2.5 text-center w-28">Issue Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] bg-[var(--card-bg)]">
                          {lotAccessoryPool.map((acc: any) => {
                            const issueQty = accessoryIssuances[acc.id] ?? 0;
                            return (
                              <tr key={acc.id} className={`hover:bg-[var(--table-row-hover)] transition-colors ${issueQty > 0 ? "bg-emerald-500/5" : ""}`}>
                                <td className="p-2.5">
                                  <div className="font-semibold text-[var(--text-primary)]">{acc.item_name}</div>
                                  <div className="text-[10px] text-[var(--text-muted)]">₹{Number(acc.unit_rate).toFixed(2)}/{acc.unit}</div>
                                </td>
                                <td className="p-2.5 text-[var(--text-muted)]">{acc.godown_name || "—"}</td>
                                <td className="p-2.5 text-center text-[var(--text-secondary)] font-mono">{Number(acc.allocated_qty).toLocaleString("en-IN")} {acc.unit}</td>
                                <td className="p-2.5 text-center text-[var(--text-muted)] font-mono">{Number(acc.total_issued_qty).toLocaleString("en-IN")} {acc.unit}</td>
                                <td className="p-2.5 text-center font-mono font-bold">
                                  <span className={Number(acc.available_qty) > 0 ? "text-emerald-600" : "text-red-400"}>
                                    {Number(acc.available_qty).toLocaleString("en-IN")} {acc.unit}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      max={acc.available_qty}
                                      value={issueQty || ""}
                                      onChange={(e) => {
                                        const val = Math.min(Number(acc.available_qty), Math.max(0, parseFloat(e.target.value) || 0));
                                        setAccessoryIssuances(prev => ({ ...prev, [acc.id]: val }));
                                      }}
                                      placeholder="0"
                                      disabled={Number(acc.available_qty) <= 0}
                                      className="w-20 h-8 text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] disabled:opacity-40"
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ───────────────────────────────────────────────────── */}
          {/* Section 6: Additional Info (was Section 5)           */}
          {/* ───────────────────────────────────────────────────── */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold text-xs flex items-center justify-center">
                6
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Additional Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Remarks</label>
                <textarea
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={250}
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] p-3 text-sm resize-none"
                  placeholder="Additional entry details..."
                />
                <span className="text-[10px] text-[var(--text-muted)] font-bold block text-right mt-1">
                  {remarks.length} / 250 characters
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">
                    Stage Custom Properties
                  </label>
                  {stageCustomFields.length > 0 && (
                    <span className="text-[10px] font-bold text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--primary)]/20 px-2 py-0.5 rounded-full">
                      {stageCustomFields.length} {stageCustomFields.length === 1 ? "Property" : "Properties"}
                    </span>
                  )}
                </div>

                {stageCustomFields.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] italic bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">
                    No custom properties configured for this stage.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stageCustomFields.map((field) => (
                      <div key={field.name}>
                        <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1 uppercase flex items-center justify-between">
                          <span>
                            {field.name} {field.required && <span className="text-red-500">*</span>}
                          </span>
                          <span className="text-[9px] font-mono text-[var(--text-faint)] lowercase">({field.type})</span>
                        </label>
                        {field.type === "boolean" ? (
                          <label className="flex items-center gap-2 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={!!customFieldValues[field.name]}
                              onChange={(e) =>
                                setCustomFieldValues((prev) => ({ ...prev, [field.name]: e.target.checked }))
                              }
                              className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--input-focus)]"
                            />
                            <span className="text-xs font-semibold text-[var(--text-primary)]">
                              {customFieldValues[field.name] ? "Yes / Approved" : "No / Pending"}
                            </span>
                          </label>
                        ) : field.type === "number" ? (
                          <NumericInput
                            value={customFieldValues[field.name] || 0}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({
                                ...prev,
                                [field.name]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            placeholder={`Enter ${field.name}`}
                            className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                          />
                        ) : field.type === "date" ? (
                          <input
                            type="date"
                            value={customFieldValues[field.name] || ""}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                            }
                            className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                          />
                        ) : (
                          <input
                            type="text"
                            value={customFieldValues[field.name] || ""}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                            }
                            placeholder={`Enter ${field.name}`}
                            className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5 uppercase">Attachments / Finished Goods Photos</label>
                <div className="flex flex-col items-center justify-center border border-dashed border-[var(--border)] rounded-lg p-5 bg-[var(--page-bg)] hover:border-[var(--primary)] transition-colors relative min-h-[140px]">
                  {uploading ? (
                    <span className="text-xs text-[var(--text-muted)] font-semibold">Uploading photo...</span>
                  ) : (
                    <>
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] text-center mb-1">
                        Upload finished goods photos
                      </span>
                      <span className="text-[9px] text-[var(--text-faint)] text-center mb-3">
                        JPG, PNG, PDF (Max. 5MB)
                      </span>
                      <label className="bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-bold text-[9px] px-3 py-1.5 rounded transition-all cursor-pointer">
                        Browse Files
                        <input
                          type="file"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const result = await upload(file);
                              if (result.success) {
                                setAttachments((prev) => [...prev, result.url]);
                                toast.success("File uploaded successfully!");
                              } else {
                                toast.error(result.error);
                              }
                            }
                          }}
                        />
                      </label>
                    </>
                  )}
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachments.map((url, idx) => (
                      <div key={idx} className="relative group w-16 h-16 border border-[var(--border)] rounded overflow-hidden bg-[var(--page-bg)] flex items-center justify-center">
                        {url.endsWith(".pdf") ? (
                          <span className="text-[10px] font-bold text-red-500">PDF</span>
                        ) : (
                          <img src={url} alt={`upload-${idx}`} className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block">Note</span>
              <p className="text-xs text-[var(--text-body)] leading-relaxed mt-1">
                After saving, the quantity will be updated and made available for the next stage in the lot&apos;s production line.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
