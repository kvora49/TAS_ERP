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
  Settings,
  Calendar,
  Sparkles,
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Info,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import WizardHeader from "@/components/shared/WizardHeader";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";

interface Brand {
  id: string;
  name: string;
}

interface DesignColour {
  id: string;
  colour_name: string;
  colour_hex: string | null;
  image_url: string | null;
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
}

export default function CreateLotPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Wizard current state
  const [currentStep, setCurrentStep] = useState(1);

  // Form Fields
  const [brandId, setBrandId] = useState("");
  const [designId, setDesignId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [lotDate, setLotDate] = useState(new Date().toISOString().substring(0, 10));
  const [colourId, setColourId] = useState("");
  const [season, setSeason] = useState("Summer 2024");
  const [buyerOrderRef, setBuyerOrderRef] = useState("");
  const [targetStartDate, setTargetStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [targetDispatchDate, setTargetDispatchDate] = useState("");
  const [targetDueDate, setTargetDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [productionType, setProductionType] = useState("regular");
  const [allowRework, setAllowRework] = useState(false);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [poDate, setPoDate] = useState("");

  // Size Set Quantities
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [selectedSizeSetId, setSelectedSizeSetId] = useState("");

  // Assigned Stages
  const [assignedStages, setAssignedStages] = useState<LotStageInput[]>([]);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch Brands
  const { data: brandsData } = useQuery<{ brands: Brand[] }>({
    queryKey: ["brands-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/brands");
      return res.json();
    },
  });

  // 2. Fetch Designs
  const { data: designsData } = useQuery<{ designs: Design[] }>({
    queryKey: ["designs-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/designs");
      return res.json();
    },
  });

  // 3. Fetch Master Production Stages
  const { data: masterStagesData } = useQuery<{ stages: ProductionStage[] }>({
    queryKey: ["master-stages-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-stages");
      return res.json();
    },
  });

  // 4. Fetch Size Sets (for templates)
  const { data: sizeSetsData } = useQuery<{ sizeSets: SizeSet[] }>({
    queryKey: ["size-sets-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/size-sets");
      return res.json();
    },
  });

  const designs = designsData?.designs || [];
  const brands = brandsData?.brands || [];
  const masterStages = masterStagesData?.stages || [];
  const sizeSets = sizeSetsData?.sizeSets || [];

  // Filter designs based on selected brand
  const filteredDesigns = brandId
    ? designs.filter((d) => d.brand_id === brandId)
    : designs;

  // Selected design info
  const selectedDesign = designs.find((d) => d.id === designId);

  // Auto-generate Lot Number on mount
  useEffect(() => {
    generateLotNumber();
  }, []);

  const generateLotNumber = async () => {
    try {
      const res = await fetch("/api/production/lots/code/next");
      if (res.ok) {
        const data = await res.json();
        setLotNumber(data.code);
      }
    } catch (err) {
      console.error("Failed to generate lot code:", err);
    }
  };

  // Sync size set when design changes
  useEffect(() => {
    if (selectedDesign) {
      const designSizeSet = selectedDesign.size_set;
      if (designSizeSet) {
        setAvailableSizes(designSizeSet.sizes || []);
        setSelectedSizeSetId(designSizeSet.id);
        const initQty: Record<string, number> = {};
        designSizeSet.sizes.forEach((s) => {
          initQty[s] = 0;
        });
        setSizeQuantities(initQty);
      }

      // Prepopulate Brand if design is selected first
      if (selectedDesign.brand_id && !brandId) {
        setBrandId(selectedDesign.brand_id);
      }

      // Reset color selection if design changes
      setColourId("");
    }
  }, [selectedDesign, brandId]);

  // Load stages when masterStages are fetched
  useEffect(() => {
    if (masterStages.length > 0 && assignedStages.length === 0) {
      const initial = masterStages.map((s, idx) => ({
        stage_id: s.id,
        stage_name: s.name,
        stage_type: s.type || "in_house",
        sequence_no: idx + 1,
        is_mandatory: true,
      }));
      setAssignedStages(initial);
    }
  }, [masterStages]);

  // Handle stage sequence change
  const moveStage = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === assignedStages.length - 1) return;

    const newStages = [...assignedStages];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = newStages[index];
    newStages[index] = newStages[targetIdx];
    newStages[targetIdx] = temp;

    // Recalculate sequence numbers
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

  // Add Custom Stage
  const handleAddStage = (stageId: string) => {
    const masterStage = masterStages.find((s) => s.id === stageId);
    if (!masterStage) return;

    // Prevent duplicate stages
    if (assignedStages.some((s) => s.stage_id === stageId)) {
      toast.error("Stage already assigned to this lot");
      return;
    }

    const newStage = {
      stage_id: masterStage.id,
      stage_name: masterStage.name,
      stage_type: masterStage.type || "in_house",
      sequence_no: assignedStages.length + 1,
      is_mandatory: true,
    };

    setAssignedStages([...assignedStages, newStage]);
    toast.success(`Added stage: ${masterStage.name}`);
  };

  // Remove Stage
  const handleRemoveStage = (index: number) => {
    const filtered = assignedStages.filter((_, i) => i !== index);
    const updated = filtered.map((s, i) => ({
      ...s,
      sequence_no: i + 1,
    }));
    setAssignedStages(updated);
  };

  // Load Size Template
  const handleLoadSizeTemplate = (templateId: string) => {
    const template = sizeSets.find((ss) => ss.id === templateId);
    if (!template) return;

    setAvailableSizes(template.sizes || []);
    setSelectedSizeSetId(template.id);
    const initQty: Record<string, number> = {};
    template.sizes.forEach((s) => {
      initQty[s] = sizeQuantities[s] || 0;
    });
    setSizeQuantities(initQty);
    toast.success(`Loaded size set template: ${template.name}`);
  };

  const handleAddCustomSize = (sizeName: string) => {
    if (!sizeName.trim()) return;
    const cleanSize = sizeName.trim().toUpperCase();
    if (availableSizes.includes(cleanSize)) {
      toast.error("Size already exists");
      return;
    }
    setAvailableSizes([...availableSizes, cleanSize]);
    setSizeQuantities({
      ...sizeQuantities,
      [cleanSize]: 0,
    });
  };

  // Quantities calculation
  const totalQuantity = Object.values(sizeQuantities).reduce((acc, curr) => acc + curr, 0);

  // Submit Lot
  const handleSubmitLot = async () => {
    if (!brandId || !designId || !lotNumber || !lotDate || totalQuantity <= 0) {
      toast.error("Please fill in all required fields and enter size quantities");
      return;
    }

    if (assignedStages.length === 0) {
      toast.error("Please assign at least one production stage");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        lot_number: lotNumber,
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
        production_type: productionType,
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

      const res = await fetch("/api/production/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create lot");

      toast.success("Production lot created successfully");
      router.push("/production/lots");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create production lot");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to determine step values for wizard header
  const getWizardStep = () => {
    if (brandId && designId && lotNumber && lotDate) {
      if (totalQuantity > 0) {
        if (assignedStages.length > 0) {
          return 5; // Ready to Review
        }
        return 4; // Stages Pending
      }
      return 3; // Sizes Pending
    }
    return 1; // Basic Details
  };

  const steps = [
    "Basic Details",
    "Lot Specifications",
    "Size Set & Quantity",
    "Assign Stages",
    "Review & Create",
  ];

  // Right summary panel items
  const summaryItems = [
    { label: "Lot No.", value: lotNumber || "—" },
    { label: "Brand", value: brands.find((b) => b.id === brandId)?.name || "—" },
    { label: "Design", value: selectedDesign ? `${selectedDesign.code} - ${selectedDesign.name}` : "—" },
    {
      label: "Colour",
      value: selectedDesign?.design_colours?.find((c) => c.id === colourId)?.colour_name || "—",
      colorHex: selectedDesign?.design_colours?.find((c) => c.id === colourId)?.colour_hex,
    },
    { label: "Size Set", value: availableSizes.join(", ") || "—" },
    { label: "Stages Assigned", value: `${assignedStages.length} Stages` },
    {
      label: "Total Quantity",
      value: `${totalQuantity.toLocaleString("en-IN")} Pcs`,
      isQuantity: true,
    },
    { label: "Target Dispatch", value: targetDispatchDate || "—" },
  ];

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Breadcrumb & Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Production
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <Link href="/production/lots" className="hover:text-[#6366F1] transition-colors">
          Production Lots
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Create Lot</span>
      </nav>

      {/* Page Title & Back */}
      <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/production/lots"
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#0F172A] hover:bg-[#F9FAFB] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Create Production Lot</h2>
            <p className="text-xs text-[#64748B]">Set up new production lot routing and specifications</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitLot}
          disabled={submitting || totalQuantity === 0}
          className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-semibold text-sm px-5 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
        >
          <CheckCircle size={16} />
          Create Lot
        </button>
      </div>

      {/* Wizard Step Indicator */}
      <WizardHeader currentStep={getWizardStep()} steps={steps} />

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Basic Information */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="h-4.5 w-4.5 text-[#6366F1]" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Brand <span className="text-red-500">*</span>
                </label>
                <select
                  value={brandId}
                  onChange={(e) => {
                    setBrandId(e.target.value);
                    setDesignId("");
                  }}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="">Select Brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Design <span className="text-red-500">*</span>
                </label>
                <select
                  value={designId}
                  onChange={(e) => setDesignId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  disabled={!brandId}
                >
                  <option value="">Select Design</option>
                  {filteredDesigns.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Lot No. <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={generateLotNumber}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#6366F1] cursor-pointer"
                    title="Regenerate Lot No."
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Lot Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={lotDate}
                  onChange={(e) => setLotDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Colour <span className="text-red-500">*</span>
                </label>
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
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Season / Collection
                </label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="Summer 2024">Summer 2024</option>
                  <option value="Winter 2024">Winter 2024</option>
                  <option value="Monsoon 2024">Monsoon 2024</option>
                  <option value="Spring 2025">Spring 2025</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Buyer / Order (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Order #ORD-24-1185"
                  value={buyerOrderRef}
                  onChange={(e) => setBuyerOrderRef(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Target Dispatch Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={targetDispatchDate}
                  onChange={(e) => setTargetDispatchDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Size Set & Quantity */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <Boxes className="h-4.5 w-4.5 text-[#1D4ED8]" />
                Size Set & Quantity
              </h3>
              <span className="text-sm font-bold text-[#6366F1]">
                Total Quantity: {totalQuantity.toLocaleString("en-IN")} Pcs
              </span>
            </div>

            {availableSizes.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#94A3B8]">
                Select a Design above, or load a size set template below to configure quantities.
              </div>
            ) : (
              <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase">
                      <th className="py-2.5 border-r border-[#E5E7EB]">Size</th>
                      {availableSizes.map((size) => (
                        <th key={size} className="py-2.5 border-r border-[#E5E7EB]">
                          {size}
                        </th>
                      ))}
                      <th className="py-2.5">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-sm">
                      <td className="py-2 px-3 border-r border-[#E5E7EB] font-bold text-[#374151] bg-[#F9FAFB]">
                        Qty (Pcs)
                      </td>
                      {availableSizes.map((size) => (
                        <td key={size} className="py-2 px-3 border-r border-[#E5E7EB]">
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
                            className="w-20 h-9 text-center border border-[#E5E7EB] rounded-lg text-sm focus:ring-1 focus:ring-[#6366F1]"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 font-black text-[#0F172A] bg-[#F9FAFB]">
                        {totalQuantity}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Template loader & custom size adder */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#F3F4F6]">
              <div className="flex items-center gap-3">
                {/* Template selector */}
                <select
                  onChange={(e) => {
                    if (e.target.value) handleLoadSizeTemplate(e.target.value);
                  }}
                  className="h-9 text-xs rounded-lg border border-[#E5E7EB] bg-white px-2.5 focus:ring-1 focus:ring-[#6366F1]"
                >
                  <option value="">Load Size Template</option>
                  {sizeSets.map((ss) => (
                    <option key={ss.id} value={ss.id}>
                      {ss.name} ({ss.sizes.join(", ")})
                    </option>
                  ))}
                </select>

                {/* Custom size input */}
                <input
                  type="text"
                  placeholder="+ Add Custom Size"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomSize(e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }}
                  className="h-9 w-36 text-xs rounded-lg border border-[#E5E7EB] bg-white px-2.5 focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sameColours"
                  className="h-4 w-4 rounded border-[#E5E7EB] text-[#6366F1] focus:ring-[#6366F1]"
                />
                <label htmlFor="sameColours" className="text-xs text-[#64748B] font-medium select-none">
                  Use same for all colours
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Assign Production Stages */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <GitBranch className="h-4.5 w-4.5 text-[#7C3AED]" />
                  Assign Production Stages
                </h3>
                <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                  Select and order the stages for this lot&apos;s production workflow
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EEF2FF] text-[#6366F1]">
                Total Stages: {assignedStages.length}
              </span>
            </div>

            {/* Stages workflow table */}
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase">
                    <th className="py-2.5 px-4 w-12 text-center">Order</th>
                    <th className="py-2.5 px-4">Stage Name</th>
                    <th className="py-2.5 px-4">Stage Type</th>
                    <th className="py-2.5 px-4 text-center">Required</th>
                    <th className="py-2.5 px-4 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-sm">
                  {assignedStages.map((stage, index) => (
                    <tr key={stage.stage_id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => moveStage(index, "up")}
                            disabled={index === 0}
                            className="p-0.5 text-[#94A3B8] hover:text-[#6366F1] disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <span className="font-mono text-xs font-bold">{stage.sequence_no}</span>
                          <button
                            type="button"
                            onClick={() => moveStage(index, "down")}
                            disabled={index === assignedStages.length - 1}
                            className="p-0.5 text-[#94A3B8] hover:text-[#6366F1] disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#374151]">
                        {stage.stage_name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            stage.stage_type === "job_work"
                              ? "bg-[#FEF3C7] text-[#D97706]"
                              : "bg-[#DBEAFE] text-[#1D4ED8]"
                          }`}
                        >
                          {stage.stage_type.replace("_", " ")}
                        </span>
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
                          className="p-1.5 rounded border border-[#E5E7EB] text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                          title="Remove Stage"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add stage row */}
            <div className="flex items-center gap-2 pt-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddStage(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="h-9 text-xs rounded-lg border border-[#E5E7EB] bg-white px-2.5 focus:ring-1 focus:ring-[#6366F1]"
              >
                <option value="">+ Add Production Stage</option>
                {masterStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="checkbox"
                  id="reworkCheck"
                  checked={allowRework}
                  onChange={(e) => setAllowRework(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E5E7EB] text-[#6366F1] focus:ring-[#6366F1]"
                />
                <label htmlFor="reworkCheck" className="text-xs text-[#64748B] font-semibold flex items-center gap-1 select-none">
                  Allow rework for this lot
                  <span title="Allow logging multiple rework cycles for stages">
                    <Info size={12} className="text-[#94A3B8]" />
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Card 4: Additional Details */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-[#16A34A]" />
              Additional Details & Custom Fields
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Production Type
                </label>
                <select
                  value={productionType}
                  onChange={(e) => setProductionType(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="regular">Regular Production</option>
                  <option value="sample">Sample Production</option>
                  <option value="rework">Rework Lot</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="normal">🟡 Normal Priority</option>
                  <option value="high">🔴 High Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Customer Ref. No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. CUST-PO-12948"
                  value={customerRef}
                  onChange={(e) => setCustomerRef(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Purchase Order Date (PO Date)
                </label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Remarks / Notes
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] resize-none"
                  placeholder="Enter notes about lot specifications..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                  Internal Notes (Not visible on reports)
                </label>
                <textarea
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] resize-none"
                  placeholder="Internal comments for managers..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Summaries & Timelines */}
        <div className="space-y-6">
          {/* 1. Lot Summary Right Panel */}
          <LotSummaryPanel
            title="Lot Live Summary"
            designImage={selectedDesign?.images?.[0]}
            items={summaryItems}
          />

          {/* 2. Estimated Timeline Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-[#EA580C]" />
              Estimated Timeline
            </h3>

            <div className="space-y-2.5 text-sm text-[#475569]">
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span>Start Date:</span>
                <span className="font-semibold text-[#0F172A]">{lotDate}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span>Est. Completion:</span>
                <span className="font-bold text-[#15803D]">
                  {targetDispatchDate || "Configure targets..."}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                <span>Priority:</span>
                <span className="font-semibold capitalize text-[#0F172A]">{priority}</span>
              </div>
            </div>

            {/* Est Progress Bar */}
            <div className="pt-2">
              <span className="text-xs text-[#64748B] font-semibold block mb-1">New Lot Initialization</span>
              <div className="h-2 rounded-full w-full bg-[#E5E7EB] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FCD34D] w-0" />
              </div>
            </div>
          </div>

          {/* 3. Next Steps Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-[#0F172A] border-b border-[#F3F4F6] pb-2">
              Setup Milestones
            </h4>

            <div className="space-y-3.5 text-xs font-semibold text-[#475569]">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0 text-[10px]">
                  ✓
                </span>
                <span className="text-green-700">Configure brands and designs</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] ${
                    totalQuantity > 0 ? "bg-[#DCFCE7] text-[#15803D] border-[#15803D]" : "border-gray-300 bg-white"
                  }`}
                >
                  {totalQuantity > 0 ? "✓" : "2"}
                </span>
                <span className={totalQuantity > 0 ? "text-green-700" : ""}>
                  Allocate quantities per size
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] ${
                    assignedStages.length > 0
                      ? "bg-[#DCFCE7] text-[#15803D] border-[#15803D]"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {assignedStages.length > 0 ? "✓" : "3"}
                </span>
                <span className={assignedStages.length > 0 ? "text-green-700" : ""}>
                  Assign stage workflow routing
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
