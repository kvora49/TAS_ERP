"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FileText, ClipboardList, CheckCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import WizardHeader from "@/components/shared/WizardHeader";
import { Modal } from "@/components/shared/Modal";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

// Step components
import Step1RollAllocation from "./_components/Step1RollAllocation";
import Step2BasicDetails from "./_components/Step2BasicDetails";
import Step3LotSpecifications from "./_components/Step3LotSpecifications";
import Step4SizeQuantity from "./_components/Step4SizeQuantity";
import Step5AssignStages from "./_components/Step5AssignStages";
import Step6DesignSpecSheet from "./_components/Step6DesignSpecSheet";
import Step7ReviewCreate from "./_components/Step7ReviewCreate";
import CreateDesignModal from "./_components/CreateDesignModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Brand { id: string; name: string; }
interface DesignColour { id: string; colour_name: string; colour_hex: string | null; image_url: string | null; }
interface SizeSet { id: string; name: string; sizes: string[]; }
interface Design {
  id: string; name: string; code?: string; design_number?: string; brand_id: string; size_set_id: string;
  images: string[]; design_colours?: DesignColour[]; size_set?: SizeSet;
}
interface ProductionStage { id: string; name: string; type: string; }
interface LotStageInput {
  stage_id: string; stage_name: string; stage_type: string;
  sequence_no: number; is_mandatory: boolean; worker_ids: string[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateLotPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const saleOrderId = searchParams.get("sale_order_id");
  const orderNoParam = searchParams.get("order_no");

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 — sub-tab
  const [step1SubTab, setStep1SubTab] = useState<"rolls" | "accessories">("rolls");

  // Step 1 — Rolls
  const [rollSearch, setRollSearch] = useState("");
  const debouncedRollSearch = useDebounce(rollSearch, 300);
  const [allocatedRolls, setAllocatedRolls] = useState<Array<{
    purchase_roll_id: string; roll_number: string; shade: string; material_name: string;
    supplier_name: string; godown_name?: string; remaining_meters: number; allocated_meters: number; rate: number; colour_id?: string;
  }>>([]);
  const [allocating, setAllocating] = useState(false);

  // Step 1 — Accessories
  const [accessorySearch, setAccessorySearch] = useState("");
  const debouncedAccessorySearch = useDebounce(accessorySearch, 300);
  const [allocatedAccessories, setAllocatedAccessories] = useState<Array<{
    purchase_item_id: string; item_name: string; unit: string;
    godown_id: string; godown_name: string; supplier_name: string;
    available_qty: number; allocated_qty: number; unit_rate: number;
  }>>([]);

  // Step 2
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
  const [designModalOpen, setDesignModalOpen] = useState(false);

  // Pre-fill from Sales Order URL Params
  useEffect(() => {
    if (orderNoParam) {
      setBuyerOrderRef(orderNoParam);
    }
    if (saleOrderId) {
      fetch(`/api/sales/orders/${saleOrderId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.order) {
            const ord = data.order;
            if (ord.order_number) setBuyerOrderRef(ord.order_number);
            if (ord.party?.name) setCustomerRef(ord.party.name);
            if (ord.expected_delivery) setTargetDispatchDate(ord.expected_delivery);

            let parsedNotesText = ord.notes || "";
            if (ord.notes && typeof ord.notes === "string" && ord.notes.startsWith("{")) {
              try {
                const parsed = JSON.parse(ord.notes);
                if (parsed.text) parsedNotesText = parsed.text;
                if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
                  const firstItem = parsed.items[0];
                  if (firstItem.design_id) {
                    setDesignId(firstItem.design_id);
                  }
                  // Build sizeQuantities map
                  const sqMap: Record<string, Record<string, number>> = {};
                  parsed.items.forEach((it: any) => {
                    const cKey = it.colour_id || "default";
                    if (it.size_quantities) {
                      sqMap[cKey] = it.size_quantities;
                    }
                  });
                  if (Object.keys(sqMap).length > 0) {
                    setSizeQuantities(sqMap);
                  }
                }
              } catch (e) {}
            }
            setNotes(parsedNotesText);
            setCurrentStep(2); // Jump directly to Step 2 (Basic Details) with Design & Order prefilled!
            toast.success(`Linked Sales Order ${ord.order_number} — Pre-filled Design & Quantities!`);
          }
        })
        .catch(() => {});
    }
  }, [saleOrderId, orderNoParam]);

  // Step 3
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [designReferenceText, setDesignReferenceText] = useState("");
  const [designReferencePhotos, setDesignReferencePhotos] = useState<string[]>([]);
  const [customQa, setCustomQa] = useState<Array<{ question: string; answer: string }>>([]);

  // Step 4
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, Record<string, number>>>({});
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [selectedSizeSetId, setSelectedSizeSetId] = useState("");
  const [useSameColours, setUseSameColours] = useState(true);
  const [averageMeter, setAverageMeter] = useState<number>(0);
  const [calculatingAvg, setCalculatingAvg] = useState(false);

  // Step 5
  const [assignedStages, setAssignedStages] = useState<LotStageInput[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Step 6
  const [specSheetTemplate, setSpecSheetTemplate] = useState<any | null>(null);
  const [specSheetValues, setSpecSheetValues] = useState<Record<string, string>>({});

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Unsaved changes guard: active if user has entered data and hasn't submitted yet
  const isDirty = (allocatedRolls.length > 0 || allocatedAccessories.length > 0 || !!designId || currentStep > 1) && !isSubmitted;
  useUnsavedChangesGuard(isDirty);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: availableRollsData, isLoading: loadingRolls } = useQuery<{ rolls: any[] }>({
    queryKey: ["available-rolls", debouncedRollSearch],
    queryFn: async () => {
      const res = await fetch(`/api/production/lots/available-rolls?search=${encodeURIComponent(debouncedRollSearch)}`);
      return res.json();
    },
    enabled: currentStep === 1 && step1SubTab === "rolls",
  });

  const { data: availableAccessoriesData, isLoading: loadingAccessories } = useQuery<{ accessories: any[] }>({
    queryKey: ["available-accessories", debouncedAccessorySearch],
    queryFn: async () => {
      const res = await fetch(`/api/production/lots/available-accessories?search=${encodeURIComponent(debouncedAccessorySearch)}`);
      return res.json();
    },
    enabled: currentStep === 1 && step1SubTab === "accessories",
  });


  const { data: brandsData } = useQuery<{ brands: Brand[] }>({
    queryKey: ["brands-list"],
    queryFn: async () => { const res = await fetch("/api/master-data/brands"); return res.json(); },
  });
  const { data: designsData } = useQuery<{ designs: Design[] }>({
    queryKey: ["designs-list"],
    queryFn: async () => { const res = await fetch("/api/master-data/designs"); return res.json(); },
  });

  // Auto-sync brand & colours when designId is prefilled or changed
  useEffect(() => {
    if (designId && designsData?.designs) {
      const matched = designsData.designs.find((d) => d.id === designId);
      if (matched) {
        if (matched.brand_id) setBrandId(matched.brand_id);
        if (matched.size_set_id) setSelectedSizeSetId(matched.size_set_id);

        if (matched.design_colours && matched.design_colours.length > 0) {
          setSelectedColours((prev) => {
            if (prev.length === 0) {
              return matched.design_colours!.map((c) => ({
                id: c.id,
                colour_name: c.colour_name,
                colour_hex: c.colour_hex,
              }));
            }
            return prev;
          });
        }
      }
    }
  }, [designId, designsData]);
  const { data: masterStagesData } = useQuery<{ stages: ProductionStage[] }>({
    queryKey: ["master-stages-list"],
    queryFn: async () => { const res = await fetch("/api/master-data/production-stages"); return res.json(); },
  });
  const { data: sizeSetsData } = useQuery<{ sizeSets: SizeSet[] }>({
    queryKey: ["size-sets-list"],
    queryFn: async () => { const res = await fetch("/api/master-data/size-sets"); return res.json(); },
  });
  const { data: garmentTypesData } = useQuery<{ garmentTypes: any[] }>({
    queryKey: ["garment-types-list"],
    queryFn: async () => { const res = await fetch("/api/master-data/garment-types"); return res.json(); },
  });
  const { data: templatesData } = useQuery<{ templates: any[] }>({
    queryKey: ["production-templates-list"],
    queryFn: async () => { const res = await fetch("/api/master-data/production-templates"); return res.json(); },
  });
  const { data: workersData } = useQuery<{ parties: any[] }>({
    queryKey: ["workers-list"],
    queryFn: async () => { const res = await fetch("/api/parties?type=worker"); return res.json(); },
  });
  const { data: settingsData } = useQuery<any>({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/general");
      const data = await res.json();
      return data.settings || {};
    },
  });

  const availableRolls = availableRollsData?.rolls || [];
  const brands = (brandsData?.brands || []).filter((b: any) => b.is_active !== false);
  const designs = (designsData?.designs || []).filter((d: any) => d.is_active !== false || d.id === designId);
  const masterStages = (masterStagesData?.stages || []).filter((s: any) => s.is_active !== false);
  const sizeSets = (sizeSetsData?.sizeSets || []).filter((s: any) => s.is_active !== false);
  const garmentTypes = (garmentTypesData?.garmentTypes || []).filter((g: any) => g.is_active !== false);
  const productionTemplates = templatesData?.templates || [];
  const workers = workersData?.parties || [];

  const filteredDesigns = brandId ? designs.filter((d) => d.brand_id === brandId) : designs;
  const selectedDesign = designs.find((d) => d.id === designId);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { generateLotNumber(); }, []);

  // Pre-select & auto-load default production template
  useEffect(() => {
    if (templatesData?.templates && templatesData.templates.length > 0 && !selectedTemplateId && assignedStages.length === 0) {
      const defaultT = templatesData.templates.find((t: any) => t.is_default) || templatesData.templates[0];
      if (defaultT?.id) {
        handleLoadTemplate(defaultT.id);
      }
    }
  }, [templatesData?.templates, selectedTemplateId, assignedStages.length]);

  useEffect(() => {
    if (selectedDesign) {
      const sizeSetId = selectedDesign.size_set?.id || selectedDesign.size_set_id || "";
      if (sizeSetId) {
        setSelectedSizeSetId(sizeSetId);
      }
      if (selectedDesign.size_set) {
        setAvailableSizes(selectedDesign.size_set.sizes || []);
        const initQty: Record<string, number> = {};
        selectedDesign.size_set.sizes.forEach((s) => { initQty[s] = 0; });
        setSizeQuantities({ "all": initQty });
      }
      if (selectedDesign.brand_id && !brandId) setBrandId(selectedDesign.brand_id);
      setSelectedColours([]);
    }
  }, [selectedDesign, brandId]);

  useEffect(() => {
    if (lotDate) {
      const days = settingsData?.default_production_target_days || 90;
      const targetDate = new Date(lotDate);
      targetDate.setDate(targetDate.getDate() + days);
      setTargetDispatchDate(targetDate.toISOString().substring(0, 10));
    }
  }, [lotDate, settingsData]);

  useEffect(() => {
    const fetchSpecSheetTemplate = async () => {
      if (!garmentTypeId) { setSpecSheetTemplate(null); return; }
      try {
        const res = await fetch(`/api/master-data/design-spec-templates?garment_type_id=${garmentTypeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.templates?.length > 0) {
            setSpecSheetTemplate(data.templates[0]);
            const initial: Record<string, string> = {};
            data.templates[0].fields.forEach((f: any) => { initial[f.name] = ""; });
            setSpecSheetValues(initial);
          } else {
            setSpecSheetTemplate(null);
          }
        }
      } catch { /* silent */ }
    };
    fetchSpecSheetTemplate();
  }, [garmentTypeId]);

