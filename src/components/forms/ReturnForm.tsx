"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { NumericInput } from "@/components/ui/numeric-input";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2, Search, Check, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { AttachmentDropzone } from "@/components/shared/AttachmentDropzone";
import { useFileUpload } from "@/hooks/useFileUpload";
import { cn } from "@/lib/utils";
import { SizeQuantityMatrix } from "@/components/shared/SizeQuantityMatrix";

const returnItemSchema = z.object({
  purchase_item_id: z.string().optional(),
  material_type_id: z.string().optional().nullable(),
  design_id: z.string().optional().nullable(),
  colour_id: z.string().optional().nullable(),
  size_quantities: z.record(z.string(), z.coerce.number()).optional().default({}),
  invoice_size_quantities: z.record(z.string(), z.coerce.number()).optional().default({}),
  sizes: z.array(z.string()).optional().default([]),
  size_set_name: z.string().optional(),
  material_name: z.string().optional(), // display helper
  hsn_sac: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  invoice_qty: z.coerce.number().min(0.01),
  returned_qty: z.coerce.number().min(0, "Cannot be negative"),
  rate: z.coerce.number().min(0.01),
  discount_percent: z.coerce.number(),
  taxable_value: z.coerce.number(),
  gst_percent: z.coerce.number().default(0),
  gst_amount: z.coerce.number().default(0),
  amount: z.coerce.number().default(0),
  item_type: z.enum(["fabric", "accessory", "finished_goods", "others"]).default("fabric"),
  rolls: z.array(z.object({
    id: z.string(),
    roll_number: z.string(),
    shade: z.string(),
    meters: z.number(),
    remaining_meters: z.number(),
    return_meters: z.coerce.number().optional().default(0),
    selected: z.boolean().default(false),
  })).optional().default([]),
});

const returnSchema = z.object({
  purchase_id: z.string().min(1, "Original Purchase Invoice is required"),
  supplier_id: z.string().min(1, "Supplier is required"),
  return_date: z.string().min(1, "Return Date is required"),
  return_type: z.string(),
  reason: z.string().min(1, "Reason for Return is required"),
  godown_id: z.string().min(1, "Godown is required for inventory return"),
  challan_no: z.string().optional(),
  remarks: z.string().optional(),
  gst_type: z.string().default("with_gst"),
  generate_debit_note: z.boolean(),
  attachments: z.array(z.string()),
  status: z.string(),
  items: z.array(returnItemSchema).min(1, "At least one item must be returned"),
});

type ReturnFormValues = z.infer<typeof returnSchema>;

interface PurchaseInvoice {
  id: string;
  purchase_number: string;
  invoice_no: string;
  supplier_id: string;
  supplier?: {
    name: string;
  };
}

interface Godown {
  id: string;
  name: string;
}

interface ReturnFormProps {
  initialData?: any;
  id?: string;
}

