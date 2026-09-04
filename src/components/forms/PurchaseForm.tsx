"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { NumericInput } from "@/components/ui/numeric-input";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2, Search, Check, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { QuickAddDesignModal } from "@/components/forms/QuickAddDesignModal";
import { SizeQuantityMatrix } from "@/components/shared/SizeQuantityMatrix";
import { useGstRateLookup } from "@/hooks/useGstRateLookup";

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
  roll_number: z.string().optional(),
  meters: z.coerce.number().optional(),
  shade: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  design_name: z.string().optional().nullable(),
  comment: z.string().optional(),
  width: z.coerce.number().optional().nullable(),
  weight_unit: z.string().optional().nullable(),
  weight_value: z.coerce.number().optional().nullable(),
});

const purchaseItemSchema = z.object({
  material_type_id: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  design_name: z.string().optional().nullable(),
  design_id: z.string().optional().nullable(),
  colour_id: z.string().optional().nullable(),
  size_quantities: z.record(z.string(), z.coerce.number()).optional().default({}),
  other_item_name: z.string().optional().nullable(),
  other_category: z.enum(["capital_asset", "office_expense", "consumable"]).optional().nullable(),
  asset_tag: z.string().optional().nullable(),
  hsn_sac: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.coerce.number().min(0.001, "Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate must be 0 or greater"),
  discount_percent: z.coerce.number().min(0).max(100),
  taxable_value: z.coerce.number(),
  gst_percent: z.coerce.number().min(0).max(100),
  gst_amount: z.coerce.number(),
  amount: z.coerce.number(),
  item_type: z.enum(["fabric", "accessory", "finished_goods", "others"]).default("fabric"),
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
  payment_terms?: string | null;
}

interface MaterialType {
  id: string;
  name: string;
  unit: string;
  category?: string | null;
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
        className="w-full flex items-center justify-between px-3 h-10 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] disabled:opacity-50 select-none cursor-pointer"
      >
        <span className="truncate">{selectedType ? selectedType.name : placeholder}</span>
        <ChevronDown size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[300px]">
          {/* Search box */}
          <div className="p-2 border-b border-[var(--border)] flex items-center gap-1.5 bg-[var(--page-bg)]">
            <Search size={14} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none focus:ring-0 font-medium p-0.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto py-1 max-h-[200px]">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[var(--text-muted)] font-semibold text-center">
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
                    className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs font-semibold hover:bg-[var(--table-row-hover)] transition-colors select-none cursor-pointer ${
                      isSelected ? "text-[var(--primary)] bg-[var(--primary-light)] font-bold" : "text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="truncate">{m.name}</span>
                    {isSelected && <Check size={14} className="text-[var(--primary)] shrink-0" />}
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
            className="w-full h-10 px-3 border-t border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] text-xs font-bold text-[var(--primary)] flex items-center gap-1.5 transition-colors cursor-pointer justify-center select-none"
          >
            <Plus size={14} /> Add New Material Type
          </button>
        </div>
      )}
    </div>
  );
}

interface DesignComboboxProps {
  value: string;
  onChange: (val: string) => void;
  designs: any[];
  disabled?: boolean;
  onAddNew: () => void;
  placeholder?: string;
}