  useEffect(() => {
    if (masterStages.length > 0 && assignedStages.length === 0) {
      setAssignedStages(
        masterStages.slice(0, 5).map((s, idx) => ({
          stage_id: s.id, stage_name: s.name, stage_type: s.type || "in_house",
          sequence_no: idx + 1, is_mandatory: true, worker_ids: [],
        }))
      );
    }
  }, [masterStages]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const generateLotNumber = async () => {
    try {
      const res = await fetch("/api/production/lots/code/next");
      if (res.ok) { const data = await res.json(); setLotNumber(data.code); }
    } catch { /* silent */ }
  };

  const totalAllocatedMeters = allocatedRolls.reduce((acc, r) => acc + r.allocated_meters, 0);
  const suggestedPieces = averageMeter > 0 ? Math.floor(totalAllocatedMeters / averageMeter) : 0;

  const getColorAllocatedMeters = () => {
    const map: Record<string, number> = {};
    selectedColours.forEach((c) => { map[c.id] = 0; });
    allocatedRolls.forEach((r) => {
      let targetColourId = r.colour_id;
      if (!targetColourId && r.shade) {
        const match = selectedColours.find(
          (c) => c.colour_name.trim().toLowerCase() === r.shade.trim().toLowerCase()
        );
        if (match) targetColourId = match.id;
      }
      if (targetColourId && map[targetColourId] !== undefined) {
        map[targetColourId] += r.allocated_meters;
      }
    });
    return map;
  };

  const getColorSuggestedPieces = () => {
    const map: Record<string, number> = {};
    const colorMeters = getColorAllocatedMeters();
    if (averageMeter <= 0) return map;
    selectedColours.forEach((c) => {
      map[c.id] = Math.floor((colorMeters[c.id] || 0) / averageMeter);
    });
    return map;
  };

  const getTotalQuantity = () => {
    if (useSameColours) {
      const sum = Object.values(sizeQuantities["all"] || {}).reduce((a, b) => a + b, 0);
      return sum * (selectedColours.length || 1);
    }
    return selectedColours.reduce((acc, c) => {
      return acc + Object.values(sizeQuantities[c.id] || {}).reduce((a, b) => a + b, 0);
    }, 0);
  };
  const totalQuantity = getTotalQuantity();

  // ── Step handlers ─────────────────────────────────────────────────────────
  const handleToggleRoll = (roll: any) => {
    const exists = allocatedRolls.some((r) => r.purchase_roll_id === roll.id);
    if (exists) {
      setAllocatedRolls(allocatedRolls.filter((r) => r.purchase_roll_id !== roll.id));
    } else {
      setAllocatedRolls([...allocatedRolls, {
        purchase_roll_id: roll.id, roll_number: roll.roll_number, shade: roll.shade || "—",
        material_name: roll.item?.material_type?.name || "Fabric",
        supplier_name: roll.item?.purchase?.supplier?.company_name || roll.item?.purchase?.supplier?.name || "—",
        godown_name: roll.item?.purchase?.godown?.name || "Main Godown",
        remaining_meters: Number(roll.remaining_meters),
        allocated_meters: Number(roll.remaining_meters),
        rate: Number(roll.item?.rate || 0),
      }]);
    }
  };

  const handleRollAllocationChange = (rollId: string, meters: number) => {
    setAllocatedRolls(allocatedRolls.map((r) =>
      r.purchase_roll_id === rollId
        ? { ...r, allocated_meters: Math.min(r.remaining_meters, Math.max(0, meters)) }
        : r
    ));
  };

  const handleRollColourChange = (rollId: string, colourId: string) => {
    setAllocatedRolls(allocatedRolls.map((r) =>
      r.purchase_roll_id === rollId ? { ...r, colour_id: colourId } : r
    ));
  };

  const handleToggleAccessory = (item: any) => {
    const exists = allocatedAccessories.some((a) => a.purchase_item_id === item.id);
    if (exists) {
      setAllocatedAccessories(allocatedAccessories.filter((a) => a.purchase_item_id !== item.id));
    } else {
      setAllocatedAccessories([...allocatedAccessories, {
        purchase_item_id: item.id,
        item_name: item.item_name,
        unit: item.unit,
        godown_id: item.godown_id,
        godown_name: item.godown_name,
        supplier_name: item.supplier_name,
        available_qty: Number(item.available_qty),
        allocated_qty: Math.min(Number(item.available_qty), 1),
        unit_rate: Number(item.unit_rate),
      }]);
    }
  };

  const handleAccessoryQtyChange = (itemId: string, qty: number) => {
    setAllocatedAccessories(allocatedAccessories.map((a) =>
      a.purchase_item_id === itemId
        ? { ...a, allocated_qty: Math.min(a.available_qty, Math.max(0, qty)) }
        : a
    ));
  };

  const handleAddColour = (colourId: string) => {
    if (!colourId) return;
    const col = selectedDesign?.design_colours?.find((c) => c.id === colourId);
    if (col && !selectedColours.some((c) => c.id === colourId)) {
      setSelectedColours([...selectedColours, { id: col.id, colour_name: col.colour_name, colour_hex: col.colour_hex }]);
      if (!useSameColours) {
        const initQty: Record<string, number> = {};
        availableSizes.forEach((s) => { initQty[s] = 0; });
        setSizeQuantities((prev) => ({ ...prev, [col.id]: initQty }));
      }
    }
  };

  const handleRemoveColour = (colourId: string) => {
    setSelectedColours(selectedColours.filter((c) => c.id !== colourId));
    if (!useSameColours) {
      const copy = { ...sizeQuantities };
      delete copy[colourId];
      setSizeQuantities(copy);
    }
  };

  const fetchHistoricalAvg = async () => {
    const sizeSetId = selectedSizeSetId || selectedDesign?.size_set_id || selectedDesign?.size_set?.id;
    if (!garmentTypeId) {
      toast.error("Please select a Garment Type in Step 2 (Basic Details)");
      return;
    }
    if (!sizeSetId) {
      toast.error("Please select a Design with a Size Set in Step 2 (Basic Details)");
      return;
    }
    setCalculatingAvg(true);
    try {
      const res = await fetch(`/api/production/lots/historical-avg-meters?garment_type_id=${garmentTypeId}&size_set_id=${sizeSetId}`);
      if (res.ok) {
        const data = await res.json();
        setAverageMeter(data.avg_meters || 0);
        if (data.avg_meters > 0) {
          toast.success(`Loaded historical average: ${data.avg_meters} meters / pc`);
        } else {
          toast.info("No historical lot data found for this Garment Type & Size Set combination yet.");
        }
      }
    } catch { toast.error("Failed to load historical average meters"); }
    finally { setCalculatingAvg(false); }
  };

  const handlePrefillSizeQuantities = () => {
    if (suggestedPieces <= 0) { toast.error("Please configure roll allocation and non-zero average meter consumption"); return; }
    if (availableSizes.length === 0) { toast.error("No size set config available"); return; }

    const numColours = selectedColours.length || 1;

    if (useSameColours) {
      // Split overall total target suggestedPieces across the colors so total lot quantity == suggestedPieces exactly!
      const perColourTarget = Math.floor(suggestedPieces / numColours);
      const share = Math.floor(perColourTarget / (availableSizes.length || 1));
      const remainder = perColourTarget % availableSizes.length;
      const initQty: Record<string, number> = {};
      availableSizes.forEach((s, idx) => {
        initQty[s] = idx === 0 ? share + remainder : share;
      });
      setSizeQuantities({ "all": initQty });
    } else {
      const colorPiecesMap = getColorSuggestedPieces();
      const hasShadeMappings = Object.values(colorPiecesMap).some((pcs) => pcs > 0);
      const next: Record<string, Record<string, number>> = {};

      selectedColours.forEach((c) => {
        const targetPcs = hasShadeMappings
          ? (colorPiecesMap[c.id] || 0)
          : Math.floor(suggestedPieces / numColours);
        const share = Math.floor(targetPcs / (availableSizes.length || 1));
        const remainder = targetPcs % availableSizes.length;
        const initQty: Record<string, number> = {};
        availableSizes.forEach((s, idx) => {
          initQty[s] = idx === 0 ? share + remainder : share;
        });
        next[c.id] = initQty;
      });
      setSizeQuantities(next);
    }
    toast.success("Distributed suggested piece count across size categories!");
  };

  const handleAddWorker = (idx: number, workerId: string) => {
    if (!workerId) return;
    const copy = [...assignedStages];
    if (!copy[idx].worker_ids.includes(workerId)) copy[idx].worker_ids = [...copy[idx].worker_ids, workerId];
    setAssignedStages(copy);
  };

  const handleRemoveWorker = (idx: number, workerId: string) => {
    const copy = [...assignedStages];
    copy[idx].worker_ids = copy[idx].worker_ids.filter((w) => w !== workerId);
    setAssignedStages(copy);
  };

  const handleLoadTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    try {
      const res = await fetch(`/api/master-data/production-templates/${templateId}`);
      if (!res.ok) throw new Error("Failed to load template");
      const data = await res.json();
      const rawStages = data.stages || data.template?.stages || [];
      if (rawStages.length === 0) {
        toast.info("Selected template does not have any linked stages.");
      }
      setAssignedStages(
        rawStages.map((s: any, idx: number) => ({
          stage_id: s.id || s.stage_id,
          stage_name: s.name || s.stage_name,
          stage_type: s.type || s.stage_type || "in_house",
          sequence_no: idx + 1,
          is_mandatory: true,
          worker_ids: [],
        }))
      );
      if (rawStages.length > 0) {
        toast.success(`Loaded ${rawStages.length} production stages from template`);
      }
    } catch { toast.error("Failed to load template stages"); }
  };