export function ReturnForm({ initialData, id }: ReturnFormProps = {}) {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { upload, uploading } = useFileUpload("returns");

  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceDropdownOpen, setInvoiceDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setInvoiceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isEditMode = !!id;

  const defaultValues: ReturnFormValues = {
    purchase_id: "",
    supplier_id: "",
    return_date: new Date().toISOString().split("T")[0],
    return_type: "material_return",
    reason: "",
    godown_id: "",
    gst_type: "with_gst",
    challan_no: "",
    remarks: "",
    generate_debit_note: true,
    attachments: [],
    status: "completed",
    items: [],
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReturnFormValues>({
    resolver: zodResolver(returnSchema) as any,
    defaultValues: initialData ? { ...defaultValues, ...initialData } : defaultValues,
  });

  const { fields, replace } = useFieldArray({
    control,
    name: "items",
  });

  const watchPurchaseId = watch("purchase_id");
  const watchItems = watch("items") || [];
  const watchSupplierId = watch("supplier_id");
  const watchDebitNote = watch("generate_debit_note");

  // Fetch list of godowns and purchases
  useEffect(() => {
    async function loadData() {
      setLoadingPurchases(true);
      try {
        const pRes = await fetch("/api/raw-materials/purchases");
        if (pRes.ok) {
          const pData = await pRes.json();
          setPurchases(pData.purchases || []);
        }
      } catch (err) {
        console.error("Failed to load initial data");
      } finally {
        setLoadingPurchases(false);
      }
    }

    // Let's load godowns
    async function loadGodowns() {
      try {
        const res = await fetch("/api/master-data/godowns");
        if (res.ok) {
          const data = await res.json();
          setGodowns(data.godowns || []);
        }
      } catch (err) {
        console.error(err);
      }
    }

    loadData();
    loadGodowns();
  }, []);

  // Fetch purchase details (items and supplier) when selected purchase changes
  useEffect(() => {
    if (watchPurchaseId) {
      setLoadingInvoiceDetail(true);
      fetch(`/api/raw-materials/purchases/${watchPurchaseId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.purchase) {
            const p = data.purchase;
            setValue("supplier_id", p.supplier_id);
            if (p.godown_id) {
              setValue("godown_id", p.godown_id);
            }
            if (p.gst_type) {
              setValue("gst_type", p.gst_type);
            }

            const itemsList = data.purchase?.items || data.items || [];
            const returnItems = itemsList.map((it: any) => {
              const rollsList = it.rolls || [];
              const category = it.material_type?.category?.toLowerCase() || "";
              const isFinishedGood = it.item_type === "finished_goods" || !!it.design_id;
              const isOthers = it.item_type === "others";
              const isFabricItem = (it.item_type === "fabric" || category === "fabric") && rollsList.length > 0;
              const calculatedType = isFinishedGood
                ? "finished_goods"
                : isOthers
                ? "others"
                : isFabricItem
                ? "fabric"
                : "accessory";

              const materialName = calculatedType === "finished_goods"
                ? `${it.design?.design_number || it.design?.name || "Finished Good"} ${it.colour?.colour_name ? `(${it.colour.colour_name})` : ""}`
                : calculatedType === "others"
                ? it.other_item_name || "Other Item"
                : it.material_type?.name || "Material";

              const invSizeQty = it.size_quantities || {};
              const sizesList = (it.design?.size_set?.sizes && it.design.size_set.sizes.length > 0)
                ? it.design.size_set.sizes
                : Object.keys(invSizeQty);
              const sizeSetName = it.design?.size_set?.name || "";

              return {
                purchase_item_id: it.id,
                material_type_id: it.material_type_id || null,
                design_id: it.design_id || null,
                colour_id: it.colour_id || null,
                size_quantities: {},
                invoice_size_quantities: invSizeQty,
                sizes: sizesList,
                size_set_name: sizeSetName,
                material_name: materialName,
                hsn_sac: it.hsn_sac || "",
                unit: it.unit || (calculatedType === "finished_goods" ? "Pcs" : "Meters"),
                invoice_qty: Number(it.quantity || 0),
                returned_qty: 0,
                rate: Number(it.rate || 0),
                discount_percent: Number(it.discount_percent || 0),
                taxable_value: 0,
                gst_percent: Number(it.gst_percent || 0),
                gst_amount: 0,
                amount: 0,
                item_type: calculatedType,
                rolls: rollsList.map((r: any) => ({
                  id: r.id,
                  roll_number: r.roll_number,
                  shade: r.shade || "N/A",
                  meters: Number(r.meters || 0),
                  remaining_meters: Number(r.remaining_meters || 0),
                  selected: false,
                })),
              };
            });
            replace(returnItems);
          }
        })
        .catch((err) => {
          console.error("Error loading invoice items:", err);
          toast.error("Failed to load invoice items");
        })
        .finally(() => {
          setLoadingInvoiceDetail(false);
        });
    } else {
      setValue("supplier_id", "");
      replace([]);
    }
  }, [watchPurchaseId, setValue, replace]);

  const watchGstType = watch("gst_type") || "with_gst";

  // Helper calculation for item tax
  const calcItemTax = (item: any, returnedQty: number) => {
    const rate = Number(item?.rate || 0);
    const disc = Number(item?.discount_percent || 0);
    const gstPct = watchGstType === "with_gst" ? Number(item?.gst_percent || 0) : 0;

    const taxable = Number((returnedQty * rate * (1 - disc / 100)).toFixed(2));
    const gstAmt = Number(((taxable * gstPct) / 100).toFixed(2));
    const totalAmt = Number((taxable + gstAmt).toFixed(2));

    return { taxable, gstAmt, totalAmt };
  };

  // Toggle roll selection
  const handleRollToggle = (itemIndex: number, rollIndex: number) => {
    const currentItems = watch("items") || [];
    const item = currentItems[itemIndex];
    if (!item || !item.rolls) return;

    const updatedRolls = [...item.rolls];
    const targetRoll = updatedRolls[rollIndex];
    const isSelected = !targetRoll.selected;

    updatedRolls[rollIndex] = {
      ...targetRoll,
      selected: isSelected,
      return_meters: isSelected ? (targetRoll.return_meters || targetRoll.remaining_meters) : 0,
    };

    recalcRollTotals(itemIndex, updatedRolls);
  };

  // Update specific roll return meters
  const handleRollMetersChange = (itemIndex: number, rollIndex: number, metersVal: number) => {
    const currentItems = watch("items") || [];
    const item = currentItems[itemIndex];
    if (!item || !item.rolls) return;

    const updatedRolls = [...item.rolls];
    const targetRoll = updatedRolls[rollIndex];
    const maxMeters = Number(targetRoll.remaining_meters || 0);

    if (metersVal > maxMeters) {
      toast.error(`Return meters for Roll ${targetRoll.roll_number} cannot exceed remaining ${maxMeters} meters`);
      metersVal = maxMeters;
    }

    updatedRolls[rollIndex] = {
      ...targetRoll,
      selected: metersVal > 0,
      return_meters: metersVal,
    };

    recalcRollTotals(itemIndex, updatedRolls);
  };

  const recalcRollTotals = (itemIndex: number, rolls: any[]) => {
    const item = watch(`items.${itemIndex}`);
    const returnedQty = rolls
      .filter((r) => r.selected)
      .reduce((sum, r) => sum + Number(r.return_meters || 0), 0);

    setValue(`items.${itemIndex}.rolls`, rolls);
    setValue(`items.${itemIndex}.returned_qty`, returnedQty);

    const { taxable, gstAmt, totalAmt } = calcItemTax(item, returnedQty);
    setValue(`items.${itemIndex}.taxable_value`, taxable);
    setValue(`items.${itemIndex}.gst_amount`, gstAmt);
    setValue(`items.${itemIndex}.amount`, totalAmt);
  };

  // Recalculate item taxable value when size matrix input changes (for finished goods & sized items)
  const handleSizeQtyChange = (itemIndex: number, updatedSizeQs: Record<string, number>) => {
    const item = watchItems[itemIndex];
    if (!item) return;

    const invSizeQs = item.invoice_size_quantities || {};
    let isValid = true;
    const validatedSizeQs: Record<string, number> = {};

    Object.entries(updatedSizeQs).forEach(([sz, qty]) => {
      const numQty = Math.max(0, Number(qty || 0));
      const maxQtyForSize = invSizeQs[sz] !== undefined ? Number(invSizeQs[sz] || 0) : Number(item.invoice_qty || 0);

      if (numQty > maxQtyForSize) {
        toast.error(`Return quantity for size '${sz}' cannot exceed original invoice quantity of ${maxQtyForSize}`);
        validatedSizeQs[sz] = maxQtyForSize;
        isValid = false;
      } else {
        validatedSizeQs[sz] = numQty;
      }
    });

    const totalReturnedQty = Object.values(validatedSizeQs).reduce((sum, q) => sum + Number(q || 0), 0);
    const maxInvoiceQty = Number(item.invoice_qty || 0);

    if (totalReturnedQty > maxInvoiceQty) {
      toast.error(`Total returned quantity (${totalReturnedQty}) cannot exceed invoice total quantity (${maxInvoiceQty})`);
      return;
    }

    setValue(`items.${itemIndex}.size_quantities`, validatedSizeQs);
    setValue(`items.${itemIndex}.returned_qty`, totalReturnedQty);

    const { taxable, gstAmt, totalAmt } = calcItemTax(item, totalReturnedQty);
    setValue(`items.${itemIndex}.taxable_value`, taxable);
    setValue(`items.${itemIndex}.gst_amount`, gstAmt);
    setValue(`items.${itemIndex}.amount`, totalAmt);
  };

  // Recalculate item taxable value when returned quantity changes (for scalar accessories)
  const handleQtyChange = (index: number, qtyVal: string) => {
    const qty = Number(qtyVal || 0);
    const maxQty = Number(watchItems[index]?.invoice_qty || 0);

    if (qty > maxQty) {
      toast.error(`Return quantity cannot exceed original invoice quantity of ${maxQty}`);
      setValue(`items.${index}.returned_qty`, 0);
      setValue(`items.${index}.taxable_value`, 0);
      setValue(`items.${index}.gst_amount`, 0);
      setValue(`items.${index}.amount`, 0);
      return;
    }

    const { taxable, gstAmt, totalAmt } = calcItemTax(watchItems[index], qty);

    setValue(`items.${index}.returned_qty`, qty);
    setValue(`items.${index}.taxable_value`, taxable);
    setValue(`items.${index}.gst_amount`, gstAmt);
    setValue(`items.${index}.amount`, totalAmt);
  };

  // Compute Grand Totals
  const totalTaxable = watchItems.reduce((acc, curr) => acc + Number(curr.taxable_value || 0), 0);
  const totalGst = watchGstType === "with_gst" ? watchItems.reduce((acc, curr) => acc + Number(curr.gst_amount || 0), 0) : 0;
  const cgst = watchGstType === "with_gst" ? Number((totalGst / 2).toFixed(2)) : 0;
  const sgst = watchGstType === "with_gst" ? Number((totalGst / 2).toFixed(2)) : 0;
  const igst = 0;
  const rawGrandTotal = totalTaxable + totalGst;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Number((grandTotal - rawGrandTotal).toFixed(2));

  const onSubmit = async (values: ReturnFormValues) => {
    // Check if any items actually have returned_qty > 0
    const itemsToReturn = values.items.filter((it) => it.returned_qty > 0);
    if (itemsToReturn.length === 0) {
      toast.error("Please enter a return quantity greater than 0 for at least one item.");
      return;
    }

    try {
      const payload = {
        ...values,
        items: itemsToReturn,
        total_taxable_value: totalTaxable,
        cgst,
        sgst,
        igst,
        round_off: roundOff,
        grand_total: grandTotal,
      };

      if (isEditMode) {
        // Edit mode — PUT to existing return
        const res = await fetch(`/api/raw-materials/purchase-returns/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to update purchase return");
        toast.success("Purchase return updated successfully!");
      } else {
        // Create mode — POST
        const res = await fetch("/api/raw-materials/purchase-returns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to create purchase return");
        if (values.generate_debit_note && result.return?.debit_note_id) {
          toast.success(`Purchase return & Debit Note created successfully!`);
        } else {
          toast.success("Purchase return recorded successfully!");
        }
      }

      router.push("/purchases?tab=returns");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to record return");
    }
  };

  const selectedSupplierName = purchases.find((p) => p.id === watchPurchaseId)?.supplier?.name || "—";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Action Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/purchases?tab=returns" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">
              {isEditMode ? "Edit Purchase Return" : "Record Purchase Return"}
            </h1>
            <p className="text-xs text-[#64748B]">
              {isEditMode
                ? "Update return details, remarks, and quantities."
                : "Select a purchase invoice, specify return quantities, and transfer items back to stock."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/purchases?tab=returns"
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
            {isEditMode ? "Save Changes" : "Submit Return"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main section: Info & Items table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Form Header Info */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
              1. Return Header Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Purchase Invoice *</label>
                {isEditMode ? (
                  // In edit mode: read-only display (invoice & items are already committed)
                  <div className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs bg-slate-50 font-bold text-slate-700">
                    {purchases.find((p) => p.id === watch("purchase_id"))?.purchase_number || initialData?.purchase_id || "—"}
                    <span className="text-[10px] text-slate-400 font-normal block mt-0.5">Cannot change original invoice in edit mode</span>
                  </div>
                ) : (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      disabled={loadingPurchases}
                      onClick={() => setInvoiceDropdownOpen((prev) => !prev)}
                      className="w-full pl-3 pr-8 py-2 border border-[var(--input-border)] rounded-lg text-xs bg-[var(--input-bg)] font-bold text-[var(--text-primary)] text-left flex items-center justify-between cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                    >
                      <span className="truncate">
                        {purchases.find((p) => p.id === watchPurchaseId)
                          ? `${purchases.find((p) => p.id === watchPurchaseId)?.purchase_number} (Inv: ${purchases.find((p) => p.id === watchPurchaseId)?.invoice_no || "N/A"})`
                          : "Select Invoice..."}
                      </span>
                      <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0 ml-1" />
                    </button>

                    {invoiceDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl p-2 max-h-72 overflow-hidden flex flex-col">
                        {/* Search Input Bar */}
                        <div className="relative mb-2 shrink-0">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
                          <input
                            type="text"
                            autoFocus
                            placeholder="Search by Purchase No, Inv No, Supplier..."
                            value={invoiceSearchQuery}
                            onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                          />
                          {invoiceSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setInvoiceSearchQuery("")}
                              className="absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>

                        {/* List Options */}
                        <div className="overflow-y-auto space-y-1 flex-1 max-h-52">
                          <button
                            type="button"
                            onClick={() => {
                              setValue("purchase_id", "", { shouldValidate: true });
                              setValue("supplier_id", "");
                              setValue("godown_id", "");
                              replace([]);
                              setInvoiceDropdownOpen(false);
                              setInvoiceSearchQuery("");
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-[var(--text-faint)] hover:bg-[var(--table-row-hover)] italic cursor-pointer"
                          >
                            Clear selection
                          </button>

                          {purchases.filter((p) => {
                            if (!invoiceSearchQuery.trim()) return true;
                            const q = invoiceSearchQuery.toLowerCase().trim();
                            const purNo = (p.purchase_number || "").toLowerCase();
                            const invNo = (p.invoice_no || "").toLowerCase();
                            const supplierName = (p.supplier?.name || "").toLowerCase();
                            return purNo.includes(q) || invNo.includes(q) || supplierName.includes(q);
                          }).length === 0 ? (
                            <p className="text-xs text-[var(--text-faint)] italic text-center py-3">No matching purchase invoices found</p>
                          ) : (
                            purchases
                              .filter((p) => {
                                if (!invoiceSearchQuery.trim()) return true;
                                const q = invoiceSearchQuery.toLowerCase().trim();
                                const purNo = (p.purchase_number || "").toLowerCase();
                                const invNo = (p.invoice_no || "").toLowerCase();
                                const supplierName = (p.supplier?.name || "").toLowerCase();
                                return purNo.includes(q) || invNo.includes(q) || supplierName.includes(q);
                              })
                              .map((p) => {
                                const isSelected = p.id === watchPurchaseId;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setValue("purchase_id", p.id, { shouldValidate: true });
                                      setInvoiceDropdownOpen(false);
                                      setInvoiceSearchQuery("");
                                    }}
                                    className={cn(
                                      "w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer",
                                      isSelected
                                        ? "bg-indigo-500/10 text-[var(--primary)] font-bold"
                                        : "hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] font-medium"
                                    )}
                                  >
                                    <div className="truncate pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold">{p.purchase_number}</span>
                                        <span className="text-[10px] text-[var(--text-muted)] font-mono">({p.invoice_no || "No Inv#"})</span>
                                      </div>
                                      {p.supplier?.name && (
                                        <span className="text-[10px] text-[var(--text-muted)] block truncate">{p.supplier.name}</span>
                                      )}
                                    </div>
                                    {isSelected && <Check size={14} className="text-[var(--primary)] shrink-0" />}
                                  </button>
                                );
                              })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {errors.purchase_id && <p className="text-[10px] text-red-500 mt-1">{errors.purchase_id.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Supplier (Autofill)</label>
                <div className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-slate-50 font-bold text-slate-700">
                  {selectedSupplierName}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Return Date *</label>
                <input
                  type="date"
                  {...register("return_date")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
                {errors.return_date && <p className="text-[10px] text-red-500 mt-1">{errors.return_date.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Return Type *</label>
                <select
                  {...register("return_type")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="material_return">Material Return</option>
                  <option value="quality_issue">Quality Issue</option>
                  <option value="excess_material">Excess Material</option>
                  <option value="other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Return From Godown *</label>
                <select
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
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Supplier Challan No.</label>
                <input
                  type="text"
                  placeholder="e.g. CH-987"
                  {...register("challan_no")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Return items grid */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-4 border-l-4 border-[#6366F1] pl-2.5">
              2. Return Quantities
            </h2>

            {loadingInvoiceDetail ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#6366F1]" />
              </div>
            ) : fields.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic">
                Select a purchase invoice to load materials list.
              </div>
            ) : (
              <div className="space-y-6">
                {fields.map((field, index) => {
                  const item = watchItems[index];
                  const isFabric = item?.item_type === "fabric" && (item?.rolls || []).length > 0;

                  return (
                    <div key={field.id} className="p-4 bg-white rounded-xl border border-[#E2E8F0] space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                        <div>
                          <span className="text-xs font-bold text-[#6366F1] bg-[#EEF2FF] px-2.5 py-1 rounded-md">
                            {item?.material_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold ml-2">
                            Unit: {item?.unit} | Rate: ₹{Number(item?.rate).toFixed(2)} | Disc: {item?.discount_percent}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-500">Invoice Qty: {item?.invoice_qty}</span>
                        </div>
                      </div>

                      {isFabric ? (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Select Rolls to Return
                          </div>
                          {(item.rolls || []).length === 0 ? (
                            <p className="text-xs text-rose-500 font-medium italic">No rolls found for this fabric item.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {(item.rolls || []).map((roll: any, rollIndex: number) => (
                                <div
                                  key={roll.id}
                                  className={`p-3 rounded-lg border text-xs transition-all space-y-2 ${
                                    roll.selected
                                      ? "bg-rose-50/50 border-rose-200 text-rose-900"
                                      : "bg-slate-50 border-slate-200 text-slate-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      id={`roll-${roll.id}`}
                                      checked={!!roll.selected}
                                      onChange={() => handleRollToggle(index, rollIndex)}
                                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                                    />
                                    <label htmlFor={`roll-${roll.id}`} className="flex-1 cursor-pointer select-none">
                                      <span className="font-bold block text-slate-900">Roll {roll.roll_number}</span>
                                      <span className="text-[10px] text-slate-500 font-medium">
                                        Shade: {roll.shade} | Available: <strong className="text-slate-800">{roll.remaining_meters}</strong> / {roll.meters} m
                                      </span>
                                    </label>
                                  </div>

                                  {roll.selected && (
                                    <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between gap-2">
                                      <span className="text-[11px] font-bold text-rose-800">Return Meters:</span>
                                      <div className="flex items-center gap-1">
                                        <NumericInput
                                          step="0.01"
                                          value={roll.return_meters ?? roll.remaining_meters}
                                          onChange={(e) =>
                                            handleRollMetersChange(index, rollIndex, Number(e.target.value || 0))
                                          }
                                          className="w-24 px-2 py-1 border border-rose-300 rounded text-right text-xs font-bold bg-white focus:ring-1 focus:ring-rose-500"
                                        />
                                        <span className="text-[10px] text-slate-500 font-semibold">m</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (() => {
                          const hasSizes =
                            (item?.item_type === "finished_goods") ||
                            (item?.sizes && item.sizes.length > 0) ||
                            (item?.invoice_size_quantities && Object.keys(item.invoice_size_quantities).length > 0);

                          if (hasSizes) {
                            const sizes = (item?.sizes && item.sizes.length > 0)
                              ? item.sizes
                              : (item?.invoice_size_quantities && Object.keys(item.invoice_size_quantities).length > 0)
                              ? Object.keys(item.invoice_size_quantities)
                              : ["S", "M", "L", "XL", "XXL", "3XL"];
                            const currentSizeQs = item?.size_quantities || {};

                            return (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-[#334155] uppercase tracking-wider">
                                    Return Size Breakdown Matrix
                                  </h4>
                                  <span className="text-[10px] text-[#64748B] font-semibold">
                                    Specify returned piece quantity for each size of this colour
                                  </span>
                                </div>

                                <SizeQuantityMatrix
                                  sizes={sizes}
                                  sizeQuantities={currentSizeQs}
                                  sizeSetName={item?.size_set_name}
                                  onChange={(updated) => handleSizeQtyChange(index, updated)}
                                />

                                <div className="flex items-center justify-between text-xs pt-1 px-1">
                                  <span className="text-slate-500 font-medium">
                                    Total Returned Pcs: <strong className="text-[#6366F1] font-mono">{item?.returned_qty || 0}</strong> / {item?.invoice_qty} Pcs
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex items-center gap-4">
                              <div className="w-1/3">
                                <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Returned Qty</label>
                                <NumericInput
                                  step="0.01"
                                  placeholder="0"
                                  value={item?.returned_qty || ""}
                                  onChange={(e) => {
                                    handleQtyChange(index, e.target.value);
                                  }}
                                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
                                />
                              </div>
                            </div>
                          );
                        })()}

                      {/* Display taxable value for return */}
                      <div className="flex justify-end pt-2 border-t border-[#F1F5F9] text-xs font-semibold text-slate-700">
                        <span>Return Value: ₹{Number(item?.taxable_value || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reasons / Remarks */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Reason for Return *</label>
              <select
                {...register("reason")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white font-semibold text-[#0F172A]"
              >
                <option value="">Select Reason</option>
                <option value="Damaged Material">Damaged/Defective Material</option>
                <option value="Quality Issues">Quality/Specification Mismatch</option>
                <option value="Excess Quantity Sent">Excess Quantity Sent</option>
                <option value="Wrong Item/Color Sent">Wrong Item/Color Sent</option>
                <option value="Late Delivery Rejected">Late Delivery Rejected</option>
                <option value="Other">Other (Specify in Remarks)</option>
              </select>
              {errors.reason && <p className="text-[10px] text-red-500 mt-1">{errors.reason.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">General Remarks</label>
              <textarea
                rows={3}
                placeholder="Enter return notes..."
                {...register("remarks")}
                className="w-full p-2.5 border border-[#CBD5E1] rounded-lg text-xs font-medium"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Right Section: Return Summary, Debit Note, Attachments */}
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
              3. Summary Details
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[var(--text-muted)] font-semibold">
                <span>Total Taxable Value:</span>
                <span className="font-mono">₹{totalTaxable.toFixed(2)}</span>
              </div>
              {watchGstType === "with_gst" && (
                <>
                  <div className="flex justify-between text-[var(--text-muted)] text-xs font-medium">
                    <span>CGST:</span>
                    <span className="font-mono">₹{cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)] text-xs font-medium">
                    <span>SGST:</span>
                    <span className="font-mono">₹{sgst.toFixed(2)}</span>
                  </div>
                </>
              )}
              {watchGstType === "without_gst" && (
                <div className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-900">
                  Kaccha Bill (No GST applicable)
                </div>
              )}
              {roundOff !== 0 && (
                <div className="flex justify-between text-[var(--text-faint)] text-xs">
                  <span>Round Off:</span>
                  <span className="font-mono">₹{roundOff > 0 ? `+${roundOff.toFixed(2)}` : roundOff.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center bg-[var(--table-row-hover)] p-3 rounded-lg border border-[var(--border)] font-bold text-[var(--text-primary)]">
                <span>Grand Total:</span>
                <span className="font-mono text-lg font-black text-[var(--primary)]">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>

              <div className="border-t border-[#E2E8F0] my-2" />

              {/* Debit Note toggle */}
              <label className="flex items-start gap-2.5 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register("generate_debit_note")}
                  className="rounded border-[#CBD5E1] text-[#6366F1] h-4 w-4 mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold text-[#4F46E5]">Generate Debit Note</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Create a ledger debit adjustment to supplier profile immediately.
                  </span>
                </div>
              </label>

              {watchDebitNote && (
                <div className="bg-slate-50 p-2.5 rounded border border-[#E2E8F0] text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  Debit Note ID: Auto-allocated on submission.
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-3 border-l-4 border-[#6366F1] pl-2.5">
              4. Return Documents
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
                setValue("attachments", newUrls);
              }}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
