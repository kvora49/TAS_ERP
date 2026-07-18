"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { NumericInput } from "@/components/ui/numeric-input";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2, Search, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { AttachmentDropzone } from "@/components/shared/AttachmentDropzone";
import { useFileUpload } from "@/hooks/useFileUpload";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Helper function to convert number to Indian currency words
function numberToWords(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const formatTens = (n: number) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
  };

  const formatHundreds = (n: number) => {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (str !== "") str += "and ";
      str += formatTens(n);
    }
    return str;
  };

  let rupee = Math.floor(num);
  let paise = Math.round((num - rupee) * 100);
  
  let result = "";

  if (rupee > 0) {
    let crore = Math.floor(rupee / 10000000);
    rupee %= 10000000;
    let lakh = Math.floor(rupee / 100000);
    rupee %= 100000;
    let thousand = Math.floor(rupee / 1000);
    rupee %= 1000;

    if (crore > 0) result += formatHundreds(crore) + " Crore ";
    if (lakh > 0) result += formatHundreds(lakh) + " Lakh ";
    if (thousand > 0) result += formatHundreds(thousand) + " Thousand ";
    if (rupee > 0) result += formatHundreds(rupee);
    
    result += " Rupees";
  }

  if (paise > 0) {
    if (result !== "") result += " and ";
    result += formatTens(paise) + " Paise";
  }

  return result ? result + " Only" : "Zero Rupees Only";
}

const purchaseRollSchema = z.object({
  roll_number: z.string().min(1, "Roll number is required"),
  meters: z.coerce.number().min(0.01, "Meters must be greater than 0"),
  shade: z.string().min(1, "Shade is required"),
  comment: z.string().optional(),
  width: z.coerce.number().optional().nullable(),
  weight_unit: z.string().optional().nullable(),
  weight_value: z.coerce.number().optional().nullable(),
});

const purchaseItemSchema = z.object({
  material_type_id: z.string().min(1, "Material Type is required"),
  hsn_sac: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  rate: z.coerce.number().min(0.01, "Rate must be greater than 0"),
  discount_percent: z.coerce.number().min(0).max(100),
  taxable_value: z.coerce.number(),
  gst_percent: z.coerce.number().min(0).max(100),
  gst_amount: z.coerce.number(),
  amount: z.coerce.number(),
  item_type: z.enum(["fabric", "accessory"]).default("fabric"),
  rolls: z.array(purchaseRollSchema).optional().default([]),
});

const purchaseSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  godown_id: z.string().min(1, "Godown is required"),
  invoice_no: z.string().min(1, "Invoice Number is required"),
  invoice_date: z.string().min(1, "Invoice Date is required"),
  delivery_date: z.string().optional(),
  payment_terms: z.string(),
  due_date: z.string().optional(),
  reference: z.string().optional(),
  transporter: z.string().optional(),
  place_of_supply: z.string().optional(),
  gst_type: z.enum(["with_gst", "without_gst", "reverse_charge"]),
  notes: z.string().optional(),
  freight: z.coerce.number().min(0),
  loading_unloading: z.coerce.number().min(0),
  other_charges: z.coerce.number().min(0),
  attachments: z.array(z.string()),
  items: z.array(purchaseItemSchema).min(1, "At least one purchase item is required"),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface Supplier {
  id: string;
  name: string;
  company_name: string | null;
  default_godown_id?: string | null;
}

interface MaterialType {
  id: string;
  name: string;
  unit: string;
  hsn_code: string | null;
  gst_percent: number;
}

interface MaterialTypeComboboxProps {
  value: string;
  onChange: (val: string) => void;
  materialTypes: MaterialType[];
  disabled?: boolean;
  onAddNew: () => void;
  placeholder?: string;
}

