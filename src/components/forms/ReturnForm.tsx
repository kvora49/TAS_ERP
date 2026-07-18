"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NumericInput } from "@/components/ui/numeric-input";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { AttachmentDropzone } from "@/components/shared/AttachmentDropzone";
import { useFileUpload } from "@/hooks/useFileUpload";

const returnItemSchema = z.object({
  purchase_item_id: z.string().optional(),
  material_type_id: z.string().min(1, "Material is required"),
  material_name: z.string().optional(), // display helper
  hsn_sac: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  invoice_qty: z.coerce.number().min(0.01),
  returned_qty: z.coerce.number().min(0, "Cannot be negative"),
  rate: z.coerce.number().min(0.01),
  discount_percent: z.coerce.number(),
  taxable_value: z.coerce.number(),
  item_type: z.enum(["fabric", "accessory"]).default("fabric"),
  rolls: z.array(z.object({
    id: z.string(),
    roll_number: z.string(),
    shade: z.string(),
    meters: z.number(),
    remaining_meters: z.number(),
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

export function ReturnForm() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [loadingInvoiceDetail, setLoadingInvoiceDetail] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { upload, uploading } = useFileUpload("returns");

  const defaultValues: ReturnFormValues = {
    purchase_id: "",
    supplier_id: "",
    return_date: new Date().toISOString().split("T")[0],
    return_type: "material_return",
    reason: "",
    godown_id: "",
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
    defaultValues,
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

            // Populate items with returned_qty default 0
            const returnItems = (data.items || []).map((it: any) => ({
              purchase_item_id: it.id,
              material_type_id: it.material_type_id,
              material_name: it.material_type?.name || "Material",
              hsn_sac: it.hsn_sac || "",
              unit: it.unit,
              invoice_qty: it.quantity,
              returned_qty: 0,
              rate: it.rate,
              discount_percent: it.discount_percent || 0,
              taxable_value: 0,
              item_type: it.item_type || "fabric",
              rolls: (it.rolls || []).map((r: any) => ({
                id: r.id,
                roll_number: r.roll_number,
                shade: r.shade,
                meters: Number(r.meters),
                remaining_meters: Number(r.remaining_meters),
                selected: false,
              })),
            }));
            replace(returnItems);
          }
        })
        .catch((err) => {
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

  // Toggle roll selection
  const handleRollToggle = (itemIndex: number, rollIndex: number) => {
    const currentItems = watch("items") || [];
    const item = currentItems[itemIndex];
    if (!item || !item.rolls) return;

    const updatedRolls = [...item.rolls];
    const isSelected = !updatedRolls[rollIndex].selected;
    updatedRolls[rollIndex] = {
      ...updatedRolls[rollIndex],
      selected: isSelected,
    };

    // Calculate sum of meters for selected rolls
    const returnedQty = updatedRolls
      .filter((r) => r.selected)
      .reduce((sum, r) => sum + Number(r.remaining_meters || 0), 0);

    setValue(`items.${itemIndex}.rolls`, updatedRolls);
    setValue(`items.${itemIndex}.returned_qty`, returnedQty);

    // Calculate taxable value
    const rate = Number(item.rate || 0);
    const disc = Number(item.discount_percent || 0);
    const taxable = returnedQty * rate * (1 - disc / 100);
    setValue(`items.${itemIndex}.taxable_value`, Number(taxable.toFixed(2)));
  };

  // Recalculate item taxable value when returned quantity changes (for accessories)
  const handleQtyChange = (index: number, qtyVal: string) => {
    const qty = Number(qtyVal || 0);
    const maxQty = Number(watchItems[index]?.invoice_qty || 0);

    if (qty > maxQty) {
      toast.error(`Return quantity cannot exceed original invoice quantity of ${maxQty}`);
      setValue(`items.${index}.returned_qty`, 0);
      setValue(`items.${index}.taxable_value`, 0);
      return;
    }

    const rate = Number(watchItems[index]?.rate || 0);
    const disc = Number(watchItems[index]?.discount_percent || 0);
    const taxable = qty * rate * (1 - disc / 100);

    setValue(`items.${index}.returned_qty`, qty);
    setValue(`items.${index}.taxable_value`, Number(taxable.toFixed(2)));
  };

  // Compute Grand Total
  const totalTaxable = watchItems.reduce((acc, curr) => acc + Number(curr.taxable_value || 0), 0);
  const grandTotal = totalTaxable; // keeping it simple, matching purchase return structure

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
        grand_total: grandTotal,
      };

      const res = await fetch("/api/raw-materials/purchase-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create purchase return");

      if (values.generate_debit_note) {
        toast.success("Purchase return recorded successfully! Debit Note stub created (Feature Coming Soon).");
      } else {
        toast.success("Purchase return recorded successfully!");
      }

      router.push("/raw-materials/purchase-returns");
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
          <Link href="/raw-materials/purchase-returns" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Record Purchase Return</h1>
            <p className="text-xs text-[#64748B]">
              Select a purchase invoice, specify return quantities, and transfer items back to stock.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/raw-materials/purchase-returns"
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
            Submit Return
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
                <select
                  disabled={loadingPurchases}
                  {...register("purchase_id")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="">Select Invoice</option>
                  {purchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.purchase_number} (Inv: {p.invoice_no})
                    </option>
                  ))}
                </select>
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
                  const isFabric = (item?.item_type || "fabric") === "fabric";

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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {(item.rolls || []).map((roll: any, rollIndex: number) => (
                                <label
                                  key={roll.id}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                                    roll.selected
                                      ? "bg-rose-50/50 border-rose-200 text-rose-900"
                                      : "bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!roll.selected}
                                    onChange={() => handleRollToggle(index, rollIndex)}
                                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                                  />
                                  <div className="flex-1">
                                    <span className="font-bold">Roll {roll.roll_number}</span>
                                    <span className="text-[10px] text-slate-400 font-semibold block">
                                      Shade: {roll.shade} | Remaining: {roll.remaining_meters} / {roll.meters} meters
                                    </span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
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
                      )}

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
        </div>

        {/* Right Section: Return Summary, Debit Note, Attachments */}
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
              3. Summary Details
            </h2>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between text-[#64748B] font-semibold">
                <span>Total Taxable Value:</span>
                <span className="font-mono">₹{totalTaxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] font-bold text-[#0F172A]">
                <span>Grand Total:</span>
                <span className="font-mono text-lg font-black text-[#6366F1]">
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

          {/* Reasons / Remarks */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Reason for Return *</label>
              <select
                {...register("reason")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
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
                className="w-full p-2.5 border border-[#CBD5E1] rounded-lg text-xs"
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