function DesignCombobox({
  value,
  onChange,
  designs,
  disabled = false,
  onAddNew,
  placeholder = "Select Design Code",
}: DesignComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDesign = designs.find((d) => d.id === value);
  const selectedLabel = selectedDesign
    ? `${selectedDesign.design_number || selectedDesign.name} - ${selectedDesign.name}`
    : placeholder;

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

  const filtered = designs.filter((d) => {
    const text = `${d.design_number || ""} ${d.name || ""}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 h-10 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] disabled:opacity-50 select-none cursor-pointer"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[300px]">
          <div className="p-2 border-b border-[var(--border)] flex items-center gap-1.5 bg-[var(--page-bg)]">
            <Search size={14} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              placeholder="Search design..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none focus:ring-0 font-medium p-0.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto py-1 max-h-[200px]">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[var(--text-muted)] font-semibold text-center">
                No matching designs
              </div>
            ) : (
              filtered.map((d) => {
                const isSelected = d.id === value;
                const label = `${d.design_number || d.name} - ${d.name}`;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onChange(d.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs font-semibold hover:bg-[var(--table-row-hover)] transition-colors select-none cursor-pointer ${
                      isSelected ? "text-[var(--primary)] bg-[var(--primary-light)] font-bold" : "text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isSelected && <Check size={14} className="text-[var(--primary)] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onAddNew();
              setIsOpen(false);
              setSearch("");
            }}
            className="w-full h-10 px-3 border-t border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] text-xs font-bold text-[var(--primary)] flex items-center gap-1.5 transition-colors cursor-pointer justify-center select-none"
          >
            <Plus size={14} /> Add New Design
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
        className="w-full flex items-center justify-between px-3 h-10 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] disabled:opacity-50 select-none cursor-pointer"
      >
        <span className="truncate">{selectedSupplier ? getLabel(selectedSupplier) : placeholder}</span>
        <ChevronDown size={16} className="text-[var(--text-muted)] ml-1 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[300px]">
          {/* Search box */}
          <div className="p-2 border-b border-[var(--border)] flex items-center gap-1.5 bg-[var(--page-bg)]">
            <Search size={14} className="text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              placeholder="Search supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none focus:ring-0 font-medium p-0.5 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="flex-1 overflow-y-auto py-1 max-h-[200px]">
            {filtered.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[var(--text-muted)] font-semibold text-center">
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
                    className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs font-semibold hover:bg-[var(--table-row-hover)] transition-colors select-none cursor-pointer ${
                      isSelected ? "text-[var(--primary)] bg-[var(--primary-light)] font-bold" : "text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="truncate">{label}</span>
                    {isSelected && <Check size={14} className="text-[var(--primary)] shrink-0" />}
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
            className="w-full h-10 px-3 border-t border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] text-xs font-bold text-[var(--primary)] flex items-center gap-1.5 transition-colors cursor-pointer justify-center select-none"
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
  const queryClient = useQueryClient();
  const { lookupGst, hsnOptions } = useGstRateLookup();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [godowns, setGodowns] = useState<any[]>([]);
  const [designs, setDesigns] = useState<any[]>([]);
  const [sizeSets, setSizeSets] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingGodowns, setLoadingGodowns] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [quickAddDesignOpen, setQuickAddDesignOpen] = useState(false);
  const [quickAddDesignItemIndex, setQuickAddDesignItemIndex] = useState<number | null>(null);
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
        grade: "Fresh",
        design_name: "",
        design_id: "",
        colour_id: "",
        size_quantities: {},
        other_item_name: "",
        other_category: "office_expense",
        asset_tag: "",
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
        rolls: [
          {
            roll_number: "R-1",
            meters: 0,
            shade: "",
            grade: "Fresh",
            design_name: "",
            weight_unit: "gsm",
          },
        ],
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

  // Auto-calculate due date when invoice date or payment terms change
  useEffect(() => {
    if (watchInvoiceDate && watchPaymentTerms) {
      const daysMap: Record<string, number> = {
        "15_days": 15,
        "30_days": 30,
        "45_days": 45,
        "60_days": 60,
        "90_days": 90,
        "immediate": 0,
      };
      const days = daysMap[watchPaymentTerms] ?? 0;
      const d = new Date(watchInvoiceDate);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + days);
        setValue("due_date", d.toISOString().split("T")[0]);
      }
    }
  }, [watchInvoiceDate, watchPaymentTerms, setValue]);

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
          const allMats = data.materialTypes || [];
          setMaterialTypes(allMats.filter((m: any) => m.is_active !== false));
        }
      } catch (err) {
        console.error("Failed to load material types");
      } finally {
        setLoadingMaterials(false);
      }
    }

    async function fetchDesignsAndSizeSets() {
      setLoadingDesigns(true);
      try {
        const [desRes, ssRes] = await Promise.all([
          fetch("/api/master-data/designs"),
          fetch("/api/master-data/size-sets"),
        ]);
        if (desRes.ok) {
          const data = await desRes.json();
          const allDes = data.designs || [];
          setDesigns(allDes.filter((d: any) => d.is_active !== false));
        }
        if (ssRes.ok) {
          const data = await ssRes.json();
          const allSS = data.sizeSets || [];
          setSizeSets(allSS.filter((s: any) => s.is_active !== false));
        }
      } catch (err) {
        console.error("Failed to load designs/size-sets:", err);
      } finally {
        setLoadingDesigns(false);
      }
    }

    fetchSuppliers();
    fetchMaterials();
    fetchDesignsAndSizeSets();

    async function fetchInventorySettings() {
      setLoadingGodowns(true);
      try {
        const res = await fetch("/api/settings/inventory");
        if (res.ok) {
          const data = await res.json();
          const allGodowns = data.godowns || [];
          setGodowns(allGodowns.filter((g: any) => g.is_active !== false));
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
      const matHsn = selectedMat.hsn_code || "";
      setValue(`items.${index}.hsn_sac`, matHsn);
      setValue(`items.${index}.unit`, selectedMat.unit || "Meters");

      const currentRate = Number(watchItems[index]?.rate || 0);
      const fallbackPct = selectedMat.gst_percent !== undefined && selectedMat.gst_percent !== null ? Number(selectedMat.gst_percent) : undefined;
      const resolved = lookupGst(matHsn, currentRate, fallbackPct);
      if (resolved) {
        setValue(`items.${index}.gst_percent`, resolved.gstPercent);
      } else if (fallbackPct !== undefined) {
        setValue(`items.${index}.gst_percent`, fallbackPct);
      }

      if (selectedMat.category) {
        const cat = selectedMat.category.toLowerCase();
        if (cat.includes("fabric")) {
          setValue(`items.${index}.item_type`, "fabric");
        } else if (cat.includes("accessory") || cat.includes("accessories") || cat.includes("trim")) {
          setValue(`items.${index}.item_type`, "accessory");
        }
      }
      // Trigger recalc
      recalcItem(index);
    }
  };

  // Handle manual HSN change on any item line
  const handleHsnChange = (index: number, newHsn: string) => {
    setValue(`items.${index}.hsn_sac`, newHsn);
    const currentRate = Number(watchItems[index]?.rate || 0);
    const resolved = lookupGst(newHsn, currentRate);
    if (resolved) {
      setValue(`items.${index}.gst_percent`, resolved.gstPercent);
    }
    recalcItem(index);
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
    let gstPct = Number(watchItems[index]?.gst_percent || 0);

    const itemHsn = watchItems[index]?.hsn_sac;
    if (itemHsn) {
      const resolved = lookupGst(itemHsn, rate);
      if (resolved && resolved.isAutoTier && resolved.gstPercent !== gstPct) {
        gstPct = resolved.gstPercent;
        setValue(`items.${index}.gst_percent`, gstPct);
      }
    }

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
  let rcmGstAmount = 0;

  watchItems.forEach((item) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const disc = Number(item.discount_percent || 0);
    const gstPct = Number(item.gst_percent || 0);

    const taxableValue = qty * rate * (1 - disc / 100);
    const gstAmount = watchGstType === "with_gst" ? (taxableValue * gstPct) / 100 : 0;
    const computedRcm = watchGstType === "reverse_charge" ? (taxableValue * gstPct) / 100 : 0;

    subtotal += qty * rate;
    totalTaxableValue += taxableValue;
    totalGstAmount += gstAmount;
    rcmGstAmount += computedRcm;
  });

  const totalOtherCharges = Number(watchFreight) + Number(watchLoading) + Number(watchOtherCharges);
  const grandTotal = totalTaxableValue + totalGstAmount + totalOtherCharges;
  const grandTotalWords = numberToWords(grandTotal);

  const onSubmit = async (values: PurchaseFormValues) => {
    try {
      // Validate that all fabric items have Grade filled
      for (let i = 0; i < values.items.length; i++) {
        const it = values.items[i];
        if ((it.item_type || "fabric") === "fabric" && !it.grade?.trim()) {
          toast.error(`Please enter Grade for Item #${i + 1} (e.g. Fresh / Grade A)`);
          return;
        }
      }

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

      queryClient.invalidateQueries({ queryKey: ["raw-material-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["raw-material-purchase-returns"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });

      toast.success(id ? "Purchase invoice updated successfully" : "Purchase invoice recorded successfully");
      router.push("/purchases");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    }
  };

  const onInvalid = (errors: any) => {
    console.error("Purchase form validation errors:", errors);
    if (errors.supplier_id) {
      toast.error("Please select a Supplier");
    } else if (errors.godown_id) {
      toast.error("Please select a Godown Location");
    } else if (errors.invoice_no) {
      toast.error("Please enter the Supplier Invoice Number");
    } else if (errors.invoice_date) {
      toast.error("Please select the Invoice Date");
    } else if (errors.items) {
      toast.error("Please check line items (ensure material/item selected and quantity > 0)");
    } else {
      const firstKey = Object.keys(errors)[0];
      const msg = errors[firstKey]?.message || "Please fill in all required fields";
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="max-w-[1400px] mx-auto space-y-6 pb-20 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/purchases" className="p-2 hover:bg-[var(--table-row-hover)] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[var(--text-muted)]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {id ? "Edit Purchase Invoice" : "Record Purchase Invoice"}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Inward raw material invoice entry with GST, fabric roll tracking, and party ledger posting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/purchases"
            className="px-4 py-2 text-sm font-semibold text-[var(--text-primary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit, onInvalid)}
            className="px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
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
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-4 border-l-4 border-[var(--primary)] pl-2.5">
              1. Supplier & Invoice Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Supplier *</label>
                <input type="hidden" {...register("supplier_id")} />
                <SupplierCombobox
                  value={watch("supplier_id")}
                  onChange={(val) => {
                    setValue("supplier_id", val, { shouldValidate: true });
                    const selectedSup = suppliers.find((s) => s.id === val);
                    if (selectedSup?.default_godown_id) {
                      setValue("godown_id", selectedSup.default_godown_id);
                    }
                    if (selectedSup?.payment_terms) {
                      setValue("payment_terms", selectedSup.payment_terms);
                      const invDate = watch("invoice_date");
                      if (invDate) {
                        const daysMap: Record<string, number> = {
                          "15_days": 15,
                          "30_days": 30,
                          "45_days": 45,
                          "60_days": 60,
                          "90_days": 90,
                          "immediate": 0,
                        };
                        const days = daysMap[selectedSup.payment_terms] ?? 0;
                        const d = new Date(invDate);
                        d.setDate(d.getDate() + days);
                        setValue("due_date", d.toISOString().split("T")[0]);
                      }
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
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Destination Godown *</label>
                <select
                  disabled={loadingGodowns}
                  {...register("godown_id")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] text-[var(--text-primary)]"
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
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Our Purchase Ref No. (Auto)</label>
                <input
                  type="text"
                  disabled
                  value={initialData?.purchase_number || "(Auto Generated)"}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--page-bg)] font-mono text-[var(--primary)] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Supplier Invoice No. *</label>
                <input
                  type="text"
                  placeholder="e.g. SUP-INV-2026-001"
                  {...register("invoice_no")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm font-mono"
                />
                {errors.invoice_no && <p className="text-[10px] text-red-500 mt-1">{errors.invoice_no.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Supplier Invoice Date *</label>
                <input
                  type="date"
                  {...register("invoice_date")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm"
                />
                {errors.invoice_date && <p className="text-[10px] text-red-500 mt-1">{errors.invoice_date.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Payment Terms</label>
                <select
                  {...register("payment_terms")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm"
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
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Due Date</label>
                <input
                  type="date"
                  {...register("due_date")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--page-bg)] text-[var(--text-primary)] rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">GST Treatment *</label>
                <select
                  {...register("gst_type")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm"
                >
                  <option value="with_gst">With GST (Standard)</option>
                  <option value="without_gst">Without GST (Kacha)</option>
                  <option value="reverse_charge">Reverse Charge (RCM)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items Grid */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-[var(--primary)] pl-2.5">
                2. Purchase Items
              </h2>
              <button
                type="button"
                onClick={() => append({ material_type_id: "", grade: "Fresh", design_name: "", design_id: "", colour_id: "", size_quantities: {}, other_item_name: "", other_category: "office_expense", asset_tag: "", hsn_sac: "", unit: "meter", quantity: 0, rate: 0, discount_percent: 0, taxable_value: 0, gst_percent: 18, gst_amount: 0, amount: 0, item_type: "fabric", rolls: [{ roll_number: "R-1", meters: 0, shade: "", grade: "Fresh", design_name: "", weight_unit: "gsm" }] })}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg flex items-center gap-1 cursor-pointer transition-all"
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
                  <div key={field.id} className="p-4 bg-[var(--card-bg)] rounded-xl border border-[var(--border)] space-y-4 relative shadow-[var(--shadow-sm)]">
                    {/* Item header with count and delete action */}
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <span className="text-xs font-bold text-[var(--primary)] bg-[var(--primary-light)] px-2.5 py-1 rounded-md">Item #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors border border-transparent hover:border-red-200 flex items-center gap-1 text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" /> Remove Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* Item Type Toggle - 4 Tabs */}
                      <input type="hidden" {...register(`items.${index}.item_type` as const)} />
                      <div className="flex items-center gap-1.5 mb-3 bg-[var(--page-bg)] p-1.5 rounded-lg border border-[var(--border)] w-fit flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setValue(`items.${index}.item_type`, "fabric");
                            setValue(`items.${index}.unit`, "meter");
                            setValue(`items.${index}.quantity`, 0);
                            recalcItem(index);
                          }}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${
                            (watchItems[index]?.item_type || "fabric") === "fabric"
                              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          Fabric (Roll-wise)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue(`items.${index}.item_type`, "accessory");
                            setValue(`items.${index}.unit`, "Pcs");
                            setValue(`items.${index}.quantity`, 1);
                            setValue(`items.${index}.rolls`, []);
                            recalcItem(index);
                          }}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${
                            watchItems[index]?.item_type === "accessory"
                              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          Accessory
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue(`items.${index}.item_type`, "finished_goods");
                            setValue(`items.${index}.unit`, "Pcs");
                            setValue(`items.${index}.quantity`, 0);
                            setValue(`items.${index}.rolls`, []);
                            recalcItem(index);
                          }}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${
                            watchItems[index]?.item_type === "finished_goods"
                              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          Finished Goods
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setValue(`items.${index}.item_type`, "others");
                            setValue(`items.${index}.unit`, "Pcs");
                            setValue(`items.${index}.quantity`, 1);
                            setValue(`items.${index}.rolls`, []);
                            recalcItem(index);
                          }}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${
                            watchItems[index]?.item_type === "others"
                              ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-sm border border-[var(--border)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          Others (Assets/Expenses)
                        </button>
                      </div>

                      {/* Row 1 & 2 - Conditional based on item_type */}
                      {watchItems[index]?.item_type === "finished_goods" ? (
                        <div className="space-y-3">
                          {/* Row 1: Design, Color, HSN */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-5">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Design Code *</label>
                              <input type="hidden" {...register(`items.${index}.design_id` as const)} />
                              <DesignCombobox
                                value={watchItems[index]?.design_id || ""}
                                onChange={(val) => {
                                  setValue(`items.${index}.design_id`, val);
                                  const selectedDes = designs.find((d) => d.id === val);
                                  if (selectedDes?.hsn_code) {
                                    setValue(`items.${index}.hsn_sac`, selectedDes.hsn_code);
                                    const currentRate = Number(watchItems[index]?.rate || 0);
                                    const resolved = lookupGst(selectedDes.hsn_code, currentRate);
                                    if (resolved) {
                                      setValue(`items.${index}.gst_percent`, resolved.gstPercent);
                                    }
                                  }
                                  if (selectedDes?.design_colours?.length) {
                                    setValue(`items.${index}.colour_id`, selectedDes.design_colours[0].id);
                                  }
                                  recalcItem(index);
                                }}
                                designs={designs}
                                disabled={loadingDesigns}
                                onAddNew={() => {
                                  setQuickAddDesignItemIndex(index);
                                  setQuickAddDesignOpen(true);
                                }}
                              />
                            </div>

                            <div className="md:col-span-4">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Color *</label>
                              <select
                                {...register(`items.${index}.colour_id` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent font-semibold text-[var(--text-primary)] truncate cursor-pointer transition-colors"
                              >
                                <option value="">Select Color</option>
                                {(() => {
                                  const selectedDes = designs.find((d) => d.id === watchItems[index]?.design_id);
                                  return (selectedDes?.design_colours || []).map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.colour_name}
                                    </option>
                                  ));
                                })()}
                              </select>
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">HSN/SAC</label>
                              <input
                                type="text"
                                list="purchase-hsn-datalist"
                                placeholder="6109"
                                value={watchItems[index]?.hsn_sac || ""}
                                onChange={(e) => handleHsnChange(index, e.target.value)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>

                          {/* Row 2: Total Pcs, Unit, Rate, Discount */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Total Pcs (Size Breakdown)</label>
                              <NumericInput
                                disabled
                                value={watchItems[index]?.quantity || 0}
                                className="w-full h-10 px-3 border border-[var(--input-border)] rounded-lg text-sm text-right font-bold bg-[var(--page-bg)] text-[var(--text-primary)] font-mono truncate select-none cursor-not-allowed"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Unit</label>
                              <input
                                type="text"
                                placeholder="Pcs"
                                {...register(`items.${index}.unit` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Rate/Pc (₹) *</label>
                              <NumericInput
                                step="0.01"
                                placeholder="0.00"
                                {...register(`items.${index}.rate` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.rate` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Discount (%)</label>
                              <NumericInput
                                placeholder="0"
                                {...register(`items.${index}.discount_percent` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.discount_percent` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      ) : watchItems[index]?.item_type === "others" ? (
                        <div className="space-y-3">
                          {/* Row 1: Item Description, Category, HSN/SAC */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-5">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Item / Expense Description *</label>
                              <input
                                type="text"
                                placeholder="e.g. 55-inch TV / Office Table"
                                {...register(`items.${index}.other_item_name` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-4">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Category</label>
                              <select
                                {...register(`items.${index}.other_category` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] rounded-lg text-sm bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent font-semibold text-[var(--text-primary)] cursor-pointer truncate transition-colors"
                              >
                                <option value="capital_asset">Capital Asset (TV/Table)</option>
                                <option value="office_expense">Office Expense (Stationery)</option>
                                <option value="consumable">Consumable (Cleaning)</option>
                              </select>
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">HSN/SAC</label>
                              <input
                                type="text"
                                list="purchase-hsn-datalist"
                                placeholder="HSN/SAC"
                                value={watchItems[index]?.hsn_sac || ""}
                                onChange={(e) => handleHsnChange(index, e.target.value)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>

                          {/* Row 2: Qty, Unit, Rate, Discount */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Qty *</label>
                              <NumericInput
                                step="0.01"
                                placeholder="1"
                                {...register(`items.${index}.quantity` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.quantity` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Unit</label>
                              <input
                                type="text"
                                placeholder="Pcs"
                                {...register(`items.${index}.unit` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Rate (₹) *</label>
                              <NumericInput
                                step="0.01"
                                placeholder="0.00"
                                {...register(`items.${index}.rate` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.rate` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Discount (%)</label>
                              <NumericInput
                                placeholder="0"
                                {...register(`items.${index}.discount_percent` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.discount_percent` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (watchItems[index]?.item_type || "fabric") === "fabric" ? (
                        <div className="space-y-3">
                          {/* Row 1: Material Type, Design Name, Grade, HSN/SAC */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-4">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Raw Material Type *</label>
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

                            <div className="md:col-span-4">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Design Name</label>
                              <input
                                type="text"
                                placeholder="e.g. Solid Indigo / Floral Print"
                                {...register(`items.${index}.design_name` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Grade *</label>
                              <input
                                type="text"
                                placeholder="e.g. Fresh / Grade A"
                                {...register(`items.${index}.grade` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">HSN/SAC</label>
                              <input
                                type="text"
                                list="purchase-hsn-datalist"
                                placeholder="e.g. 520811"
                                value={watchItems[index]?.hsn_sac || ""}
                                onChange={(e) => handleHsnChange(index, e.target.value)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>

                          {/* Row 2: Total Meters, Unit, Rate, Discount */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
                                Total Meters (Rolls Total)
                              </label>
                              <NumericInput
                                step="0.01"
                                placeholder="0.00"
                                disabled={true}
                                {...register(`items.${index}.quantity` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--page-bg)] text-[var(--text-primary)] rounded-lg text-sm text-right font-mono font-bold focus:outline-none disabled:opacity-90 transition-colors select-none cursor-not-allowed"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Unit</label>
                              <input
                                type="text"
                                placeholder="meter"
                                {...register(`items.${index}.unit` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Rate (₹/m) *</label>
                              <NumericInput
                                step="0.01"
                                placeholder="0.00"
                                {...register(`items.${index}.rate` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.rate` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Discount (%)</label>
                              <NumericInput
                                placeholder="0"
                                {...register(`items.${index}.discount_percent` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.discount_percent` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Row 1: Raw Material Type, HSN/SAC */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-8">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Raw Material / Accessory Type *</label>
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

                            <div className="md:col-span-4">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">HSN/SAC</label>
                              <input
                                type="text"
                                list="purchase-hsn-datalist"
                                placeholder="HSN"
                                value={watchItems[index]?.hsn_sac || ""}
                                onChange={(e) => handleHsnChange(index, e.target.value)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>

                          {/* Row 2: Qty, Unit, Rate, Discount */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Qty *</label>
                              <NumericInput
                                step="0.01"
                                placeholder="0"
                                {...register(`items.${index}.quantity` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.quantity` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Unit</label>
                              <input
                                type="text"
                                placeholder="Pcs"
                                {...register(`items.${index}.unit` as const)}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Rate (₹) *</label>
                              <NumericInput
                                step="0.01"
                                placeholder="0.00"
                                {...register(`items.${index}.rate` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.rate` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Discount (%)</label>
                              <NumericInput
                                placeholder="0"
                                {...register(`items.${index}.discount_percent` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.discount_percent` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Row 3: Taxable, GST %, GST Amt, Total Summary Bar */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-[var(--border-light)]">
                        <div className={watchGstType === "with_gst" ? "md:col-span-3" : "md:col-span-6"}>
                          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Taxable Value</label>
                          <div className="w-full h-10 px-3 flex items-center justify-end bg-[var(--page-bg)] border border-[var(--border)] rounded-lg text-sm text-right font-mono font-bold text-[var(--text-secondary)] select-none overflow-x-auto whitespace-nowrap scrollbar-none">
                            {formatCurrency(Number(watchItems[index]?.taxable_value || 0))}
                          </div>
                        </div>

                        {watchGstType === "with_gst" && (
                          <>
                            <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">GST %</label>
                              <NumericInput
                                {...register(`items.${index}.gst_percent` as const)}
                                onChange={(e) => {
                                  register(`items.${index}.gst_percent` as const).onChange(e);
                                  recalcItem(index);
                                }}
                                className="w-full h-10 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">GST Amount</label>
                              <div className="w-full h-10 px-3 flex items-center justify-end bg-[var(--page-bg)] border border-[var(--border)] rounded-lg text-sm text-right font-mono font-bold text-[var(--text-muted)] select-none overflow-x-auto whitespace-nowrap scrollbar-none">
                                {formatCurrency(Number(watchItems[index]?.gst_amount || 0))}
                              </div>
                            </div>
                          </>
                        )}

                        <div className={watchGstType === "with_gst" ? "md:col-span-4" : "md:col-span-6"}>
                          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Total Item Amount (₹)</label>
                          <div className="w-full h-10 px-3 flex items-center justify-end bg-[var(--page-bg)] border border-[var(--border)] rounded-lg text-sm text-right font-mono font-bold text-[var(--text-primary)] select-none overflow-x-auto whitespace-nowrap scrollbar-none">
                            {formatCurrency(Number(watchItems[index]?.amount || 0))}
                          </div>
                        </div>
                      </div>

                      {/* Finished Goods Size Set Breakdown */}
                      {watchItems[index]?.item_type === "finished_goods" && (
                        <div className="mt-4 border-t border-[var(--border)] pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                                Size Set Quantity Breakdown
                              </h4>
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold mt-0.5">
                                Enter piece quantities for each size. Total Pcs will auto-calculate.
                              </p>
                            </div>
                          </div>

                          {(() => {
                            const selectedDes = designs.find((d) => d.id === watchItems[index]?.design_id);
                            const sizes = selectedDes?.size_set?.sizes || ["S", "M", "L", "XL", "XXL", "3XL"];
                            const currentSizeQs = watchItems[index]?.size_quantities || {};

                            return (
                              <SizeQuantityMatrix
                                sizes={sizes}
                                sizeQuantities={currentSizeQs}
                                sizeSetName={selectedDes?.size_set?.name}
                                showAllColorsOption={true}
                                autoFillAllColors={(watchItems[index] as any)?.apply_all_colors || false}
                                onAutoFillAllColorsChange={(checked) => {
                                  setValue(`items.${index}.apply_all_colors` as any, checked);
                                  if (checked && selectedDes?.design_colours?.length) {
                                    const allColours = selectedDes.design_colours;
                                    const currentItem = watchItems[index];
                                    // Add remaining colours for this design with same size quantities
                                    allColours.forEach((col: any) => {
                                      if (col.id !== currentItem.colour_id) {
                                        const total = Object.values(currentSizeQs).reduce((a, b) => Number(a) + Number(b), 0);
                                        append({
                                          item_type: "finished_goods",
                                          design_id: currentItem.design_id,
                                          colour_id: col.id,
                                          size_quantities: { ...currentSizeQs },
                                          quantity: total,
                                          rate: currentItem.rate || 0,
                                          amount: total * (currentItem.rate || 0),
                                          hsn_sac: currentItem.hsn_sac || "",
                                          unit: "Pcs",
                                          discount_percent: currentItem.discount_percent || 0,
                                          gst_percent: currentItem.gst_percent || 0,
                                        } as any);
                                      }
                                    });
                                    toast.success(`Applied size breakdown to all ${allColours.length} colours of design`);
                                  }
                                }}
                                onChange={(updated) => {
                                  setValue(`items.${index}.size_quantities`, updated);
                                  const total = Object.values(updated).reduce((a, b) => Number(a) + Number(b), 0);
                                  setValue(`items.${index}.quantity`, total);
                                  recalcItem(index);
                                }}
                              />
                            );
                          })()}
                        </div>
                      )}

                      {/* Rolls Sub-section */}
                      {((watchItems[index]?.item_type || "fabric") === "fabric") && (
                        <div className="mt-4 border-t border-[var(--border)] pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                                Fabric Roll Breakdown
                              </h4>
                              <p className="text-[10px] text-[var(--text-muted)] font-semibold mt-0.5">
                                Specify individual rolls. Total quantity is auto-calculated.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addRoll(index)}
                              className="px-2.5 py-1 text-[10px] font-bold text-[var(--primary)] border border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] rounded flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Plus size={12} className="text-[var(--primary)]" /> Add Roll
                            </button>
                          </div>

                          {(watchItems[index]?.rolls || []).length === 0 ? (
                            <div className="text-center py-4 bg-[var(--page-bg)] border border-dashed border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-muted)]">
                              No rolls added yet. Click Add Roll.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {(watchItems[index]?.rolls || []).map((roll: any, rollIndex: number) => (
                                <div key={rollIndex} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)] items-end">
                                  {/* Roll Number */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Roll No *</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="R-1"
                                      className="w-full h-9 px-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                                      {...register(`items.${index}.rolls.${rollIndex}.roll_number` as const)}
                                    />
                                  </div>

                                  {/* Meters */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Meters *</label>
                                    <NumericInput
                                      step="0.01"
                                      placeholder="0.00"
                                      className="w-full h-9 px-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                                      value={watchItems[index]?.rolls?.[rollIndex]?.meters ?? ""}
                                      onChange={(e) => {
                                        const meters = Number(e.target.value || 0);
                                        handleRollMetersChange(index, rollIndex, meters);
                                      }}
                                    />
                                  </div>

                                  {/* Shade */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Shade *</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Indigo"
                                      required
                                      className="w-full h-9 px-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                                      {...register(`items.${index}.rolls.${rollIndex}.shade` as const)}
                                    />
                                  </div>

                                  {/* Width */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Width (inch)</label>
                                    <NumericInput
                                      placeholder="e.g. 58"
                                      className="w-full h-9 px-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                                      {...register(`items.${index}.rolls.${rollIndex}.width` as const)}
                                    />
                                  </div>

                                  {/* Weight Unit */}
                                  <div className="md:col-span-1 space-y-1">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Wt Unit</label>
                                    <select
                                      className="w-full h-9 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors uppercase"
                                      {...register(`items.${index}.rolls.${rollIndex}.weight_unit` as const)}
                                    >
                                      <option value="gsm">GSM</option>
                                      <option value="oz">Oz</option>
                                    </select>
                                  </div>

                                  {/* Weight Value */}
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Wt Value</label>
                                    <NumericInput
                                      placeholder="Value"
                                      className="w-full h-9 px-2.5 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                                      {...register(`items.${index}.rolls.${rollIndex}.weight_value` as const)}
                                    />
                                  </div>

                                  {/* Remove Roll Button */}
                                  <div className="md:col-span-1 flex justify-end pb-0.5">
                                    <button
                                      type="button"
                                      onClick={() => removeRoll(index, rollIndex)}
                                      className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center justify-center cursor-pointer transition-colors border border-transparent hover:border-rose-200"
                                      title="Remove Roll"
                                    >
                                      <Trash2 size={15} />
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
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-3 border-l-4 border-[var(--primary)] pl-2.5">
              Remarks & Notes
            </h2>
            <textarea
              rows={3}
              placeholder="Internal notes or special instructions..."
              {...register("notes")}
              className="w-full p-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
            ></textarea>
          </div>
        </div>

        {/* Right Section: Totals, Attachments, Notes */}
        <div className="space-y-6">
          {/* Summary Panel */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-[var(--primary)] pl-2.5">
              3. Invoice Summary
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[var(--text-muted)] font-semibold">
                <span>Subtotal (Raw Items):</span>
                <span className="font-mono text-[var(--text-primary)] font-bold">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)] font-semibold">
                <span>Total Discount (-) :</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{(subtotal - totalTaxableValue).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)] font-semibold">
                <span>Taxable Value:</span>
                <span className="font-mono text-[var(--text-primary)] font-bold">₹{totalTaxableValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-muted)] font-semibold">
                <span>GST Tax Value (+):</span>
                <span className="font-mono text-[var(--text-primary)] font-bold">₹{totalGstAmount.toFixed(2)}</span>
              </div>

              {watchGstType === "reverse_charge" && (
                <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1">
                  <div className="flex justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                    <span>⚡ RCM Tax (Payable to Govt):</span>
                    <span className="font-mono">₹{rcmGstAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                    Supplier gets net ₹{grandTotal.toFixed(2)}. RCM tax ₹{rcmGstAmount.toFixed(2)} is paid directly to GST portal & claimed as Input Credit.
                  </p>
                </div>
              )}

              <div className="border-t border-[var(--border)] my-2" />

              {/* Additional Charges inputs */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">Additional Charges (₹)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-[var(--text-muted)] mb-0.5">Freight</label>
                    <NumericInput
                      placeholder="0.00"
                      {...register("freight")}
                      className="w-full px-2 py-1 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[var(--text-muted)] mb-0.5">Loading</label>
                    <NumericInput
                      placeholder="0.00"
                      {...register("loading_unloading")}
                      className="w-full px-2 py-1 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[var(--text-muted)] mb-0.5">Other</label>
                    <NumericInput
                      placeholder="0.00"
                      {...register("other_charges")}
                      className="w-full px-2 py-1 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] rounded text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border)] my-2" />

              <div className="flex justify-between items-center bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)]">
                <span className="font-bold text-[var(--text-primary)]">Grand Total (₹):</span>
                <span className="font-mono text-lg font-black text-[var(--primary)]">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="bg-[var(--page-bg)] p-2.5 rounded border border-[var(--border)] text-[10px] text-[var(--text-muted)] font-semibold italic">
                <span className="font-bold uppercase text-[9px] text-[var(--primary)] block not-italic">Amount in Words:</span>
                {grandTotalWords}
              </div>
            </div>
          </div>

          {/* Attachments Dropzone */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mb-3 border-l-4 border-[var(--primary)] pl-2.5">
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
        <DialogContent className="sm:max-w-md bg-[var(--card-bg)] rounded-xl shadow-lg border border-[var(--border)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
              Add New Raw Material Type
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateMaterialType} className="space-y-4 pt-2">
            {/* Material Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Material Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Cotton Drill Fabric, YKK Zipper"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
                required
              />
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Category *
                </label>
                <select
                  value={newTypeCategory}
                  onChange={(e) => setNewTypeCategory(e.target.value)}
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all cursor-pointer font-semibold text-[var(--text-primary)]"
                >
                  {["Fabric", "Thread", "Button", "Elastic", "Zipper", "Label", "Packaging", "Other"].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Unit *
                </label>
                <select
                  value={newTypeUnit}
                  onChange={(e) => setNewTypeUnit(e.target.value)}
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all cursor-pointer font-semibold text-[var(--text-primary)]"
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
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Description
              </label>
              <textarea
                placeholder="Details or quality parameters..."
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                rows={2}
                className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all resize-none text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
              />
            </div>

            {/* Reorder Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Reorder Alert Level
              </label>
              <input
                type="number"
                placeholder="0"
                value={newTypeReorderLevel}
                onChange={(e) => setNewTypeReorderLevel(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all text-[var(--text-primary)]"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewTypeModalOpen(false);
                  setNewTypeItemIndex(null);
                }}
                disabled={creatingType}
                className="h-10 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-body)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingType}
                className="h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
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
        <DialogContent className="sm:max-w-md bg-[var(--card-bg)] rounded-xl shadow-lg border border-[var(--border)] text-[var(--text-primary)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[var(--text-primary)]">
              Add New Supplier Party
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Supplier / Owner Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Sundar Pichai"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
                required
              />
            </div>

            {/* Company Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Company / Business Name
              </label>
              <input
                type="text"
                placeholder="e.g. Google Inc"
                value={newSupplierCompany}
                onChange={(e) => setNewSupplierCompany(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
              />
            </div>

            {/* GSTIN & PAN */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  GSTIN
                </label>
                <input
                  type="text"
                  placeholder="Defaults to URP"
                  value={newSupplierGstin}
                  onChange={(e) => setNewSupplierGstin(e.target.value)}
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-faint)] uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  PAN Number
                </label>
                <input
                  type="text"
                  placeholder="Defaults to N/A"
                  value={newSupplierPan}
                  onChange={(e) => setNewSupplierPan(e.target.value)}
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-faint)] uppercase"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setNewSupplierModalOpen(false)}
                disabled={savingNewSupplier}
                className="h-10 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-body)] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSupplier}
                disabled={savingNewSupplier}
                className="h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
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

      {/* Quick Add Design Modal */}
      <QuickAddDesignModal
        open={quickAddDesignOpen}
        onOpenChange={setQuickAddDesignOpen}
        sizeSets={sizeSets}
        onDesignCreated={(newDesign) => {
          setDesigns((prev) => [...prev, newDesign]);
          if (quickAddDesignItemIndex !== null) {
            setValue(`items.${quickAddDesignItemIndex}.design_id`, newDesign.id, { shouldValidate: true });
            if (newDesign.hsn_code) {
              setValue(`items.${quickAddDesignItemIndex}.hsn_sac`, newDesign.hsn_code);
              const currentRate = Number(watchItems[quickAddDesignItemIndex]?.rate || 0);
              const resolved = lookupGst(newDesign.hsn_code, currentRate);
              if (resolved) {
                setValue(`items.${quickAddDesignItemIndex}.gst_percent`, resolved.gstPercent);
              }
              recalcItem(quickAddDesignItemIndex);
            }
            if (newDesign.design_colours && newDesign.design_colours.length > 0) {
              setValue(`items.${quickAddDesignItemIndex}.colour_id`, newDesign.design_colours[0].id);
            }
            const sizeList = newDesign.size_set?.sizes || ["S", "M", "L", "XL"];
            const initialSizeQty: Record<string, number> = {};
            sizeList.forEach((sz: string) => {
              initialSizeQty[sz] = 0;
            });
            setValue(`items.${quickAddDesignItemIndex}.size_quantities`, initialSizeQty);
          }
        }}
      />

      <datalist id="purchase-hsn-datalist">
        {hsnOptions.map((opt) => (
          <option key={opt.hsn_code} value={opt.hsn_code}>
            {opt.label}
          </option>
        ))}
      </datalist>
    </form>
  );
}