  // ── Step validations ──────────────────────────────────────────────────────
  const handleStep1Next = () => {
    if (allocatedRolls.length === 0 && allocatedAccessories.length === 0) {
      toast.error("Please allocate at least one fabric roll or accessory");
      return;
    }
    const invalidRolls = allocatedRolls.some((r) => r.allocated_meters <= 0 || r.allocated_meters > r.remaining_meters);
    const invalidAcc = allocatedAccessories.some((a) => a.allocated_qty <= 0 || a.allocated_qty > a.available_qty);
    if (invalidRolls || invalidAcc) {
      toast.error("Please ensure all allocation quantities are valid");
      return;
    }
    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    if (!brandId || !designId || !lotNumber || !lotDate || !garmentTypeId || selectedColours.length === 0) {
      toast.error("Please ensure all required fields are filled and at least one colour is chosen");
      return;
    }
    setCurrentStep(3);
  };

  const handleStep4Next = () => {
    if (totalQuantity <= 0) { toast.error("Please specify size quantities to proceed"); return; }
    setCurrentStep(5);
  };

  const handleStep5Next = () => {
    if (assignedStages.length === 0) { toast.error("Please assign at least one stage"); return; }
    setCurrentStep(6);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmitLot = async () => {
    setSubmitting(true);
    try {
      const sizesToSave: any[] = [];
      if (useSameColours) {
        const grid = sizeQuantities["all"] || {};
        selectedColours.forEach((colour) => {
          Object.entries(grid).forEach(([size, qty]) => sizesToSave.push({ size, quantity: qty, colour_id: colour.id }));
        });
      } else {
        selectedColours.forEach((colour) => {
          const grid = sizeQuantities[colour.id] || {};
          Object.entries(grid).forEach(([size, qty]) => sizesToSave.push({ size, quantity: qty, colour_id: colour.id }));
        });
      }

      const payload = {
        lot_number: lotNumber, brand_id: brandId, design_id: designId,
        colour_id: selectedColours[0]?.id || null, size_set_id: selectedSizeSetId || selectedDesign?.size_set_id || selectedDesign?.size_set?.id || null,
        lot_date: lotDate, season, buyer_order_ref: buyerOrderRef || null,
        target_start_date: targetStartDate || null, target_dispatch_date: targetDispatchDate || null,
        target_due_date: targetDispatchDate || null, priority, production_type: productionType,
        allow_rework: false, notes, internal_notes: internalNotes || null,
        customer_ref: customerRef || null, po_date: poDate || null,
        total_quantity: totalQuantity, garment_type_id: garmentTypeId,
        design_type: designType || null, lot_name: lotName || null,
        allocated_rolls: allocatedRolls.map((r) => ({
          purchase_roll_id: r.purchase_roll_id,
          allocated_meters: r.allocated_meters,
          colour_id: r.colour_id || null,
        })),
        allocated_accessories: allocatedAccessories.map((a) => ({
          purchase_item_id: a.purchase_item_id,
          allocated_qty: a.allocated_qty,
        })),
        specifications: { additional_details: additionalDetails, design_reference_text: designReferenceText, design_reference_photos: designReferencePhotos, custom_qa: customQa },
        spec_sheet: specSheetTemplate ? { template_id: specSheetTemplate.id, spec_values: specSheetValues } : null,
        sizes: sizesToSave, stages: assignedStages,
        template_id: selectedTemplateId || null,
      };

      const res = await fetch("/api/production/lots", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create production lot");

      await queryClient.invalidateQueries({ queryKey: ["lots-list"] });
      setIsSubmitted(true);
      toast.success("Production lot created successfully!");
      router.push("/production/lots");
    } catch (err: any) {
      toast.error(err.message || "Failed to create lot");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Summary ────────────────────────────────────────────────────────────────
  const steps = ["Material Allocation", "Basic Details", "Lot Specifications", "Size Set & Quantity", "Assign Stages", "Design Spec Sheet", "Review & Create"];

  const summaryItems = [
    { label: "Lot No.", value: lotNumber || "—" },
    ...(buyerOrderRef ? [{ label: "Sales Order Ref", value: buyerOrderRef }] : []),
    { label: "Brand", value: brands.find((b) => b.id === brandId)?.name || "—" },
    { label: "Design", value: selectedDesign ? `${selectedDesign.design_number || selectedDesign.code || ""} - ${selectedDesign.name}` : "—" },
    { label: "Workflow Template", value: productionTemplates.find((t) => t.id === selectedTemplateId)?.name || "Default Flow" },
    { label: "Allocated Fabric", value: `${totalAllocatedMeters.toFixed(1)} Meters` },
    ...(allocatedAccessories.length > 0 ? [{ label: "Allocated Accessories", value: `${allocatedAccessories.length} item(s)` }] : []),
    { label: "Colours Selected", value: selectedColours.map((c) => c.colour_name).join(", ") || "—" },
    { label: "Stages Assigned", value: `${assignedStages.length} Stages` },
    { label: "Total Quantity", value: `${totalQuantity.toLocaleString("en-IN")} Pcs`, isQuantity: true },
    { label: "Target Dispatch", value: targetDispatchDate || "—" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  // Mobile summary sheet state
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 select-none max-w-[1400px] mx-auto pb-28 md:pb-6">
      {/* Breadcrumbs — hidden on mobile to save space */}
      <nav className="hidden md:flex items-center gap-1.5 text-xs text-[#64748B] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">Production</Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <Link href="/production/lots" className="hover:text-[#6366F1] transition-colors">Production Lots</Link>
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
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Create Production Lot</h2>
            <p className="text-xs text-[var(--text-muted)]">Set up new production lot routing and specifications</p>
          </div>
        </div>

        {currentStep === 7 && (
          <button
            type="button"
            onClick={handleSubmitLot}
            disabled={submitting}
            className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] disabled:opacity-50 text-white font-bold text-xs px-5 h-10 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating Lot...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Confirm & Create Lot</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Wizard Header */}
      <WizardHeader currentStep={currentStep} steps={steps} />

      {/* Content Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Forms Section — full width on mobile, 2/3 on lg */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {currentStep === 1 && (
            <Step1RollAllocation
              step1SubTab={step1SubTab}
              setStep1SubTab={setStep1SubTab}
              rollSearch={rollSearch}
              setRollSearch={setRollSearch}
              availableRolls={availableRolls}
              loadingRolls={loadingRolls}
              allocatedRolls={allocatedRolls}
              setAllocatedRolls={setAllocatedRolls}
              onToggleRoll={handleToggleRoll}
              onAllocationChange={handleRollAllocationChange}
              onRollColourChange={handleRollColourChange}
              selectedColours={selectedColours}
              allocating={allocating}
              accessorySearch={accessorySearch}
              setAccessorySearch={setAccessorySearch}
              availableAccessories={availableAccessoriesData?.accessories || []}
              loadingAccessories={loadingAccessories}
              allocatedAccessories={allocatedAccessories}
              setAllocatedAccessories={setAllocatedAccessories}
              onToggleAccessory={handleToggleAccessory}
              onAccessoryQtyChange={handleAccessoryQtyChange}
              onNext={handleStep1Next}
            />
          )}

          {currentStep === 2 && (
            <Step2BasicDetails
              brands={brands}
              filteredDesigns={filteredDesigns}
              brandId={brandId}
              setBrandId={setBrandId}
              designId={designId}
              setDesignId={setDesignId}
              lotName={lotName}
              setLotName={setLotName}
              lotNumber={lotNumber}
              setLotNumber={setLotNumber}
              buyerOrderRef={buyerOrderRef}
              setBuyerOrderRef={setBuyerOrderRef}
              garmentTypes={garmentTypes}
              garmentTypeId={garmentTypeId}
              setGarmentTypeId={setGarmentTypeId}
              designType={designType}
              setDesignType={setDesignType}
              lotDate={lotDate}
              setLotDate={setLotDate}
              targetDispatchDate={targetDispatchDate}
              setTargetDispatchDate={setTargetDispatchDate}
              selectedColours={selectedColours}
              selectedDesign={selectedDesign}
              onAddColour={handleAddColour}
              onRemoveColour={handleRemoveColour}
              onGenerateLotNumber={generateLotNumber}
              onOpenCreateDesignModal={() => setDesignModalOpen(true)}
              onNext={handleStep2Next}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step3LotSpecifications
              additionalDetails={additionalDetails}
              setAdditionalDetails={setAdditionalDetails}
              designReferenceText={designReferenceText}
              setDesignReferenceText={setDesignReferenceText}
              designReferencePhotos={designReferencePhotos}
              setDesignReferencePhotos={setDesignReferencePhotos}
              customQa={customQa}
              setCustomQa={setCustomQa}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && (
            <Step4SizeQuantity
              availableSizes={availableSizes}
              useSameColours={useSameColours}
              setUseSameColours={setUseSameColours}
              setSizeQuantities={setSizeQuantities}
              sizeQuantities={sizeQuantities}
              selectedColours={selectedColours}
              totalAllocatedMeters={totalAllocatedMeters}
              averageMeter={averageMeter}
              setAverageMeter={setAverageMeter}
              calculatingAvg={calculatingAvg}
              suggestedPieces={suggestedPieces}
              onFetchHistoricalAvg={fetchHistoricalAvg}
              onPrefillSizeQuantities={handlePrefillSizeQuantities}
              onNext={handleStep4Next}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && (
            <Step5AssignStages
              assignedStages={assignedStages}
              setAssignedStages={setAssignedStages}
              masterStages={masterStages}
              workers={workers}
              productionTemplates={productionTemplates}
              selectedTemplateId={selectedTemplateId}
              onLoadTemplate={handleLoadTemplate}
              onAddWorker={handleAddWorker}
              onRemoveWorker={handleRemoveWorker}
              onNext={handleStep5Next}
              onBack={() => setCurrentStep(4)}
            />
          )}

          {currentStep === 6 && (
            <Step6DesignSpecSheet
              specSheetTemplate={specSheetTemplate}
              specSheetValues={specSheetValues}
              setSpecSheetValues={setSpecSheetValues}
              onNext={() => setCurrentStep(7)}
              onBack={() => setCurrentStep(5)}
            />
          )}

          {currentStep === 7 && (
            <Step7ReviewCreate
              lotNumber={lotNumber}
              brandName={brands.find((b) => b.id === brandId)?.name || "—"}
              lotName={lotName}
              garmentTypeName={garmentTypes.find((gt) => gt.id === garmentTypeId)?.name || "—"}
              designType={designType}
              lotDate={lotDate}
              targetDispatchDate={targetDispatchDate}
              selectedColours={selectedColours}
              allocatedRolls={allocatedRolls}
              totalAllocatedMeters={totalAllocatedMeters}
              totalQuantity={totalQuantity}
              availableSizes={availableSizes}
              assignedStages={assignedStages}
              specSheetTemplate={specSheetTemplate}
              specSheetValues={specSheetValues}
              additionalDetails={additionalDetails}
              designReferenceText={designReferenceText}
              designReferencePhotos={designReferencePhotos}
              customQa={customQa}
              sizeQuantities={sizeQuantities}
              useSameColours={useSameColours}
              submitting={submitting}
              onSubmit={handleSubmitLot}
              onBack={() => setCurrentStep(6)}
              onEditStep={setCurrentStep}
            />
          )}
        </div>

        {/* Right sticky panel — HIDDEN on mobile, visible on lg+ */}
        <div className="hidden lg:block space-y-6 lg:sticky lg:top-6 lg:self-start">
          <LotSummaryPanel
            title="Lot Live Summary"
            designImage={selectedDesign?.images?.[0]}
            items={summaryItems}
          />

          {/* Lot Production Remarks */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
            <div className="flex items-center gap-2 border-b border-[var(--border-light)] pb-2 text-[var(--text-primary)]">
              <FileText size={15} className="text-[var(--primary)]" />
              <h4 className="font-bold uppercase text-[10px] tracking-wider">Lot Production Remarks</h4>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="block text-[9px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Remarks / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add production instructions or lot remarks..."
                rows={4}
                className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs focus:ring-2 focus:ring-[var(--input-focus)] outline-none resize-none font-medium transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: Floating Summary Pill (lg:hidden) ───────────────────────── */}
      <div className="lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] right-4 z-30">
        <button
          type="button"
          onClick={() => setMobileSummaryOpen(true)}
          className="flex items-center gap-2 bg-[var(--primary)] text-white px-4 py-2.5 rounded-full shadow-lg shadow-[var(--primary)]/30 text-sm font-bold active:scale-95 transition-transform cursor-pointer"
        >
          <ClipboardList className="h-4 w-4" />
          Summary
        </button>
      </div>

      {/* Mobile Summary Sheet */}
      <Modal
        open={mobileSummaryOpen}
        onOpenChange={setMobileSummaryOpen}
        title="Lot Live Summary"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <LotSummaryPanel
            title=""
            designImage={selectedDesign?.images?.[0]}
            items={summaryItems}
          />
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Remarks / Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add production instructions or lot remarks..."
              rows={3}
              className="w-full p-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--input-focus)] outline-none resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Create Design Modal */}
      <CreateDesignModal
        open={designModalOpen}
        onOpenChange={setDesignModalOpen}
        brandId={brandId}
        sizeSets={sizeSets}
        onDesignCreated={(id) => {
          setDesignId(id);
          queryClient.invalidateQueries({ queryKey: ["designs-list"] });
        }}
      />
    </div>
  );
}
