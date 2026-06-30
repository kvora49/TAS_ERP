"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { AttachmentDropzone } from "@/components/shared/AttachmentDropzone";
import { useFileUpload } from "@/hooks/useFileUpload";

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
});

const purchaseSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
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
}

interface MaterialType {
  id: string;
  name: string;
  unit: string;
  hsn_code: string | null;
  gst_percent: number;
}

interface PurchaseFormProps {
  initialData?: any;
  id?: string;
}

export function PurchaseForm({ initialData, id }: PurchaseFormProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { upload, uploading } = useFileUpload("purchases");

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const defaultValues: PurchaseFormValues = {
    supplier_id: "",
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
                <select
                  disabled={loadingSuppliers}
                  {...register("supplier_id")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.company_name ? `(${s.company_name})` : ""}
                    </option>
                  ))}
                </select>
                {errors.supplier_id && <p className="text-[10px] text-red-500 mt-1">{errors.supplier_id.message}</p>}
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
                onClick={() => append({ material_type_id: "", hsn_sac: "", unit: "meter", quantity: 0, rate: 0, discount_percent: 0, taxable_value: 0, gst_percent: 18, gst_amount: 0, amount: 0 })}
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
                      {/* Row 1 */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-4">
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Raw Material Type *</label>
                          <select
                            disabled={loadingMaterials}
                            {...register(`items.${index}.material_type_id` as const)}
                            onChange={(e) => handleMaterialChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all"
                          >
                            <option value="">Select Material</option>
                            {materialTypes.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
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
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Qty *</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            {...register(`items.${index}.quantity` as const)}
                            onChange={() => recalcItem(index)}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Rate (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...register(`items.${index}.rate` as const)}
                            onChange={() => recalcItem(index)}
                            className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* Row 2 */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1.5">
                        <div className={watchGstType === "with_gst" ? "md:col-span-2" : "md:col-span-3"}>
                          <label className="block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wider">Disc (%)</label>
                          <input
                            type="number"
                            placeholder="0"
                            {...register(`items.${index}.discount_percent` as const)}
                            onChange={() => recalcItem(index)}
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
                              <input
                                type="number"
                                {...register(`items.${index}.gst_percent` as const)}
                                onChange={() => recalcItem(index)}
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
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    <input
                      type="number"
                      placeholder="0.00"
                      {...register("freight")}
                      className="w-full px-2 py-1 border border-[#CBD5E1] rounded text-xs font-bold text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#64748B] mb-0.5">Loading</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      {...register("loading_unloading")}
                      className="w-full px-2 py-1 border border-[#CBD5E1] rounded text-xs font-bold text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-[#64748B] mb-0.5">Other</label>
                    <input
                      type="number"
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
                  const url = await upload(file);
                  if (url) {
                    newFiles.push(file);
                    newUrls.push(url);
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

          {/* Remarks & Notes */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] mb-3 border-l-4 border-[#6366F1] pl-2.5">
              5. Remarks & Notes
            </h2>
            <textarea
              rows={3}
              placeholder="Internal notes or special instructions..."
              {...register("notes")}
              className="w-full p-2.5 border border-[#CBD5E1] rounded-lg text-xs"
            ></textarea>
          </div>
        </div>
      </div>
    </form>
  );
}
