"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Boxes,
  GitBranch,
  Save,
  ChevronUp,
  ChevronDown,
  Trash2,
  Info,
  RefreshCw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";

interface EditLotProps {
  params: { id: string };
}

interface Brand {
  id: string;
  name: string;
}

interface DesignColour {
  id: string;
  colour_name: string;
  colour_hex: string | null;
}

interface SizeSet {
  id: string;
  name: string;
  sizes: string[];
}

interface Design {
  id: string;
  name: string;
  code: string;
  brand_id: string;
  size_set_id: string;
  images: string[];
  design_colours?: DesignColour[];
  size_set?: SizeSet;
}

interface ProductionStage {
  id: string;
  name: string;
  type: string;
}

interface LotStageInput {
  stage_id: string;
  stage_name: string;
  stage_type: string;
  sequence_no: number;
  is_mandatory: boolean;
  description: string;
}

export default function EditLotPage({ params }: EditLotProps) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Basic Details State
  const [brandId, setBrandId] = useState("");
  const [designId, setDesignId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [lotDate, setLotDate] = useState("");
  const [colourId, setColourId] = useState("");
  const [season, setSeason] = useState("");
  const [buyerOrderRef, setBuyerOrderRef] = useState("");
  const [targetStartDate, setTargetStartDate] = useState("");
  const [targetDispatchDate, setTargetDispatchDate] = useState("");
  const [targetDueDate, setTargetDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [allowRework, setAllowRework] = useState(false);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [poDate, setPoDate] = useState("");
  const [status, setStatus] = useState("draft");

  // Sizes breakdown state
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [selectedSizeSetId, setSelectedSizeSetId] = useState("");

  // Assigned stages state
  const [assignedStages, setAssignedStages] = useState<LotStageInput[]>([]);

  const [saving, setSaving] = useState(false);

  // Queries
  const { data: lotData, isLoading: loadingLot } = useQuery({
    queryKey: ["lot-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/production/lots/${id}`);
      if (!res.ok) throw new Error("Failed to fetch lot details");
      return res.json();
    },
  });

  const { data: brandsData } = useQuery<{ brands: Brand[] }>({
    queryKey: ["brands-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/brands");
      return res.json();
    },
  });

  const { data: designsData } = useQuery<{ designs: Design[] }>({
    queryKey: ["designs-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/designs");
      return res.json();
    },
  });

  const { data: masterStagesData } = useQuery<{ stages: ProductionStage[] }>({
    queryKey: ["master-stages-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-stages");
      return res.json();
    },
  });

  const brands = brandsData?.brands || [];
  const designs = designsData?.designs || [];
  const masterStages = masterStagesData?.stages || [];

  const selectedDesign = designs.find((d) => d.id === designId);

  // Load existing lot values into state
  useEffect(() => {
    if (lotData) {
      const lot = lotData.lot;
      setBrandId(lot.brand_id || "");
      setDesignId(lot.design_id || "");
      setLotNumber(lot.lot_number || "");
      setLotDate(lot.lot_date || "");
      setColourId(lot.colour_id || "");
      setSeason(lot.season || "Summer 2024");
      setBuyerOrderRef(lot.buyer_order_ref || "");
      setTargetStartDate(lot.target_start_date || "");
      setTargetDispatchDate(lot.target_dispatch_date || "");
      setTargetDueDate(lot.target_due_date || "");
      setPriority(lot.priority || "normal");
      setStatus(lot.status || "draft");
      setAllowRework(!!lot.allow_rework);
      setNotes(lot.notes || "");
      setInternalNotes(lot.internal_notes || "");
      setCustomerRef(lot.customer_ref || "");
      setPoDate(lot.po_date || "");

      // Sizes
      const sizesList = lotData.sizes || [];
      const initSizes = sizesList.map((s: any) => s.size);
      setAvailableSizes(initSizes);
      setSelectedSizeSetId(lot.size_set_id);
      const initQties: Record<string, number> = {};
      sizesList.forEach((s: any) => {
        initQties[s.size] = s.quantity;
      });
      setSizeQuantities(initQties);

      // Stages
      const stagesList = lotData.stages || [];
      setAssignedStages(
        stagesList.map((s: any) => ({
          stage_id: s.stage_id,
          stage_name: s.stage_name,
          stage_type: s.stage_type,
          sequence_no: s.sequence_no,
          is_mandatory: s.is_mandatory,
          description: s.description || "",
        }))
      );
    }
  }, [lotData]);

  // Handle stage sequence change
  const moveStage = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === assignedStages.length - 1) return;

    const newStages = [...assignedStages];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = newStages[index];
    newStages[index] = newStages[targetIdx];
    newStages[targetIdx] = temp;

    // Recalculate sequence
    const updated = newStages.map((s, i) => ({
      ...s,
      sequence_no: i + 1,
    }));
    setAssignedStages(updated);
  };

  const handleStageRequiredToggle = (index: number) => {
    const updated = [...assignedStages];
    updated[index].is_mandatory = !updated[index].is_mandatory;
    setAssignedStages(updated);
  };

  const handleStageDescChange = (index: number, desc: string) => {
    const updated = [...assignedStages];
    updated[index].description = desc;
    setAssignedStages(updated);
  };

  // Add Custom Stage
  const handleAddStage = (stageId: string) => {
    const masterStage = masterStages.find((s) => s.id === stageId);
    if (!masterStage) return;

    if (assignedStages.some((s) => s.stage_id === stageId)) {
      toast.error("Stage already assigned");
      return;
    }

    const newStage = {
      stage_id: masterStage.id,
      stage_name: masterStage.name,
      stage_type: masterStage.type || "in_house",
      sequence_no: assignedStages.length + 1,
      is_mandatory: true,
      description: "",
    };

    setAssignedStages([...assignedStages, newStage]);
    toast.success(`Added stage: ${masterStage.name}`);
  };

  const handleRemoveStage = (index: number) => {
    const filtered = assignedStages.filter((_, i) => i !== index);
    const updated = filtered.map((s, i) => ({
      ...s,
      sequence_no: i + 1,
    }));
    setAssignedStages(updated);
  };

  const totalQuantity = Object.values(sizeQuantities).reduce((acc, curr) => acc + curr, 0);

  // Submit Save
  const handleSaveChanges = async () => {
    if (!brandId || !designId || totalQuantity <= 0) {
      toast.error("Please fill in all required fields and enter quantities");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        brand_id: brandId,
        design_id: designId,
        colour_id: colourId || null,
        size_set_id: selectedSizeSetId || null,
        lot_date: lotDate,
        season,
        buyer_order_ref: buyerOrderRef || null,
        target_start_date: targetStartDate || null,
        target_dispatch_date: targetDispatchDate || null,
        target_due_date: targetDueDate || null,
        priority,
        status,
        allow_rework: allowRework,
        notes,
        internal_notes: internalNotes || null,
        customer_ref: customerRef || null,
        po_date: poDate || null,
        total_quantity: totalQuantity,
        sizes: Object.entries(sizeQuantities).map(([size, quantity]) => ({
          size,
          quantity,
        })),
        stages: assignedStages,
      };

      const res = await fetch(`/api/production/lots/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update lot");

      toast.success("Lot changes saved successfully");
      router.push(`/production/lots/${id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loadingLot) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[#64748B]">Loading lot details...</span>
      </div>
    );
  }

  // Right summary panel items
  const summaryItems = [
    { label: "Lot No.", value: lotNumber || "—" },
    { label: "Brand", value: brands.find((b) => b.id === brandId)?.name || "—" },
    { label: "Design", value: selectedDesign ? `${selectedDesign.code} - ${selectedDesign.name}` : "—" },
    {
      label: "Colour",
      value: selectedDesign?.design_colours?.find((c) => c.id === colourId)?.colour_name || "—",
    },
    { label: "Size Set", value: availableSizes.join(", ") || "—" },
    { label: "Stages Assigned", value: `${assignedStages.length} Stages` },
    {
      label: "Total Quantity",
      value: `${totalQuantity.toLocaleString("en-IN")} Pcs`,
      isQuantity: true,
    },
    { label: "Target Start", value: targetStartDate || "—" },
    { label: "Target Due", value: targetDueDate || "—" },
  ];

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Production
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <Link href="/production/lots" className="hover:text-[#6366F1] transition-colors">
          Production Lots
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <Link href={`/production/lots/${id}`} className="hover:text-[#6366F1] transition-colors">
          {lotNumber}
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Edit Lot</span>
      </nav>

      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/production/lots/${id}`}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F9FAFB] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Edit Production Lot</h2>
            <p className="text-xs text-[#64748B]">Update quantities, routing and scheduling for: {lotNumber}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveChanges}
          disabled={saving || totalQuantity === 0}
          className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold text-sm px-5 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
        >
          <Save size={16} />
          Save Changes
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Lot Info */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#EEF2FF] text-[#6366F1] font-bold text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Lot Information</h3>
                <p className="text-[11px] text-[#64748B]">Update basic settings for this lot</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Design</label>
                <select
                  value={designId}
                  onChange={(e) => setDesignId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  {designs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Colour</label>
                <select
                  value={colourId}
                  onChange={(e) => setColourId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  disabled={!designId}
                >
                  <option value="">Select Colour</option>
                  {selectedDesign?.design_colours?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.colour_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase font-mono">Lot No.</label>
                <input
                  type="text"
                  value={lotNumber}
                  disabled
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-gray-50 px-3 text-sm font-mono font-bold text-[#374151]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Target Start Date</label>
                <input
                  type="date"
                  value={targetStartDate}
                  onChange={(e) => setTargetStartDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Target Due Date</label>
                <input
                  type="date"
                  value={targetDueDate}
                  onChange={(e) => setTargetDueDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
                >
                  <option value="low">🟢 Low</option>
                  <option value="normal">🟡 Normal</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={250}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm focus:ring-1 focus:ring-[#6366F1] resize-none"
                placeholder="Enter notes..."
              />
              <span className="text-[10px] text-[#94A3B8] font-bold block text-right mt-1">
                {notes.length} / 250 characters
              </span>
            </div>
          </div>

          {/* Section 2: Size Breakdowns */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-bold text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                  Quantity Breakdown by Size
                </h3>
                <p className="text-[11px] text-[#64748B]">Update quantities for the current size sets</p>
              </div>
            </div>

            {availableSizes.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#94A3B8]">No sizes configured.</div>
            ) : (
              <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase">
                      <th className="py-2.5 px-3">Size</th>
                      {availableSizes.map((size) => (
                        <th key={size} className="py-2.5 px-3 border-l border-[#E5E7EB]">
                          {size}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 border-l border-[#E5E7EB]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-sm">
                      <td className="py-2 px-3 bg-[#F9FAFB] font-bold text-[#374151]">Qty (Pcs)</td>
                      {availableSizes.map((size) => (
                        <td key={size} className="py-2 px-3 border-l border-[#E5E7EB]">
                          <input
                            type="number"
                            min="0"
                            value={sizeQuantities[size] || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setSizeQuantities({
                                ...sizeQuantities,
                                [size]: val,
                              });
                            }}
                            className="w-20 h-9 text-center border border-[#E5E7EB] rounded-lg text-sm"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 border-l border-[#E5E7EB] font-black text-[#0F172A] bg-[#F9FAFB]">
                        {totalQuantity}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Stages */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#EDE9FE] text-[#7C3AED] font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                    Assign Production Stages
                  </h3>
                  <p className="text-[11px] text-[#64748B]">Add, remove or reorder stages for this lot</p>
                </div>
              </div>
            </div>

            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase">
                    <th className="py-2.5 px-4 w-12 text-center">Order</th>
                    <th className="py-2.5 px-4">Stage Name</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-center">Required</th>
                    <th className="py-2.5 px-4 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-sm">
                  {assignedStages.map((stage, index) => (
                    <tr key={stage.stage_id} className="hover:bg-[#F9FAFB]">
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => moveStage(index, "up")}
                            disabled={index === 0}
                            className="p-0.5 text-[#94A3B8] hover:text-[#6366F1] disabled:opacity-35 cursor-pointer"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <span className="font-mono text-xs font-bold">{stage.sequence_no}</span>
                          <button
                            type="button"
                            onClick={() => moveStage(index, "down")}
                            disabled={index === assignedStages.length - 1}
                            className="p-0.5 text-[#94A3B8] hover:text-[#6366F1] disabled:opacity-35 cursor-pointer"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#374151]">
                        {stage.stage_name}
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={stage.description}
                          onChange={(e) => handleStageDescChange(index, e.target.value)}
                          className="h-8 rounded border border-[#E5E7EB] bg-white px-2 text-xs w-full"
                          placeholder="e.g. In-house cutting details"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={stage.is_mandatory}
                          onChange={() => handleStageRequiredToggle(index)}
                          className="h-4.5 w-4.5 rounded border-[#E5E7EB] text-[#6366F1] focus:ring-[#6366F1]"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveStage(index)}
                          className="p-1.5 rounded border border-[#E5E7EB] text-red-500 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add stage and Blue info banner */}
            <div className="flex flex-col gap-4">
              <select
                onChange={(e) => {
                  if (e.target.value) handleAddStage(e.target.value);
                  e.target.value = "";
                }}
                className="h-9 text-xs rounded-lg border border-[#E5E7EB] bg-white px-2.5 focus:ring-1 focus:ring-[#6366F1] w-48"
              >
                <option value="">+ Add Production Stage</option>
                {masterStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type})
                  </option>
                ))}
              </select>

              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 flex gap-2">
                <Info className="h-4 w-4 text-[#1D4ED8] mt-0.5 shrink-0" />
                <span className="text-xs text-[#1E40AF]">
                  Changes will be reflected in the lot and related upcoming stage entries.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live summaries */}
        <div className="space-y-6">
          <LotSummaryPanel title="Lot Live Preview" items={summaryItems} />

          <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-xl p-4 flex gap-2.5">
            <Info className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
            <span className="text-xs text-[#92400E] font-medium leading-relaxed">
              Updating lot settings will recalculate pending stage flows. Make sure existing stages are locked before modifying their sequence.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