function MaterialTypeCombobox({
  value,
  onChange,
  materialTypes,
  disabled = false,
  onAddNew,
  placeholder = "Select Material Type",
}: MaterialTypeComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedType = materialTypes.find((m) => m.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filtered = materialTypes.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 h-10 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A] disabled:opacity-50 select-none cursor-pointer"
      >
        <span className="truncate">{selectedType ? selectedType.name : placeholder}</span>
        <ChevronDown size={16} className="text-[#64748B] ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[300px]">
          {/* Search box */}
          <div className="p-2 border-b border-[#F1F5F9] flex items-center gap-1.5 bg-slate-50">
            <Search size={14} className="text-[#94A3B8] shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none focus:ring-0 font-medium p-0.5 text-[#0F172A]"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto py-1 max-h-[200px]">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[#94A3B8] font-semibold text-center">
                No matching materials
              </div>
            ) : (
              filtered.map((m) => {
                const isSelected = m.id === value;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange(m.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs font-semibold hover:bg-slate-50 transition-colors select-none cursor-pointer ${
                      isSelected ? "text-indigo-600 bg-indigo-50/50" : "text-[#334155]"
                    }`}
                  >
                    <span className="truncate">{m.name}</span>
                    {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Add New Option */}
          <button
            type="button"
            onClick={() => {
              onAddNew();
              setIsOpen(false);
              setSearch("");
            }}
            className="w-full h-10 px-3 border-t border-[#F1F5F9] bg-[#F8FAFC] hover:bg-slate-100 text-xs font-bold text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer justify-center select-none"
          >
            <Plus size={14} /> Add New Material Type
          </button>
        </div>
      )}
    </div>
  );
}

interface SupplierComboboxProps {
  value: string;
  onChange: (val: string) => void;
  suppliers: Supplier[];
  disabled?: boolean;
  onAddNew: () => void;
  placeholder?: string;
}

function SupplierCombobox({
  value,
  onChange,
  suppliers,
  disabled = false,
  onAddNew,
  placeholder = "Select Supplier",
}: SupplierComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = suppliers.find((s) => s.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const getLabel = (s: Supplier) => {
    return s.company_name ? `${s.company_name} (${s.name})` : s.name;
  };

  const filtered = suppliers.filter((s) => {
    const label = getLabel(s);
    return label.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 h-10 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A] disabled:opacity-50 select-none cursor-pointer"
      >
        <span className="truncate">{selectedSupplier ? getLabel(selectedSupplier) : placeholder}</span>
        <ChevronDown size={16} className="text-[#64748B] ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[300px]">
          {/* Search box */}
          <div className="p-2 border-b border-[#F1F5F9] flex items-center gap-1.5 bg-slate-50">
            <Search size={14} className="text-[#94A3B8] shrink-0" />
            <input
              type="text"
              placeholder="Search supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none focus:ring-0 font-medium p-0.5 text-[#0F172A]"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto py-1 max-h-[200px]">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[#94A3B8] font-semibold text-center">
                No matching suppliers
              </div>
            ) : (
              filtered.map((s) => {
                const isSelected = s.id === value;
                const label = getLabel(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onChange(s.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs font-semibold hover:bg-slate-50 transition-colors select-none cursor-pointer ${
                      isSelected ? "text-indigo-600 bg-indigo-50/50" : "text-[#334155]"
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Add New Option */}
          <button
            type="button"
            onClick={() => {
              onAddNew();
              setIsOpen(false);
              setSearch("");
            }}
            className="w-full h-10 px-3 border-t border-[#F1F5F9] bg-[#F8FAFC] hover:bg-slate-100 text-xs font-bold text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer justify-center select-none"
          >
            <Plus size={14} /> Add New Supplier
          </button>
        </div>
      )}
    </div>
  );
}

interface PurchaseFormProps {
  initialData?: any;
  id?: string;
}

export function PurchaseForm({ initialData, id }: PurchaseFormProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingGodowns, setLoadingGodowns] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { upload, uploading } = useFileUpload("purchases");

  // Inline Material Type creation state
  const [newTypeModalOpen, setNewTypeModalOpen] = useState(false);
  const [newTypeItemIndex, setNewTypeItemIndex] = useState<number | null>(null);
  const [creatingType, setCreatingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeCategory, setNewTypeCategory] = useState("Fabric");
  const [newTypeUnit, setNewTypeUnit] = useState("meter");
  const [newTypeReorderLevel, setNewTypeReorderLevel] = useState("0");
  const [newTypeDescription, setNewTypeDescription] = useState("");

  // Inline Supplier creation state
  const [newSupplierModalOpen, setNewSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCompany, setNewSupplierCompany] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierGstin, setNewSupplierGstin] = useState("");
  const [newSupplierPan, setNewSupplierPan] = useState("");
  const [savingNewSupplier, setSavingNewSupplier] = useState(false);

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error("Supplier Name is required");
      return;
    }
    setSavingNewSupplier(true);
    try {
      const codeRes = await fetch("/api/parties/code/next?type=supplier");
      const codeData = await codeRes.json();
      const code = codeData.code || `SUP-${Date.now().toString().slice(-6)}`;

      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSupplierName,
          company_name: newSupplierCompany,
          phone: newSupplierPhone,
          gstin: newSupplierGstin,
          pan: newSupplierPan,
          type: ["supplier"],
          code,
          contact_numbers: newSupplierPhone ? [{ label: "Main", number: newSupplierPhone, is_primary: true }] : [],
          status: "active",
        }),
      });

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to create supplier");
      }

      const { party } = await res.json();
      toast.success("Supplier created successfully");
      
      setSuppliers((prev) => [...prev, party]);
      setValue("supplier_id", party.id);
      
      setNewSupplierName("");
      setNewSupplierCompany("");
      setNewSupplierPhone("");
      setNewSupplierGstin("");
      setNewSupplierPan("");
      setNewSupplierModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSavingNewSupplier(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const defaultValues: PurchaseFormValues = {
    supplier_id: "",
    godown_id: "",
    invoice_no: "",
    invoice_date: new Date().toISOString().split("T")[0],
    delivery_date: "",
    payment_terms: "30_days",
    due_date: "",
    reference: "",
    transporter: "",
    place_of_supply: "",
    gst_type: "with_gst",
    notes: "",
    freight: 0,
    loading_unloading: 0,
    other_charges: 0,
    attachments: [],
    items: [
      {
        material_type_id: "",
        hsn_sac: "",
        unit: "meter",
        quantity: 0,
        rate: 0,
        discount_percent: 0,
        taxable_value: 0,
        gst_percent: 18,
        gst_amount: 0,
        amount: 0,
        item_type: "fabric",
        rolls: [],
      },
    ],
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema) as any,
    defaultValues: initialData ? { ...defaultValues, ...initialData } : defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchItems = watch("items") || [];
  const watchFreight = watch("freight") || 0;
  const watchLoading = watch("loading_unloading") || 0;
  const watchOtherCharges = watch("other_charges") || 0;
  const watchGstType = watch("gst_type") || "with_gst";
  const watchInvoiceDate = watch("invoice_date");
  const watchPaymentTerms = watch("payment_terms");

  // Fetch lists
  useEffect(() => {
    async function fetchSuppliers() {
      setLoadingSuppliers(true);
      try {
        const res = await fetch("/api/parties?type=supplier");
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data.parties || []);
        }
      } catch (err) {
        console.error("Failed to load suppliers");
      } finally {
        setLoadingSuppliers(false);
      }
    }

    async function fetchMaterials() {
      setLoadingMaterials(true);
      try {
        const res = await fetch("/api/raw-materials");
        if (res.ok) {
          const data = await res.json();
          setMaterialTypes(data.materialTypes || []);
        }
      } catch (err) {
        console.error("Failed to load material types");
      } finally {
        setLoadingMaterials(false);
      }
    }

    fetchSuppliers();
    fetchMaterials();

    async function fetchInventorySettings() {
      setLoadingGodowns(true);
      try {
        const res = await fetch("/api/settings/inventory");
        if (res.ok) {
          const data = await res.json();
          setGodowns(data.godowns || []);
          if (!id && !initialData?.godown_id && data.settings?.default_godown_id) {
            setValue("godown_id", data.settings.default_godown_id);
          }
        }
      } catch (err) {
        console.error("Failed to load inventory settings:", err);
      } finally {
        setLoadingGodowns(false);
      }
    }
    fetchInventorySettings();
  }, []);

  // Compute Due Date automatically based on Invoice Date + Payment Terms days
  useEffect(() => {
    if (watchInvoiceDate && watchPaymentTerms) {
      const date = new Date(watchInvoiceDate);
      let days = 0;
      if (watchPaymentTerms === "15_days") days = 15;
      else if (watchPaymentTerms === "30_days") days = 30;
      else if (watchPaymentTerms === "45_days") days = 45;
      else if (watchPaymentTerms === "60_days") days = 60;
      else if (watchPaymentTerms === "90_days") days = 90;

      if (days > 0) {
        date.setDate(date.getDate() + days);
        setValue("due_date", date.toISOString().split("T")[0]);
      } else {
        setValue("due_date", watchInvoiceDate);
      }
    }
  }, [watchInvoiceDate, watchPaymentTerms, setValue]);

  // Autofill item fields when material type changes
  const handleMaterialChange = (index: number, matId: string) => {
    const selectedMat = materialTypes.find((m) => m.id === matId);
    if (selectedMat) {
      setValue(`items.${index}.hsn_sac`, selectedMat.hsn_code || "");
      setValue(`items.${index}.unit`, selectedMat.unit || "meter");
      setValue(`items.${index}.gst_percent`, selectedMat.gst_percent || 18);
      // Trigger recalc
      recalcItem(index);
    }
  };

  const handleCreateMaterialType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) {
      toast.error("Material name is required");
      return;
    }

    setCreatingType(true);
    try {
      const res = await fetch("/api/raw-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTypeName.trim(),
          description: newTypeDescription.trim(),
          category: newTypeCategory,
          unit: newTypeUnit,
          reorder_level: Number(newTypeReorderLevel || 0),
          is_active: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create material type");
      }

      const { materialType } = await res.json();
      toast.success("Material type created successfully");

      // Append to the list of material types in state
      setMaterialTypes((prev) => [...prev, materialType]);

      // If we know which line item triggered this modal, auto-populate it!
      if (newTypeItemIndex !== null) {
        setValue(`items.${newTypeItemIndex}.material_type_id`, materialType.id);
        handleMaterialChange(newTypeItemIndex, materialType.id);
      }

      // Reset fields and close modal
      setNewTypeName("");
      setNewTypeDescription("");
      setNewTypeCategory("Fabric");
      setNewTypeUnit("meter");
      setNewTypeReorderLevel("0");
      setNewTypeModalOpen(false);
      setNewTypeItemIndex(null);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setCreatingType(false);
    }
  };

  // Recalculate specific item figures
  const recalcItem = (index: number) => {
    const qty = Number(watchItems[index]?.quantity || 0);
    const rate = Number(watchItems[index]?.rate || 0);
    const disc = Number(watchItems[index]?.discount_percent || 0);
    const gstPct = Number(watchItems[index]?.gst_percent || 0);

    const taxableValue = qty * rate * (1 - disc / 100);
    const gstAmount = watchGstType === "with_gst" ? (taxableValue * gstPct) / 100 : 0;
    const amount = taxableValue + gstAmount;

    setValue(`items.${index}.taxable_value`, Number(taxableValue.toFixed(2)));
    setValue(`items.${index}.gst_amount`, Number(gstAmount.toFixed(2)));
    setValue(`items.${index}.amount`, Number(amount.toFixed(2)));
  };

  const addRoll = (itemIndex: number) => {
    const currentRolls = watch(`items.${itemIndex}.rolls`) || [];
    const nextNumber = currentRolls.length + 1;
    const nextRollNo = `R-${nextNumber}`;
    const newRoll = {
      roll_number: nextRollNo,
      meters: 0,
      shade: "",
      comment: "",
      width: undefined,
      weight_unit: "gsm",
      weight_value: undefined,
    };
    setValue(`items.${itemIndex}.rolls`, [...currentRolls, newRoll]);
  };

  const removeRoll = (itemIndex: number, rollIndex: number) => {
    const currentRolls = watch(`items.${itemIndex}.rolls`) || [];
    const newRolls = currentRolls.filter((_, i) => i !== rollIndex);
    setValue(`items.${itemIndex}.rolls`, newRolls);
    
    // Recalculate total meters (quantity)
    const sumMeters = newRolls.reduce((sum, r) => sum + Number(r.meters || 0), 0);
    setValue(`items.${itemIndex}.quantity`, sumMeters);
    recalcItem(itemIndex);
  };

  const handleRollMetersChange = (itemIndex: number, rollIndex: number, meters: number) => {
    setValue(`items.${itemIndex}.rolls.${rollIndex}.meters`, meters);
    
    // Recalculate total meters (quantity)
    const currentRolls = watch(`items.${itemIndex}.rolls`) || [];
    const sumMeters = currentRolls.reduce((sum, r, idx) => {
      const val = idx === rollIndex ? meters : Number(r.meters || 0);
      return sum + val;
    }, 0);
    setValue(`items.${itemIndex}.quantity`, sumMeters);
    recalcItem(itemIndex);
  };

  // Trigger recalc for all items when GST Type changes
  useEffect(() => {
    for (let i = 0; i < watchItems.length; i++) {
      recalcItem(i);
    }
  }, [watchGstType]);

  // Compute Grand Totals
  let subtotal = 0;
  let totalTaxableValue = 0;
  let totalGstAmount = 0;

  watchItems.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const disc = Number(item.discount_percent || 0);
    const gstPct = Number(item.gst_percent || 0);

    const taxableValue = qty * rate * (1 - disc / 100);
    const gstAmount = watchGstType === "with_gst" ? (taxableValue * gstPct) / 100 : 0;

    subtotal += qty * rate;
    totalTaxableValue += taxableValue;
    totalGstAmount += gstAmount;
  });

  const totalOtherCharges = Number(watchFreight) + Number(watchLoading) + Number(watchOtherCharges);
  const grandTotal = totalTaxableValue + totalGstAmount + totalOtherCharges;
  const grandTotalWords = numberToWords(grandTotal);

  const onSubmit = async (values: PurchaseFormValues) => {
    try {
      // Re-map items to pass numeric values correctly
      const payload = {
        ...values,
        subtotal,
        total_taxable_value: totalTaxableValue,
        total_gst_amount: totalGstAmount,
        total_other_charges: totalOtherCharges,
        grand_total: grandTotal,
        amount_in_words: grandTotalWords,
      };

      const url = id ? `/api/raw-materials/purchases/${id}` : "/api/raw-materials/purchases";
      const method = id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save invoice");

      toast.success(id ? "Purchase invoice updated successfully" : "Purchase invoice recorded successfully");
      router.push("/raw-materials/purchases");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit purchase");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Bar Action */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/raw-materials/purchases" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">
              {id ? "Edit Purchase Invoice" : "Record Purchase Invoice"}
            </h1>
            <p className="text-xs text-[#64748B]">
              Input supplier details, line items, and upload invoice attachments.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/raw-materials/purchases"
            className="px-4 py-2 text-sm font-semibold text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F8FAFC]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all shadow-md shadow-[#6366F1]/20 flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {id ? "Save Changes" : "Submit Invoice"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main section: Info & Items table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Info */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              1. Supplier & Invoice Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Supplier *</label>
                <input type="hidden" {...register("supplier_id")} />
                <SupplierCombobox
                  value={watch("supplier_id")}
                  onChange={(val) => {
                    setValue("supplier_id", val, { shouldValidate: true });
                    const selectedSup = suppliers.find((s) => s.id === val);
                    if (selectedSup?.default_godown_id) {
                      setValue("godown_id", selectedSup.default_godown_id);
                    }
                  }}
                  suppliers={suppliers}
                  disabled={loadingSuppliers}
                  onAddNew={() => setNewSupplierModalOpen(true)}
                  placeholder="Select Supplier"
                />
                {errors.supplier_id && <p className="text-[10px] text-red-500 mt-1">{errors.supplier_id.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Destination Godown *</label>
                <select
                  disabled={loadingGodowns}
                  {...register("godown_id")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="">Select Godown</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {errors.godown_id && <p className="text-[10px] text-red-500 mt-1">{errors.godown_id.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Invoice Number *</label>
                <input
                  type="text"
                  placeholder="e.g. INV-12345"
                  {...register("invoice_no")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
                {errors.invoice_no && <p className="text-[10px] text-red-500 mt-1">{errors.invoice_no.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Invoice Date *</label>
                <input
                  type="date"
                  {...register("invoice_date")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
                {errors.invoice_date && <p className="text-[10px] text-red-500 mt-1">{errors.invoice_date.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Payment Terms</label>
                <select
                  {...register("payment_terms")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="immediate">Immediate / Cash</option>
                  <option value="15_days">15 Days</option>
                  <option value="30_days">30 Days</option>
                  <option value="45_days">45 Days</option>
                  <option value="60_days">60 Days</option>
                  <option value="90_days">90 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Due Date</label>
                <input
                  type="date"
                  {...register("due_date")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">GST Treatment *</label>
                <select
                  {...register("gst_type")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="with_gst">With GST (Standard)</option>
                  <option value="without_gst">Without GST (Kacha)</option>
                  <option value="reverse_charge">Reverse Charge (RCM)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items Grid */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
                2. Purchase Items
              </h2>
              <button
                type="button"
                onClick={() => append({ material_type_id: "", hsn_sac: "", unit: "meter", quantity: 0, rate: 0, discount_percent: 0, taxable_value: 0, gst_percent: 18, gst_amount: 0, amount: 0, item_type: "fabric", rolls: [] })}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-lg flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Material Row
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#CBD5E1] rounded-xl text-xs text-[#64748B]">
                No items added yet. Click &quot;Add Material Row&quot; to configure.
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-white rounded-xl border border-[#E2E8F0] space-y-4 relative shadow-sm">
                    {/* Item header with count and delete action */}
                    <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                      <span className="text-xs font-bold text-[#6366F1] bg-[#EEF2FF] px-2.5 py-1 rounded-md">Item #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 flex items-center gap-1 text-xs font-semibold"
                      >
                        <Trash2 className="h-4 w-4" /> Remove Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Item Type Toggle */}
                      <input type="hidden" {...register(`items.${index}.item_type` as const)} />
                      <div className="flex items-center gap-2 mb-3 bg-slate-50 p-1.5 rounded-lg border border-slate-100 w-fit">
                        <button
                          type="button"
                          onClick={() => {
                            setValue(`items.${index}.item_type`, "fabric");
                            setValue(`items.${index}.quantity`, 0);
                            recalcItem(index);
                          }}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${
                            (watchItems[index]?.item_type || "fabric") === "fabric"
                              ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                              : "text-[#64748B] hover:text-[#0F172A]"
                          }`}
                        >
                          Fabric (Roll-wise)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue(`items.${index}.item_type`, "accessory");
                            setValue(`items.${index}.quantity`, 1);
                            setValue(`items.${index}.rolls`, []); // clear rolls
                            recalcItem(index);
                          }}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${
                            watchItems[index]?.item_type === "accessory"
                              ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                              : "text-[#64748B] hover:text-[#0F172A]"
                          }`}
                        >
                          Accessory
                        </button>
                      </div>

                      {/* Row 1 */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-4">
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Raw Material Type *</label>
                          <input
                            type="hidden"
                            {...register(`items.${index}.material_type_id` as const)}
                          />
                          <MaterialTypeCombobox
                            value={watchItems[index]?.material_type_id || ""}
                            onChange={(val) => {
                              setValue(`items.${index}.material_type_id`, val);
                              handleMaterialChange(index, val);
                            }}
                            materialTypes={materialTypes}
                            disabled={loadingMaterials}
                            onAddNew={() => {
                              setNewTypeItemIndex(index);
                              setNewTypeModalOpen(true);
                            }}
                          />
                          {errors.items?.[index]?.material_type_id && (
                            <p className="text-[10px] text-red-500 mt-1">{errors.items[index]?.material_type_id?.message}</p>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">HSN/SAC</label>
                          <input
                            type="text"
                            placeholder="HSN"
                            {...register(`items.${index}.hsn_sac` as const)}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Unit</label>
                          <input
                            type="text"
                            placeholder="Unit"
                            {...register(`items.${index}.unit` as const)}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">
                            {(watchItems[index]?.item_type || "fabric") === "fabric" ? "Total Meters" : "Qty *"}
                          </label>
                          <NumericInput
                            step="0.01"
                            placeholder="0"
                            disabled={(watchItems[index]?.item_type || "fabric") === "fabric"}
                            {...register(`items.${index}.quantity` as const)}
                            onChange={(e) => {
                              register(`items.${index}.quantity` as const).onChange(e);
                              recalcItem(index);
                            }}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all disabled:bg-slate-50 disabled:text-slate-700"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Rate (₹) *</label>
                          <NumericInput
                            step="0.01"
                            placeholder="0.00"
                            {...register(`items.${index}.rate` as const)}
                            onChange={(e) => {
                              register(`items.${index}.rate` as const).onChange(e);
                              recalcItem(index);
                            }}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* Row 2 */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1.5">
                        <div className={watchGstType === "with_gst" ? "md:col-span-2" : "md:col-span-3"}>
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Disc (%)</label>
                          <NumericInput
                            placeholder="0"
                            {...register(`items.${index}.discount_percent` as const)}
                            onChange={(e) => {
                              register(`items.${index}.discount_percent` as const).onChange(e);
                              recalcItem(index);
                            }}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className={watchGstType === "with_gst" ? "md:col-span-3" : "md:col-span-4"}>
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Taxable</label>
                          <div className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-sm text-right font-mono font-bold text-slate-600 select-none">
                            ₹{Number(watchItems[index]?.taxable_value || 0).toFixed(2)}
                          </div>
                        </div>

                        {watchGstType === "with_gst" && (
                          <>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">GST %</label>
                              <NumericInput
                                {...register(`items.${index}.gst_percent` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.gst_percent` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">GST Amt</label>
                              <div className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-sm text-right font-mono font-bold text-slate-500 select-none">
                                ₹{Number(watchItems[index]?.gst_amount || 0).toFixed(2)}
                              </div>
                            </div>
                          </>
                        )}

                        <div className={watchGstType === "with_gst" ? "md:col-span-3" : "md:col-span-5"}>
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Total (₹)</label>
                          <div className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-sm text-right font-mono font-bold text-[#0F172A] select-none">
                            ₹{Number(watchItems[index]?.amount || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Rolls Sub-section */}
                      {((watchItems[index]?.item_type || "fabric") === "fabric") && (
                        <div className="mt-4 border-t border-[#F1F5F9] pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                                Fabric Roll Breakdown
                              </h4>
                              <p className="text-[10px] text-[#64748B] font-semibold mt-0.5">
                                Specify individual rolls. Total quantity is auto-calculated.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addRoll(index)}
                              className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-100 rounded hover:bg-indigo-50 flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Plus size={12} className="text-indigo-600" /> Add Roll
                            </button>
                          </div>

                          {(watchItems[index]?.rolls || []).length === 0 ? (
                            <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs font-semibold text-[#64748B]">
                              No rolls added yet. Click Add Roll.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(watchItems[index]?.rolls || []).map((roll: any, rollIndex: number) => (
                                <div key={rollIndex} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 items-end">
                                  {/* Roll Number */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[9px] font-bold text-[#64748B] uppercase">Roll No *</label>
                                    <input
                                      type="text"
                                      required
                                      className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded text-xs focus:ring-1 focus:ring-[#6366F1]"
                                      {...register(`items.${index}.rolls.${rollIndex}.roll_number` as const)}
                                    />
                                  </div>

                                  {/* Meters */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[9px] font-bold text-[#64748B] uppercase">Meters *</label>
                                    <NumericInput
                                      step="0.01"
                                      placeholder="0"
                                      className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded text-xs text-right font-bold"
                                      value={watchItems[index]?.rolls?.[rollIndex]?.meters || ""}
                                      onChange={(e) => {
                                        const meters = Number(e.target.value || 0);
                                        handleRollMetersChange(index, rollIndex, meters);
                                      }}
                                    />
                                  </div>

                                  {/* Shade */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[9px] font-bold text-[#64748B] uppercase">Shade *</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Indigo"
                                      required
                                      className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded text-xs"
                                      {...register(`items.${index}.rolls.${rollIndex}.shade` as const)}
                                    />
                                  </div>

                                  {/* Width */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[9px] font-bold text-[#64748B] uppercase">Width</label>
                                    <NumericInput
                                      placeholder="inch"
                                      className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded text-xs text-right"
                                      {...register(`items.${index}.rolls.${rollIndex}.width` as const)}
                                    />
                                  </div>

                                  {/* Weight Unit */}
                                  <div className="md:col-span-1.5 space-y-1">
                                    <label className="text-[9px] font-bold text-[#64748B] uppercase">Wt Unit</label>
                                    <select
                                      className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded text-xs"
                                      {...register(`items.${index}.rolls.${rollIndex}.weight_unit` as const)}
                                    >
                                      <option value="gsm">GSM</option>
                                      <option value="oz">Oz</option>
                                    </select>
                                  </div>

                                  {/* Weight Value */}
                                  <div className="md:col-span-1.5 space-y-1">
                                    <label className="text-[9px] font-bold text-[#64748B] uppercase">Wt Value</label>
                                    <NumericInput
                                      placeholder="Value"
                                      className="w-full h-8 px-2 bg-white border border-[#CBD5E1] rounded text-xs text-right"
                                      {...register(`items.${index}.rolls.${rollIndex}.weight_value` as const)}
                                    />
                                  </div>

                                  {/* Remove Roll */}
                                  <div className="md:col-span-1 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => removeRoll(index, rollIndex)}
                                      className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded flex items-center justify-center cursor-pointer transition-all border border-transparent hover:border-rose-100"
                                      title="Remove Roll"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Remarks & Notes */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-3 border-l-4 border-[#6366F1] pl-2.5">
              Remarks & Notes
            </h2>
            <textarea
              rows={3}
              placeholder="Internal notes or special instructions..."
              {...register("notes")}
              className="w-full p-2.5 border border-[#CBD5E1] rounded-lg text-xs"
            ></textarea>
          </div>
        </div>

        {/* Right Section: Totals, Attachments, Notes */}
        <div className="space-y-6">
          {/* Summary Panel */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
              3. Invoice Summary
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>Subtotal (Raw Items):</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>Total Discount (-) :</span>
                <span className="font-mono text-emerald-600">₹{(subtotal - totalTaxableValue).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>Taxable Value:</span>
                <span className="font-mono">₹{totalTaxableValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>GST Tax Value (+):</span>
                <span className="font-mono">₹{totalGstAmount.toFixed(2)}</span>
              </div>

              <div className="border-t border-[#E2E8F0] my-2" />

              {/* Additional Charges inputs */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#0F172A]">Additional Charges (₹)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-[#64748B] mb-0.5">Freight</label>
                    <NumericInput
                      placeholder="0.00"
                      {...register("freight")}
                      className="w-full px-2 py-1 border border-[#CBD5E1] rounded text-xs font-bold text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#64748B] mb-0.5">Loading</label>
                    <NumericInput
                      placeholder="0.00"
                      {...register("loading_unloading")}
                      className="w-full px-2 py-1 border border-[#CBD5E1] rounded text-xs font-bold text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#64748B] mb-0.5">Other</label>
                    <NumericInput
                      placeholder="0.00"
                      {...register("other_charges")}
                      className="w-full px-2 py-1 border border-[#CBD5E1] rounded text-xs font-bold text-right"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] my-2" />

              <div className="flex justify-between items-center bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                <span className="font-bold text-[#0F172A]">Grand Total (₹):</span>
                <span className="font-mono text-lg font-black text-[#6366F1]">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-[#E2E8F0] text-[10px] text-[#64748B] font-semibold italic">
                <span className="font-bold uppercase text-[9px] text-[#4F46E5] block not-italic">Amount in Words:</span>
                {grandTotalWords}
              </div>
            </div>
          </div>

          {/* Attachments Dropzone */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-3 border-l-4 border-[#6366F1] pl-2.5">
              4. Document Attachments
            </h2>
            <AttachmentDropzone
              selectedFiles={selectedFiles}
              onFilesSelected={async (files) => {
                const newFiles = [...selectedFiles];
                const currentUrls = watch("attachments") || [];
                const newUrls = [...currentUrls];
                for (const file of files) {
                  const result = await upload(file);
                  if (result.success) {
                    newFiles.push(file);
                    newUrls.push(result.url);
                  } else {
                    toast.error(result.error);
                  }
                }
                setSelectedFiles(newFiles);
                setValue("attachments", newUrls);
              }}
              onRemoveFile={(index) => {
                const newFiles = selectedFiles.filter((_, i) => i !== index);
                const currentUrls = watch("attachments") || [];
                const newUrls = currentUrls.filter((_, i) => i !== index);
                setSelectedFiles(newFiles);
                setValue("attachments", newUrls, { shouldDirty: true });
              }}
            />
          </div>
        </div>
      </div>

      {/* Inline Material Type Creation Dialog */}
      <Dialog open={newTypeModalOpen} onOpenChange={setNewTypeModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              Add New Raw Material Type
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateMaterialType} className="space-y-4 pt-2">
            {/* Material Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Material Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Cotton Drill Fabric, YKK Zipper"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A]"
                required
              />
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Category *
                </label>
                <select
                  value={newTypeCategory}
                  onChange={(e) => setNewTypeCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
                >
                  {["Fabric", "Thread", "Button", "Elastic", "Zipper", "Label", "Packaging", "Other"].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Unit *
                </label>
                <select
                  value={newTypeUnit}
                  onChange={(e) => setNewTypeUnit(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
                >
                  {["meter", "kg", "piece", "cone", "yard", "roll", "set"].map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Description
              </label>
              <textarea
                placeholder="Details or quality parameters..."
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                rows={2}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none text-[#0F172A]"
              />
            </div>

            {/* Reorder Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Reorder Alert Level
              </label>
              <input
                type="number"
                placeholder="0"
                value={newTypeReorderLevel}
                onChange={(e) => setNewTypeReorderLevel(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewTypeModalOpen(false);
                  setNewTypeItemIndex(null);
                }}
                disabled={creatingType}
                className="h-10 px-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingType}
                className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#6366F1]/10"
              >
                {creatingType ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Material"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inline Supplier Creation Dialog */}
      <Dialog open={newSupplierModalOpen} onOpenChange={setNewSupplierModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              Add New Supplier Party
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Supplier / Owner Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Sundar Pichai"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A]"
                required
              />
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Company / Business Name
              </label>
              <input
                type="text"
                placeholder="e.g. Google Inc"
                value={newSupplierCompany}
                onChange={(e) => setNewSupplierCompany(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A]"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A]"
              />
            </div>

            {/* GSTIN & PAN */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  GSTIN
                </label>
                <input
                  type="text"
                  placeholder="Defaults to URP"
                  value={newSupplierGstin}
                  onChange={(e) => setNewSupplierGstin(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A] uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  PAN Number
                </label>
                <input
                  type="text"
                  placeholder="Defaults to N/A"
                  value={newSupplierPan}
                  onChange={(e) => setNewSupplierPan(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A] uppercase"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setNewSupplierModalOpen(false)}
                disabled={savingNewSupplier}
                className="h-10 px-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSupplier}
                disabled={savingNewSupplier}
                className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#6366F1]/10"
              >
                {savingNewSupplier ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Supplier"
                )}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
