"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NumericInput } from "@/components/ui/numeric-input";
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
  FileText,
  UserCheck,
  Search,
  BookOpen,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import WizardHeader from "@/components/shared/WizardHeader";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";
import { ImageUpload } from "@/components/forms/ImageUpload";

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
  worker_ids: string[];
}

export default function CreateLotPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Wizard Step State
  const [currentStep, setCurrentStep] = useState(1);

  // ==========================================
  // STEP 1: ROLL ALLOCATION
  // ==========================================
  const [rollSearch, setRollSearch] = useState("");
  const [allocatedRolls, setAllocatedRolls] = useState<Array<{
    purchase_roll_id: string;
    roll_number: string;
    shade: string;
    material_name: string;
    supplier_name: string;
    remaining_meters: number;
    allocated_meters: number;
    rate: number;
  }>>([]);
  const [allocating, setAllocating] = useState(false);

  // Available Rolls Query
  const { data: availableRollsData, isLoading: loadingRolls } = useQuery<{ rolls: any[] }>({
    queryKey: ["available-rolls", rollSearch],
    queryFn: async () => {
      const res = await fetch(`/api/production/lots/available-rolls?search=${encodeURIComponent(rollSearch)}`);
      return res.json();
    },
    enabled: currentStep === 1,
  });
  const availableRolls = availableRollsData?.rolls || [];

  // ==========================================
  // STEP 2: BASIC DETAILS
  // ==========================================
  const [brandId, setBrandId] = useState("");
  const [designId, setDesignId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [lotDate, setLotDate] = useState(new Date().toISOString().substring(0, 10));
  const [lotName, setLotName] = useState("");
  const [garmentTypeId, setGarmentTypeId] = useState("");
  const [designType, setDesignType] = useState("");
  const [selectedColours, setSelectedColours] = useState<Array<{ id: string; colour_name: string; colour_hex: string | null }>>([]);
  const [season, setSeason] = useState("Summer " + new Date().getFullYear());
  const [buyerOrderRef, setBuyerOrderRef] = useState("");
  const [priority, setPriority] = useState("normal");
  const [productionType, setProductionType] = useState("regular");
  const [targetStartDate, setTargetStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [targetDispatchDate, setTargetDispatchDate] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [poDate, setPoDate] = useState("");

  // ==========================================
  // STEP 3: LOT SPECIFICATIONS
  // ==========================================
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [designReferenceText, setDesignReferenceText] = useState("");
  const [designReferencePhotos, setDesignReferencePhotos] = useState<string[]>([]);
  const [customQa, setCustomQa] = useState<Array<{ question: string; answer: string }>>([]);

  // ==========================================
  // STEP 4: SIZE SET & QUANTITIES
  // ==========================================
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, Record<string, number>>>({}); // colour_id -> size -> quantity
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [selectedSizeSetId, setSelectedSizeSetId] = useState("");
  const [useSameColours, setUseSameColours] = useState(true);
  const [averageMeter, setAverageMeter] = useState<number>(0);
  const [calculatingAvg, setCalculatingAvg] = useState(false);

  // ==========================================
  // STEP 5: ASSIGN STAGES
  // ==========================================
  const [assignedStages, setAssignedStages] = useState<LotStageInput[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // ==========================================
  // STEP 6: DESIGN SPEC SHEET
  // ==========================================
  const [specSheetTemplate, setSpecSheetTemplate] = useState<any | null>(null);
  const [specSheetValues, setSpecSheetValues] = useState<Record<string, string>>({});

  // Submitting final lot creation
  const [submitting, setSubmitting] = useState(false);

  // Inline Design Creation states
  const [designModalOpen, setDesignModalOpen] = useState(false);
  const [newDesignName, setNewDesignName] = useState("");
  const [newDesignCode, setNewDesignCode] = useState("");
  const [newDesignSizeSet, setNewDesignSizeSet] = useState("");
  const [newDesignColours, setNewDesignColours] = useState<Array<{ name: string; hex: string }>>([
    { name: "Default Colour", hex: "#6366F1" },
  ]);
  const [newDesignCategory, setNewDesignCategory] = useState("Shirts");
  const [newDesignSubCategory, setNewDesignSubCategory] = useState("");
  const [newDesignSeason, setNewDesignSeason] = useState("");
  const [newDesignHsnCode, setNewDesignHsnCode] = useState("");
  const [newDesignDescription, setNewDesignDescription] = useState("");
  const [newDesignImages, setNewDesignImages] = useState<string[]>([]);
  const [newDesignLoading, setNewDesignLoading] = useState(false);

  const handleOpenCreateDesignModal = () => {
    setNewDesignName("");
    setNewDesignCode("");
    setNewDesignSizeSet(sizeSetsData?.sizeSets?.[0]?.id || "");
    setNewDesignColours([{ name: "Default Colour", hex: "#6366F1" }]);
    setNewDesignCategory("Shirts");
    setNewDesignSubCategory("");
    setNewDesignSeason("");
    setNewDesignHsnCode("");
    setNewDesignDescription("");
    setNewDesignImages([]);
    setDesignModalOpen(true);
  };

  const handleAddColourToDraft = () => {
    setNewDesignColours((prev) => [...prev, { name: "", hex: "#6366F1" }]);
  };

  const handleRemoveColourFromDraft = (idx: number) => {
    setNewDesignColours((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateDraftColour = (idx: number, field: "name" | "hex", val: string) => {
    setNewDesignColours((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c))
    );
  };

  const handleSaveNewDesign = async () => {
    if (!newDesignName.trim()) {
      toast.error("Design Name is required.");
      return;
    }
    setNewDesignLoading(true);
    try {
      const res = await fetch("/api/master-data/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          name: newDesignName.trim(),
          design_number: newDesignCode.trim() || undefined,
          size_set_id: newDesignSizeSet || undefined,
          category: newDesignCategory || undefined,
          sub_category: newDesignSubCategory || undefined,
          season: newDesignSeason || undefined,
          hsn_code: newDesignHsnCode || undefined,
          description: newDesignDescription || undefined,
          images: newDesignImages,
          colours: newDesignColours
            .filter((c) => c.name.trim())
            .map((c) => ({
              colour_name: c.name.trim(),
              colour_hex: c.hex,
            })),
        }),
      });

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to create design");
      }

      const result = await res.json();
      toast.success("Design created successfully!");
      setDesignId(result.design.id);
      setDesignModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["designs-list"] });
    } catch (err: any) {
      toast.error(err.message || "Something went wrong creating design");
    } finally {
      setNewDesignLoading(false);
    }
  };

  // ==========================================
  // MASTER QUERIES
  // ==========================================
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

  const { data: sizeSetsData } = useQuery<{ sizeSets: SizeSet[] }>({
    queryKey: ["size-sets-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/size-sets");
      return res.json();
    },
  });

  const { data: garmentTypesData } = useQuery<{ garmentTypes: any[] }>({
    queryKey: ["garment-types-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/garment-types");
      return res.json();
    },
  });

  const { data: templatesData } = useQuery<{ templates: any[] }>({
    queryKey: ["production-templates-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-templates");
      return res.json();
    },
  });

  const { data: workersData } = useQuery<{ parties: any[] }>({
    queryKey: ["workers-list"],
    queryFn: async () => {
      const res = await fetch("/api/parties?type=worker");
      return res.json();
    },
  });

  const { data: settingsData } = useQuery<any>({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/general");
      const data = await res.json();
      return data.settings || {};
    },
  });

  const designs = designsData?.designs || [];
  const brands = brandsData?.brands || [];
  const masterStages = masterStagesData?.stages || [];
  const sizeSets = sizeSetsData?.sizeSets || [];
  const garmentTypes = garmentTypesData?.garmentTypes || [];
  const productionTemplates = templatesData?.templates || [];
  const workers = workersData?.parties || [];

  const filteredDesigns = brandId ? designs.filter((d) => d.brand_id === brandId) : designs;
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
        
        // Reset sizes quantities
        const initQty: Record<string, number> = {};
        designSizeSet.sizes.forEach((s) => {
          initQty[s] = 0;
        });
        setSizeQuantities({
          "all": initQty,
        });
      }

      if (selectedDesign.brand_id && !brandId) {
        setBrandId(selectedDesign.brand_id);
      }

      // Automatically sync design categories or custom options
      setSelectedColours([]);
    }
  }, [selectedDesign, brandId]);

  // Sync target dispatch date from business settings
  useEffect(() => {
    if (lotDate) {
      const days = settingsData?.default_production_target_days || 90;
      const targetDate = new Date(lotDate);
      targetDate.setDate(targetDate.getDate() + days);
      setTargetDispatchDate(targetDate.toISOString().substring(0, 10));
    }
  }, [lotDate, settingsData]);

  // Load spec template when garment type is selected
  useEffect(() => {
    const fetchSpecSheetTemplate = async () => {
      if (!garmentTypeId) {
        setSpecSheetTemplate(null);
        return;
      }
      try {
        const res = await fetch(`/api/master-data/design-spec-templates?garment_type_id=${garmentTypeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.templates && data.templates.length > 0) {
            setSpecSheetTemplate(data.templates[0]);
            const initial: Record<string, string> = {};
            data.templates[0].fields.forEach((f: any) => {
              initial[f.name] = "";
            });
            setSpecSheetValues(initial);
          } else {
            setSpecSheetTemplate(null);
          }
        }
      } catch (err) {
        console.error("Failed to load design spec template:", err);
      }
    };
    fetchSpecSheetTemplate();
  }, [garmentTypeId]);

  // Default stages from master stages if template is not chosen yet
  useEffect(() => {
    if (masterStages.length > 0 && assignedStages.length === 0) {
      const initial = masterStages.slice(0, 5).map((s, idx) => ({
        stage_id: s.id,
        stage_name: s.name,
        stage_type: s.type || "in_house",
        sequence_no: idx + 1,
        is_mandatory: true,
        worker_ids: [],
      }));
      setAssignedStages(initial);
    }
  }, [masterStages]);

  // ==========================================
  // WIZARD EVENT HANDLERS
  // ==========================================

  // Step 1 roll handlers
  const handleToggleRoll = (roll: any) => {
    const exists = allocatedRolls.some(r => r.purchase_roll_id === roll.id);
    if (exists) {
      setAllocatedRolls(allocatedRolls.filter(r => r.purchase_roll_id !== roll.id));
    } else {
      setAllocatedRolls([...allocatedRolls, {
        purchase_roll_id: roll.id,
        roll_number: roll.roll_number,
        shade: roll.shade || "—",
        material_name: roll.item?.material_type?.name || "Fabric",
        supplier_name: roll.item?.purchase?.supplier?.name || "—",
        remaining_meters: Number(roll.remaining_meters),
        allocated_meters: Number(roll.remaining_meters),
        rate: Number(roll.item?.rate || 0),
      }]);
    }
  };

  const handleRollAllocationChange = (rollId: string, meters: number) => {
    setAllocatedRolls(allocatedRolls.map(r => {
      if (r.purchase_roll_id === rollId) {
        return {
          ...r,
          allocated_meters: Math.min(r.remaining_meters, Math.max(0, meters)),
        };
      }
      return r;
    }));
  };

  // Step 2 colour handlers
  const handleAddColour = (colourId: string) => {
    if (!colourId) return;
    const col = selectedDesign?.design_colours?.find(c => c.id === colourId);
    if (col && !selectedColours.some(c => c.id === colourId)) {
      setSelectedColours([...selectedColours, {
        id: col.id,
        colour_name: col.colour_name,
        colour_hex: col.colour_hex,
      }]);
      
      // Initialize size grid for this colour if not same colors
      if (!useSameColours) {
        const initQty: Record<string, number> = {};
        availableSizes.forEach(s => {
          initQty[s] = 0;
        });
        setSizeQuantities(prev => ({
          ...prev,
          [col.id]: initQty
        }));
      }
    }
  };

  const handleRemoveColour = (colourId: string) => {
    setSelectedColours(selectedColours.filter(c => c.id !== colourId));
    if (!useSameColours) {
      const copy = { ...sizeQuantities };
      delete copy[colourId];
      setSizeQuantities(copy);
    }
  };

  // Step 4 Avg meter calculation
  const fetchHistoricalAvg = async () => {
    if (!garmentTypeId || !selectedSizeSetId) {
      toast.error("Please ensure Garment Type and Design are selected");
      return;
    }
    setCalculatingAvg(true);
    try {
      const res = await fetch(`/api/production/lots/historical-avg-meters?garment_type_id=${garmentTypeId}&size_set_id=${selectedSizeSetId}`);
      if (res.ok) {
        const data = await res.json();
        setAverageMeter(data.avg_meters || 0);
        toast.success(`Loaded historical average: ${data.avg_meters} meters / pc`);
      }
    } catch (err) {
      toast.error("Failed to load historical average meters");
    } finally {
      setCalculatingAvg(false);
    }
  };

  const totalAllocatedMeters = allocatedRolls.reduce((acc, curr) => acc + curr.allocated_meters, 0);

  const suggestedPieces = averageMeter > 0 ? Math.floor(totalAllocatedMeters / averageMeter) : 0;

  const handlePrefillSizeQuantities = () => {
    if (suggestedPieces <= 0) {
      toast.error("Please configure roll allocation and non-zero average meter consumption");
      return;
    }
    if (availableSizes.length === 0) {
      toast.error("No size set config available");
      return;
    }

    const share = Math.floor(suggestedPieces / (availableSizes.length || 1));
    const initQty: Record<string, number> = {};
    availableSizes.forEach((s, idx) => {
      // Put remainder in the first size
      initQty[s] = idx === 0 ? share + (suggestedPieces % availableSizes.length) : share;
    });

    if (useSameColours) {
      setSizeQuantities({
        "all": initQty,
      });
    } else {
      const nextSizes: Record<string, Record<string, number>> = {};
      selectedColours.forEach((c) => {
        nextSizes[c.id] = { ...initQty };
      });
      setSizeQuantities(nextSizes);
    }
    toast.success("Distributed suggested piece count across size categories");
  };

  // Step 5 Stage worker handlers
  const handleAddWorkerToStage = (idx: number, workerId: string) => {
    if (!workerId) return;
    const currentList = assignedStages[idx].worker_ids || [];
    if (!currentList.includes(workerId)) {
      const copy = [...assignedStages];
      copy[idx].worker_ids = [...currentList, workerId];
      setAssignedStages(copy);
    }
  };

  const handleRemoveWorkerFromStage = (idx: number, workerId: string) => {
    const copy = [...assignedStages];
    copy[idx].worker_ids = (copy[idx].worker_ids || []).filter(w => w !== workerId);
    setAssignedStages(copy);
  };

  const handleLoadTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    try {
      const res = await fetch(`/api/master-data/production-templates/${templateId}`);
      if (!res.ok) throw new Error("Failed to load production template");
      const data = await res.json();
      
      const tempStages = (data.template?.stages || []).map((s: any, idx: number) => ({
        stage_id: s.stage_id,
        stage_name: s.stage_name || s.name,
        stage_type: s.stage_type || s.type || "in_house",
        sequence_no: idx + 1,
        is_mandatory: s.is_mandatory !== false,
        worker_ids: [],
      }));
      setAssignedStages(tempStages);
      toast.success("Loaded template stages successfully");
    } catch (err: any) {
      toast.error(err.message || "Error loading template");
    }
  };

  // Next steps validations
  const handleStep1Next = () => {
    if (allocatedRolls.length === 0) {
      toast.error("Please allocate at least one roll to proceed");
      return;
    }
    const invalid = allocatedRolls.some(r => r.allocated_meters <= 0 || r.allocated_meters > r.remaining_meters);
    if (invalid) {
      toast.error("Please ensure all allocations are positive and do not exceed remaining meters");
      return;
    }
    // Proceed directly without deducting meters from database early
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (!brandId || !designId || !lotNumber || !lotDate || !garmentTypeId || selectedColours.length === 0) {
      toast.error("Please ensure all required fields are filled and at least one colour is chosen");
      return;
    }
    setCurrentStep(3);
  };

  const handleStep3Next = () => {
    setCurrentStep(4);
  };

  const handleStep4Next = () => {
    if (totalQuantity <= 0) {
      toast.error("Please specify size quantities to proceed");
      return;
    }
    setCurrentStep(5);
  };

  const handleStep5Next = () => {
    if (assignedStages.length === 0) {
      toast.error("Please assign at least one stage to the workflow");
      return;
    }
    setCurrentStep(6);
  };

  const handleStep6Next = () => {
    setCurrentStep(7);
  };

  // Submit final lot payload
  const handleSubmitLot = async () => {
    setSubmitting(true);
    try {
      // Map sizes grid for backend insert
      const sizesToSave: any[] = [];
      if (useSameColours) {
        const singleGrid = sizeQuantities["all"] || {};
        selectedColours.forEach((colour) => {
          Object.entries(singleGrid).forEach(([size, qty]) => {
            sizesToSave.push({
              size,
              quantity: qty,
              colour_id: colour.id,
            });
          });
        });
      } else {
        selectedColours.forEach((colour) => {
          const grid = sizeQuantities[colour.id] || {};
          Object.entries(grid).forEach(([size, qty]) => {
            sizesToSave.push({
              size,
              quantity: qty,
              colour_id: colour.id,
            });
          });
        });
      }

      const payload = {
        lot_number: lotNumber,
        brand_id: brandId,
        design_id: designId,
        colour_id: selectedColours[0]?.id || null, // Primary colour
        size_set_id: selectedSizeSetId || null,
        lot_date: lotDate,
        season,
        buyer_order_ref: buyerOrderRef || null,
        target_start_date: targetStartDate || null,
        target_dispatch_date: targetDispatchDate || null,
        target_due_date: targetDispatchDate || null,
        priority,
        production_type: productionType,
        allow_rework: false,
        notes,
        internal_notes: internalNotes || null,
        customer_ref: customerRef || null,
        po_date: poDate || null,
        total_quantity: totalQuantity,
        garment_type_id: garmentTypeId,
        design_type: designType || null,
        lot_name: lotName || null,
        allocated_rolls: allocatedRolls.map(r => ({
          purchase_roll_id: r.purchase_roll_id,
          allocated_meters: r.allocated_meters,
        })),
        specifications: {
          additional_details: additionalDetails,
          design_reference_text: designReferenceText,
          design_reference_photos: designReferencePhotos,
          custom_qa: customQa,
        },
        spec_sheet: specSheetTemplate ? {
          template_id: specSheetTemplate.id,
          spec_values: specSheetValues,
        } : null,
        sizes: sizesToSave,
        stages: assignedStages,
      };

      const res = await fetch("/api/production/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create production lot");

      await queryClient.invalidateQueries({ queryKey: ["lots-list"] });
      toast.success("Production lot created successfully!");
      router.push("/production/lots");
    } catch (err: any) {
      toast.error(err.message || "Failed to create lot");
    } finally {
      setSubmitting(false);
    }
  };

  // Quantity calculations
  const getSubtotalQty = () => {
    if (useSameColours) {
      const singleGrid = sizeQuantities["all"] || {};
      const sum = Object.values(singleGrid).reduce((acc, curr) => acc + curr, 0);
      return sum * (selectedColours.length || 1);
    } else {
      let sum = 0;
      selectedColours.forEach((colour) => {
        const grid = sizeQuantities[colour.id] || {};
        sum += Object.values(grid).reduce((acc, curr) => acc + curr, 0);
      });
      return sum;
    }
  };
  const totalQuantity = getSubtotalQty();

  const steps = [
    "Roll Allocation",
    "Basic Details",
    "Lot Specifications",
    "Size Set & Quantity",
    "Assign Stages",
    "Design Spec Sheet",
    "Review & Create",
  ];

  // Right summary panel items
  const summaryItems = [
    { label: "Lot No.", value: lotNumber || "—" },
    { label: "Brand", value: brands.find((b) => b.id === brandId)?.name || "—" },
    { label: "Design", value: selectedDesign ? `${selectedDesign.code} - ${selectedDesign.name}` : "—" },
    { label: "Allocated Fabric", value: `${totalAllocatedMeters.toFixed(1)} Meters` },
    { label: "Colours Selected", value: selectedColours.map(c => c.colour_name).join(", ") || "—" },
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
        <span className="text-[#374151]">Create Lot</span>
      </nav>

      {/* Header */}
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
      </div>

      {/* Wizard Header */}
      <WizardHeader currentStep={currentStep} steps={steps} />

      {/* Content Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Forms Section */}
        <div className="lg:col-span-2 space-y-6">

          {/* ========================================================
              STEP 1: ROLL ALLOCATION
              ======================================================== */}
          {currentStep === 1 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="h-4.5 w-4.5 text-[#6366F1]" />
                Step 1: Roll Allocation
              </h3>

              <div className="space-y-4">
                {/* Search field */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search purchase rolls by Supplier, Roll number, Fabric, Shade..."
                    value={rollSearch}
                    onChange={(e) => setRollSearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>

                {/* Available search results */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Available Fabric Rolls</h4>
                  {loadingRolls ? (
                    <div className="py-6 text-center text-xs text-slate-400">Loading rolls...</div>
                  ) : availableRolls.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">No active rolls found matching query.</div>
                  ) : (
                    <div className="border border-slate-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {availableRolls.map((roll) => {
                        const isAllocated = allocatedRolls.some(r => r.purchase_roll_id === roll.id);
                        return (
                          <div key={roll.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                            <div>
                              <span className="font-bold text-slate-800 block">Roll #{roll.roll_number} ({roll.item?.material_type?.name})</span>
                              <span className="text-[10px] text-slate-500">Supplier: {roll.item?.purchase?.supplier?.company_name || roll.item?.purchase?.supplier?.name} • Shade: {roll.shade || "—"}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-slate-700">{roll.remaining_meters} Mtr remaining</span>
                              <button
                                type="button"
                                onClick={() => handleToggleRoll(roll)}
                                className={`px-2.5 py-1 rounded font-bold transition-all text-[10px] uppercase cursor-pointer ${
                                  isAllocated
                                    ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
                                    : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100"
                                }`}
                              >
                                {isAllocated ? "Deallocate" : "Allocate"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Allocated list */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Allocated Fabric Consumption</h4>
                  {allocatedRolls.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                      No rolls allocated yet. Please search and allocate fabric rolls above.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase text-[10px]">
                            <th className="p-2.5">Roll details</th>
                            <th className="p-2.5">Supplier</th>
                            <th className="p-2.5 text-center">Remaining</th>
                            <th className="p-2.5 text-center w-24">Allocated (Mtr)</th>
                            <th className="p-2.5 text-right">Value (INR)</th>
                            <th className="p-2.5 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allocatedRolls.map((roll) => (
                            <tr key={roll.purchase_roll_id}>
                              <td className="p-2.5 font-semibold text-slate-700">
                                Roll #{roll.roll_number} ({roll.shade})
                              </td>
                              <td className="p-2.5 text-slate-500">{roll.supplier_name}</td>
                              <td className="p-2.5 text-center font-mono">{roll.remaining_meters} Mtr</td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={roll.allocated_meters}
                                  onChange={(e) => handleRollAllocationChange(roll.purchase_roll_id, parseFloat(e.target.value) || 0)}
                                  className="w-20 h-8 text-center border border-slate-200 rounded text-xs"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono font-semibold">
                                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(roll.allocated_meters * roll.rate)}
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setAllocatedRolls(allocatedRolls.filter(r => r.purchase_roll_id !== roll.purchase_roll_id))}
                                  className="text-red-500 hover:text-red-700 font-bold text-[10px]"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleStep1Next}
                  disabled={allocating || allocatedRolls.length === 0}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {allocating ? "Processing Allocations..." : "Next: Basic Details"}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 2: BASIC DETAILS
              ======================================================== */}
          {currentStep === 2 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="h-4.5 w-4.5 text-[#6366F1]" />
                Step 2: Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
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
                  <div className="flex items-center justify-between mb-1.5 select-none">
                    <label className="block text-xs font-bold text-[#374151] uppercase">
                      Design <span className="text-red-500">*</span>
                    </label>
                    {brandId && (
                      <button
                        type="button"
                        onClick={handleOpenCreateDesignModal}
                        className="text-xs font-bold text-[#6366F1] hover:text-[#4F46E5] hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0"
                      >
                        <Plus size={11} /> Add New Design
                      </button>
                    )}
                  </div>
                  <select
                    value={designId}
                    onChange={(e) => setDesignId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
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
                    Lot Name <span className="text-[#64748B]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={lotName}
                    onChange={(e) => setLotName(e.target.value)}
                    placeholder="e.g. Slim-fit Summer Chinos"
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
                  />
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
                      className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-10 text-sm focus:ring-2 focus:ring-[#6366F1] font-mono font-bold"
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
                    Garment Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={garmentTypeId}
                    onChange={(e) => setGarmentTypeId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
                  >
                    <option value="">Select Garment Type</option>
                    {garmentTypes.map((gt) => (
                      <option key={gt.id} value={gt.id}>
                        {gt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    Design Type / Fit-Style
                  </label>
                  <input
                    type="text"
                    value={designType}
                    onChange={(e) => setDesignType(e.target.value)}
                    placeholder="e.g. Regular Fit, Slim Fit"
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    Lot Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={lotDate}
                    onChange={(e) => setLotDate(e.target.value)}
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
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
                    className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>

                {/* Colours multi-select list */}
                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    Select Colours <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      onChange={(e) => {
                        handleAddColour(e.target.value);
                        e.target.value = "";
                      }}
                      className="h-10 text-xs rounded-lg border border-[#E5E7EB] bg-white px-3 focus:ring-2 focus:ring-[#6366F1]"
                      disabled={!designId}
                    >
                      <option value="">+ Add Colour</option>
                      {selectedDesign?.design_colours?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.colour_name}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap items-center gap-2">
                      {selectedColours.map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-indigo-100 bg-indigo-50/50 text-indigo-700 text-xs font-bold">
                          {c.colour_hex && (
                            <span className="w-3 h-3 rounded-full border border-white" style={{ backgroundColor: c.colour_hex }} />
                          )}
                          {c.colour_name}
                          <button type="button" onClick={() => handleRemoveColour(c.id)} className="text-indigo-400 hover:text-indigo-600 font-bold ml-1">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep2Next}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  Next: Specifications
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 3: LOT SPECIFICATIONS
              ======================================================== */}
          {currentStep === 3 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5 text-[#6366F1]" />
                Step 3: Lot Specifications
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    Additional Details
                  </label>
                  <textarea
                    rows={3}
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm focus:ring-2 focus:ring-[#6366F1] resize-none"
                    placeholder="Enter basic notes about lot design specs..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#374151] mb-1.5 uppercase">
                    Design Reference Text
                  </label>
                  <textarea
                    rows={3}
                    value={designReferenceText}
                    onChange={(e) => setDesignReferenceText(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm focus:ring-2 focus:ring-[#6366F1] resize-none"
                    placeholder="Reference specs, size tolerances, seam detail notes..."
                  />
                </div>

                {/* Photo Upload array */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#374151] uppercase">
                    Design Reference Photos
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    {designReferencePhotos.map((photo, idx) => (
                      <ImageUpload
                        key={idx}
                        folder="lots"
                        value={photo}
                        onChange={(url) => {
                          const copy = [...designReferencePhotos];
                          copy[idx] = url;
                          setDesignReferencePhotos(copy);
                        }}
                        onRemove={() => {
                          setDesignReferencePhotos(designReferencePhotos.filter((_, i) => i !== idx));
                        }}
                      />
                    ))}
                    {designReferencePhotos.length < 5 && (
                      <ImageUpload
                        folder="lots"
                        value=""
                        onChange={(url) => {
                          setDesignReferencePhotos([...designReferencePhotos, url]);
                        }}
                        label="+ Add Photo"
                      />
                    )}
                  </div>
                </div>

                {/* Custom Q&A list */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#374151] uppercase">
                      Custom Q&A Checklist
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomQa([...customQa, { question: "", answer: "" }])}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} /> Add Q&A Pair
                    </button>
                  </div>

                  {customQa.length === 0 ? (
                    <p className="text-xs text-slate-400">No QA points specified yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {customQa.map((qa, idx) => (
                        <div key={idx} className="flex gap-3 items-center bg-slate-50/50 border border-slate-100 p-3 rounded-lg">
                          <input
                            type="text"
                            placeholder="Question (e.g. Wash Test Done?)"
                            value={qa.question}
                            onChange={(e) => {
                              const copy = [...customQa];
                              copy[idx].question = e.target.value;
                              setCustomQa(copy);
                            }}
                            className="flex-1 h-9 rounded border border-slate-200 px-3 text-xs bg-white"
                          />
                          <input
                            type="text"
                            placeholder="Answer (e.g. Yes - Grade A)"
                            value={qa.answer}
                            onChange={(e) => {
                              const copy = [...customQa];
                              copy[idx].answer = e.target.value;
                              setCustomQa(copy);
                            }}
                            className="flex-1 h-9 rounded border border-slate-200 px-3 text-xs bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setCustomQa(customQa.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep3Next}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  Next: Size Set & Quantity
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 4: SIZE SET & QUANTITY
              ======================================================== */}
          {currentStep === 4 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="h-4.5 w-4.5 text-[#6366F1]" />
                  Step 4: Size Set & Quantities
                </h3>
              </div>

              <div className="space-y-4">
                {/* Average meter calculator */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                    <Info size={14} className="text-indigo-600" />
                    Auto-estimate Size Quantities from Allocated fabric
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    You have allocated **{totalAllocatedMeters.toFixed(2)} meters** of fabric. Enter the average fabric requirement per piece to calculate suggested quantity.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-xs">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Average Meter / Pc</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={averageMeter || ""}
                        onChange={(e) => setAverageMeter(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 1.6"
                        className="w-full h-9 rounded-lg border border-slate-200 px-3 text-xs"
                      />
                    </div>
                    <div className="flex items-end gap-2 h-16 pt-5">
                      <button
                        type="button"
                        onClick={fetchHistoricalAvg}
                        disabled={calculatingAvg}
                        className="h-9 px-3 border border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {calculatingAvg ? "Loading..." : "Suggest from History"}
                      </button>
                      <button
                        type="button"
                        onClick={handlePrefillSizeQuantities}
                        disabled={suggestedPieces <= 0}
                        className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        Prefill Distribute ({suggestedPieces} Pcs)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Same colours toggle */}
                <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Multi-Colour Sizing Config</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useSameColours"
                      checked={useSameColours}
                      onChange={(e) => {
                        setUseSameColours(e.target.checked);
                        // Reset size quantities when toggling
                        setSizeQuantities({});
                      }}
                      className="h-4.5 w-4.5 rounded border-[#E5E7EB] text-[#6366F1]"
                    />
                    <label htmlFor="useSameColours" className="text-xs text-[#64748B] font-semibold select-none cursor-pointer">
                      Use same size quantities for all colours
                    </label>
                  </div>
                </div>

                {/* Sizing grids */}
                {availableSizes.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">Please select design size set template.</div>
                ) : useSameColours ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <h5 className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 uppercase tracking-wide">
                      Standard Size Quantities (Applies to all selected colours)
                    </h5>
                    <table className="w-full text-center border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                          <th className="py-2.5 border-r border-slate-200">Size</th>
                          {availableSizes.map((size) => (
                            <th key={size} className="py-2.5 border-r border-slate-200">
                              {size}
                            </th>
                          ))}
                          <th className="py-2.5">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="text-xs">
                          <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                            Qty (Pcs)
                          </td>
                          {availableSizes.map((size) => (
                            <td key={size} className="py-2.5 px-3 border-r border-slate-200">
                              <NumericInput
                                min="0"
                                value={sizeQuantities["all"]?.[size] || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  const copy = { ...(sizeQuantities["all"] || {}) };
                                  copy[size] = val;
                                  setSizeQuantities({
                                    ...sizeQuantities,
                                    "all": copy,
                                  });
                                }}
                                className="w-16 h-8 text-center border border-slate-200 rounded focus:ring-1 focus:ring-[#6366F1]"
                              />
                            </td>
                          ))}
                          <td className="py-2.5 px-3 font-bold text-slate-800 bg-slate-50/50">
                            {Object.values(sizeQuantities["all"] || {}).reduce((a, b) => a + b, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedColours.map((colour) => (
                      <div key={colour.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <h5 className="bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 uppercase tracking-wide flex items-center gap-2">
                          {colour.colour_hex && (
                            <span className="w-3.5 h-3.5 rounded-full border border-white" style={{ backgroundColor: colour.colour_hex }} />
                          )}
                          Colour: {colour.colour_name}
                        </h5>
                        <table className="w-full text-center border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                              <th className="py-2.5 border-r border-slate-200">Size</th>
                              {availableSizes.map((size) => (
                                <th key={size} className="py-2.5 border-r border-slate-200">
                                  {size}
                                </th>
                              ))}
                              <th className="py-2.5">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="text-xs">
                              <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                                Qty (Pcs)
                              </td>
                              {availableSizes.map((size) => (
                                <td key={size} className="py-2.5 px-3 border-r border-slate-200">
                                  <NumericInput
                                    min="0"
                                    value={sizeQuantities[colour.id]?.[size] || 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10) || 0;
                                      const copyGrid = { ...(sizeQuantities[colour.id] || {}) };
                                      copyGrid[size] = val;
                                      setSizeQuantities({
                                        ...sizeQuantities,
                                        [colour.id]: copyGrid,
                                      });
                                    }}
                                    className="w-16 h-8 text-center border border-slate-200 rounded focus:ring-1 focus:ring-[#6366F1]"
                                  />
                                </td>
                              ))}
                              <td className="py-2.5 px-3 font-bold text-slate-800 bg-slate-50/50">
                                {Object.values(sizeQuantities[colour.id] || {}).reduce((a, b) => a + b, 0)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep4Next}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  Next: Assign Stages
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 5: ASSIGN STAGES
              ======================================================== */}
          {currentStep === 5 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <GitBranch className="h-4.5 w-4.5 text-[#6366F1]" />
                  Step 5: Assign Production Stages
                </h3>
              </div>

              <div className="space-y-4">
                {/* Template selector */}
                <div className="flex items-center gap-3">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleLoadTemplate(e.target.value)}
                    className="h-9 text-xs rounded-lg border border-[#E5E7EB] bg-white px-2.5 focus:ring-1 focus:ring-[#6366F1]"
                  >
                    <option value="">Load Production Template</option>
                    {productionTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.stages?.length || 0} Stages)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stages table */}
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase">
                        <th className="py-2.5 px-4 w-12 text-center">Order</th>
                        <th className="py-2.5 px-4">Stage Name</th>
                        <th className="py-2.5 px-4">Stage Type</th>
                        <th className="py-2.5 px-4 min-w-[280px]">Assigned Workers (Specialists)</th>
                        <th className="py-2.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-xs">
                      {assignedStages.map((stage, index) => {
                        // Filter workers that specialize in this stage
                        const specialists = workers.filter(w => 
                          (w.stage_specialty && Array.isArray(w.stage_specialty) && 
                          (w.stage_specialty.includes(stage.stage_id) || w.stage_specialty.includes(stage.stage_name)))
                        );

                        return (
                          <tr key={stage.stage_id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (index === 0) return;
                                    const copy = [...assignedStages];
                                    const temp = copy[index];
                                    copy[index] = copy[index - 1];
                                    copy[index - 1] = temp;
                                    setAssignedStages(copy.map((s, i) => ({ ...s, sequence_no: i + 1 })));
                                  }}
                                  disabled={index === 0}
                                  className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                                >
                                  <ChevronUp size={12} />
                                </button>
                                <span className="font-mono text-xs font-bold">{index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (index === assignedStages.length - 1) return;
                                    const copy = [...assignedStages];
                                    const temp = copy[index];
                                    copy[index] = copy[index + 1];
                                    copy[index + 1] = temp;
                                    setAssignedStages(copy.map((s, i) => ({ ...s, sequence_no: i + 1 })));
                                  }}
                                  disabled={index === assignedStages.length - 1}
                                  className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 cursor-pointer"
                                >
                                  <ChevronDown size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-[#374151]">
                              {stage.stage_name}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  stage.stage_type === "job_work"
                                    ? "bg-[#FEF3C7] text-[#D97706]"
                                    : "bg-[#DBEAFE] text-[#1D4ED8]"
                                }`}
                              >
                                {stage.stage_type.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 space-y-2 min-w-[280px]">
                              {/* Worker multi-selection dropdown */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <select
                                  onChange={(e) => {
                                    handleAddWorkerToStage(index, e.target.value);
                                    e.target.value = "";
                                  }}
                                  className="h-8 text-[11px] rounded border border-slate-200 bg-white px-2 focus:ring-1 focus:ring-[#6366F1] w-40 min-w-[130px] shrink-0"
                                >
                                  <option value="">+ Assign Worker</option>
                                  {specialists.map((w) => (
                                    <option key={w.id} value={w.id}>
                                      {w.name}
                                    </option>
                                  ))}
                                  {/* Fallback to show all workers if no specialists match */}
                                  {specialists.length === 0 && workers.map((w) => (
                                    <option key={w.id} value={w.id}>
                                      {w.name} (General)
                                    </option>
                                  ))}
                                </select>

                                {/* Badges of assigned workers */}
                                {(stage.worker_ids || []).map((workerId) => {
                                  const name = workers.find(w => w.id === workerId)?.name || "Worker";
                                  return (
                                    <span key={workerId} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-800 text-[10px] font-semibold border border-slate-200">
                                      {name}
                                      <button type="button" onClick={() => handleRemoveWorkerFromStage(index, workerId)} className="text-slate-400 hover:text-red-500 font-bold font-mono">×</button>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setAssignedStages(assignedStages.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequence_no: i + 1 })))}
                                className="p-1 rounded border border-[#E5E7EB] text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                title="Remove Stage"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Custom Stage row */}
                <div className="flex items-center gap-2 pt-2">
                  <select
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const master = masterStages.find(s => s.id === e.target.value);
                      if (master) {
                        setAssignedStages([...assignedStages, {
                          stage_id: master.id,
                          stage_name: master.name,
                          stage_type: master.type || "in_house",
                          sequence_no: assignedStages.length + 1,
                          is_mandatory: true,
                          worker_ids: [],
                        }]);
                      }
                      e.target.value = "";
                    }}
                    className="h-9 text-xs rounded-lg border border-[#E5E7EB] bg-white px-2.5 focus:ring-1 focus:ring-[#6366F1]"
                  >
                    <option value="">+ Add Custom Stage</option>
                    {masterStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep5Next}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  Next: Design Spec Sheet
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 6: DESIGN SPEC SHEET
              ======================================================== */}
          {currentStep === 6 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-[#6366F1]" />
                Step 6: Design Spec Sheet
              </h3>

              {!specSheetTemplate ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-sm text-slate-500 font-medium">No design specification template exists for the selected garment type.</p>
                  <p className="text-xs text-slate-400">You can safely skip this step and proceed to final review.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Garment Parameters ({specSheetTemplate.garment_types?.name})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {specSheetTemplate.fields.map((field: any) => (
                      <div key={field.name} className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase">{field.name}</label>
                        {field.type === "select" ? (
                          <select
                            value={specSheetValues[field.name] || ""}
                            onChange={(e) => setSpecSheetValues({ ...specSheetValues, [field.name]: e.target.value })}
                            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
                          >
                            <option value="">Select Option</option>
                            {(field.options || []).map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === "number" ? "number" : "text"}
                            value={specSheetValues[field.name] || ""}
                            onChange={(e) => setSpecSheetValues({ ...specSheetValues, [field.name]: e.target.value })}
                            placeholder={`Enter ${field.name}`}
                            className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:ring-2 focus:ring-[#6366F1]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStep6Next}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  Next: Review & Create
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 7: REVIEW & CREATE
              ======================================================== */}
          {currentStep === 7 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-[#16A34A]" />
                    <span>Review & Finalize Production Lot</span>
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Please double-check all lot configuration before sending to production routing.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column: Basic Details & Fabric & Specs */}
                <div className="space-y-6">
                  {/* Basic Details Summary */}
                  <div className="border border-slate-100 rounded-xl bg-slate-50/30 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800">
                        <FileText size={16} className="text-[#6366F1]" />
                        <h4 className="font-bold uppercase text-[11px] tracking-wider">Lot General Details</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="text-[11px] font-bold text-[#6366F1] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2.5 py-1 rounded-lg transition-all"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Lot No.</span>
                        <span className="font-bold text-[#0F172A] font-mono">{lotNumber}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Brand</span>
                        <span className="font-semibold text-slate-700">{brandsData?.brands?.find((b) => b.id === brandId)?.name || "—"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Lot Name</span>
                        <span className="font-semibold text-slate-700">{lotName || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Garment Type</span>
                        <span className="font-semibold text-slate-700">{garmentTypes.find(gt => gt.id === garmentTypeId)?.name || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Design Type</span>
                        <span className="font-semibold text-slate-700">{designType || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Lot Date</span>
                        <span className="font-semibold text-slate-700">{lotDate}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Dispatch Target</span>
                        <span className="font-semibold text-slate-700">{targetDispatchDate}</span>
                      </div>
                      <div className="col-span-2 border-t border-slate-100 pt-3">
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-1.5">Colours Selected</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedColours.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-indigo-100 bg-indigo-50/50 text-indigo-700 font-bold text-[10px]">
                              {c.colour_hex && (
                                <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ backgroundColor: c.colour_hex }} />
                              )}
                              {c.colour_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fabric Allocation Summary */}
                  <div className="border border-slate-100 rounded-xl bg-slate-50/30 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800">
                        <Boxes size={16} className="text-[#6366F1]" />
                        <h4 className="font-bold uppercase text-[11px] tracking-wider">Fabric & Roll Allocation</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="text-[11px] font-bold text-[#6366F1] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2.5 py-1 rounded-lg transition-all"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between bg-indigo-50/50 border border-indigo-100 rounded-xl p-3">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-indigo-500 tracking-wider mb-0.5">Total Fabric Allocated</span>
                          <span className="text-sm font-black text-indigo-700">{totalAllocatedMeters.toFixed(2)} Meters</span>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 bg-white border border-indigo-100 rounded-lg px-2 py-1">
                          {allocatedRolls.length} Rolls
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-1">Allocated Roll Numbers</span>
                        <div className="flex flex-wrap gap-1.5">
                          {allocatedRolls.map((r) => (
                            <span key={r.purchase_roll_id} className="px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold font-mono">
                              Roll #{r.roll_number} ({r.allocated_meters}m)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Specifications Summary */}
                  <div className="border border-slate-100 rounded-xl bg-slate-50/30 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800">
                        <Settings size={16} className="text-[#6366F1]" />
                        <h4 className="font-bold uppercase text-[11px] tracking-wider">Lot Specifications</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="text-[11px] font-bold text-[#6366F1] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2.5 py-1 rounded-lg transition-all"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 text-xs space-y-3.5">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Design Reference Info</span>
                        <span className="font-medium text-slate-700 leading-relaxed block bg-slate-50 border border-slate-100 p-2 rounded-lg">{designReferenceText || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">Additional Details</span>
                        <span className="font-medium text-slate-700 leading-relaxed block bg-slate-50 border border-slate-100 p-2 rounded-lg">{additionalDetails || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-1">Custom QA checklist</span>
                        <span className="font-bold text-slate-600 bg-slate-100 rounded px-2 py-0.5 text-[10px] border border-slate-200">
                          {customQa.length} items configured
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Size Quantities & Workflow & Specs */}
                <div className="space-y-6">
                  {/* Size Quantities Summary */}
                  <div className="border border-slate-100 rounded-xl bg-slate-50/30 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800">
                        <ClipboardList size={16} className="text-[#6366F1]" />
                        <h4 className="font-bold uppercase text-[11px] tracking-wider">Production Volume</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        className="text-[11px] font-bold text-[#6366F1] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2.5 py-1 rounded-lg transition-all"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-0.5">Total Quantity To Produce</span>
                          <span className="text-sm font-black text-emerald-700">{totalQuantity.toLocaleString("en-IN")} Pieces</span>
                        </div>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-1.5">Size Breakdown Schema</span>
                        <div className="flex flex-wrap gap-1.5">
                          {availableSizes.map((sz) => (
                            <span key={sz} className="px-2.5 py-1 rounded bg-[#F8FAFC] border border-slate-200 text-slate-700 font-bold text-[10px]">
                              {sz}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Workflow Stages Summary */}
                  <div className="border border-slate-100 rounded-xl bg-slate-50/30 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800">
                        <GitBranch size={16} className="text-[#6366F1]" />
                        <h4 className="font-bold uppercase text-[11px] tracking-wider">Workflow Routing Stages</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(5)}
                        className="text-[11px] font-bold text-[#6366F1] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2.5 py-1 rounded-lg transition-all"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="p-4 text-xs">
                      <div className="relative border-l-2 border-indigo-100 pl-4 ml-2.5 space-y-4">
                        {assignedStages.map((stage, idx) => (
                          <div key={stage.stage_id} className="relative">
                            <span className="absolute -left-[23px] top-0.5 w-2.5 h-2.5 rounded-full bg-[#6366F1] border-2 border-white ring-4 ring-indigo-50" />
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="block font-bold text-slate-800">
                                  {idx + 1}. {stage.stage_name}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {stage.stage_type === "job_work" ? "Job Work Outsource" : "In-House routing"}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                                {stage.worker_ids?.length || 0} Workers
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Design Spec Sheet Summary */}
                  {specSheetTemplate && (
                    <div className="border border-slate-100 rounded-xl bg-slate-50/30 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-slate-800">
                          <Sparkles size={16} className="text-[#6366F1]" />
                          <h4 className="font-bold uppercase text-[11px] tracking-wider">Garment Spec Parameters</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(6)}
                          className="text-[11px] font-bold text-[#6366F1] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-2.5 py-1 rounded-lg transition-all"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-3 text-xs bg-slate-50/20">
                        {Object.entries(specSheetValues).map(([name, val]) => (
                          <div key={name} className="border border-slate-100 bg-white p-2.5 rounded-lg">
                            <span className="block text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider mb-0.5">{name}</span>
                            <span className="font-bold text-[#334155]">{val || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitLot}
                  disabled={submitting}
                  className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white font-bold text-xs px-5 h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {submitting ? "Creating Lot..." : "Confirm & Create Lot"}
                  <CheckCircle size={14} />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right sticky panel summary */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <LotSummaryPanel
            title="Lot Live Summary"
            designImage={selectedDesign?.images?.[0]}
            items={summaryItems}
          />

          {/* Lot Production Remarks card */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-[#F3F4F6] pb-2 text-slate-800">
              <FileText size={15} className="text-[#6366F1]" />
              <h4 className="font-bold uppercase text-[10px] tracking-wider">Lot Production Remarks</h4>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="block text-[9px] uppercase font-bold text-[#64748B] tracking-wider">Remarks / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add production instructions or lot remarks..."
                rows={4}
                className="w-full p-2.5 bg-white border border-[#E5E7EB] rounded-lg text-xs focus:ring-1 focus:ring-[#6366F1] outline-none resize-none font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inline Create Design Dialog */}
      <Dialog open={designModalOpen} onOpenChange={setDesignModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <BookOpen className="text-[#6366F1]" size={20} />
              <span>Add New Design Code</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Design Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Slim Fit Denim Jeans"
                  value={newDesignName}
                  onChange={(e) => setNewDesignName(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Design Code / Model No.</label>
                <input
                  type="text"
                  placeholder="e.g. DSN-009 (Leave empty for auto-gen)"
                  value={newDesignCode}
                  onChange={(e) => setNewDesignCode(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Size Set *</label>
                <select
                  value={newDesignSizeSet}
                  onChange={(e) => setNewDesignSizeSet(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
                >
                  {sizeSetsData?.sizeSets?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.sizes.join(", ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Category</label>
                <select
                  value={newDesignCategory}
                  onChange={(e) => setNewDesignCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] cursor-pointer"
                >
                  {["Shirts", "Pants", "Jackets", "Suits", "T-shirts", "Polo", "Undergarments", "Other"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Sub-Category</label>
                <input
                  type="text"
                  placeholder="e.g. Slim-fit, Crewneck"
                  value={newDesignSubCategory}
                  onChange={(e) => setNewDesignSubCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Collection / Season</label>
                <input
                  type="text"
                  placeholder="e.g. Summer 2026, Festive"
                  value={newDesignSeason}
                  onChange={(e) => setNewDesignSeason(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">HSN Code</label>
                <input
                  type="text"
                  placeholder="e.g. 6203"
                  value={newDesignHsnCode}
                  onChange={(e) => setNewDesignHsnCode(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Style Notes & Description</label>
                <textarea
                  placeholder="Describe fits, stitching detailing, target fabric..."
                  rows={2}
                  value={newDesignDescription}
                  onChange={(e) => setNewDesignDescription(e.target.value)}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] resize-none"
                />
              </div>

              {/* Design Image Gallery */}
              <div className="sm:col-span-2 space-y-2 border-t border-slate-100 pt-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B] block">Design Image Gallery</label>
                <div className="flex flex-wrap gap-3 items-start pt-1">
                  {newDesignImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="w-[100px] aspect-[4/3] rounded-lg border border-[#E5E7EB] relative overflow-hidden bg-[#F8FAFC] flex items-center justify-center shadow-sm group"
                    >
                      <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewDesignImages(newDesignImages.filter((_, i) => i !== idx))}
                        className="absolute top-1.5 right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer transition-all shadow-md"
                        title="Remove image"
                      >
                        <X size={10} className="stroke-[3]" />
                      </button>
                    </div>
                  ))}

                  <div className="w-[100px] aspect-[4/3] border border-dashed border-[#D1D5DB] rounded-lg bg-[#F8FAFC] flex items-center justify-center p-2 relative">
                    <ImageUpload
                      value=""
                      folder="design_catalogs"
                      onChange={(url) => {
                        if (url) {
                          setNewDesignImages((prev) => [...prev, url]);
                          toast.success("Main design image uploaded!");
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Colours Config */}
            <div className="border border-[#E5E7EB] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Design Colours</h3>
                  <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-none">
                    Configure the shade variations for this design model.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddColourToDraft}
                  className="h-8 px-2.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Colour
                </button>
              </div>

              {newDesignColours.length === 0 ? (
                <p className="text-xs text-center py-4 text-[#94A3B8] font-bold">No colours defined yet.</p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {newDesignColours.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Colour Name (e.g. Navy Blue)"
                          value={item.name}
                          onChange={(e) => handleUpdateDraftColour(index, "name", e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={item.hex}
                          onChange={(e) => handleUpdateDraftColour(index, "hex", e.target.value)}
                          className="w-9 h-9 rounded-lg border border-[#D1D5DB] cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveColourFromDraft(index)}
                          className="w-8 h-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 cursor-pointer"
                          title="Remove colour"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-[#F1F5F9] flex flex-col sm:flex-row gap-2 justify-end">
            <button
              type="button"
              disabled={newDesignLoading}
              onClick={handleSaveNewDesign}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all cursor-pointer shadow-md shadow-[#6366F1]/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {newDesignLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Design"
              )}
            </button>
            <button
              type="button"
              onClick={() => setDesignModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
