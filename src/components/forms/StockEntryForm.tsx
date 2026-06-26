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

const stockItemSchema = z.object({
  material_type_id: z.string().min(1, "Material is required"),
  hsn_sac: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be greater than 0"),
  rate: z.coerce.number().min(0.01, "Rate must be greater than 0"),
  batch_lot_no: z.string().optional(),
  expiry_date: z.string().optional(),
  amount: z.coerce.number(),
});

const entrySchema = z.object({
  entry_type: z.enum(["stock_in", "stock_out", "adjustment"]),
  posting_date: z.string().min(1, "Posting Date is required"),
  godown_id: z.string().min(1, "Godown is required"),
  remarks: z.string().optional(),
  notes: z.string().optional(),
  reference_type: z.enum(["manual", "purchase_invoice", "return", "transfer"]),
  reference_no: z.string().optional(),
  reference_date: z.string().optional(),
  attachments: z.array(z.string()),
  items: z.array(stockItemSchema).min(1, "At least one item is required"),
});

type EntryFormValues = z.infer<typeof entrySchema>;

interface Godown {
  id: string;
  name: string;
}

interface MaterialType {
  id: string;
  name: string;
  unit: string;
  hsn_code: string | null;
}

export function StockEntryForm() {
  const router = useRouter();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [loadingGodowns, setLoadingGodowns] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { upload, uploading } = useFileUpload("stock");

  const defaultValues: EntryFormValues = {
    entry_type: "stock_in",
    posting_date: new Date().toISOString().split("T")[0],
    godown_id: "",
    remarks: "",
    notes: "",
    reference_type: "manual",
    reference_no: "",
    reference_date: "",
    attachments: [],
    items: [{ material_type_id: "", hsn_sac: "", unit: "meter", quantity: 0, rate: 0, batch_lot_no: "", expiry_date: "", amount: 0 }],
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema) as any,
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchItems = watch("items") || [];
  const watchEntryType = watch("entry_type");

  useEffect(() => {
    async function loadData() {
      setLoadingGodowns(true);
      setLoadingMaterials(true);
      try {
        const gRes = await fetch("/api/master-data/godowns");
        if (gRes.ok) {
          const gData = await gRes.json();
          setGodowns(gData.godowns || []);
        }

        const mRes = await fetch("/api/raw-materials");
        if (mRes.ok) {
          const mData = await mRes.json();
          setMaterialTypes(mData.materialTypes || []);
        }
      } catch (err) {
        console.error("Failed to load select options");
      } finally {
        setLoadingGodowns(false);
        setLoadingMaterials(false);
      }
    }
    loadData();
  }, []);

  const handleMaterialChange = (index: number, matId: string) => {
    const selectedMat = materialTypes.find((m) => m.id === matId);
    if (selectedMat) {
      setValue(`items.${index}.hsn_sac`, selectedMat.hsn_code || "");
      setValue(`items.${index}.unit`, selectedMat.unit || "meter");
      recalcItem(index);
    }
  };

  const recalcItem = (index: number) => {
    const qty = Number(watchItems[index]?.quantity || 0);
    const rate = Number(watchItems[index]?.rate || 0);
    const amount = qty * rate;
    setValue(`items.${index}.amount`, Number(amount.toFixed(2)));
  };

  // Compute Grand Total
  const totalValue = watchItems.reduce((acc, curr) => acc + (Number(curr.quantity || 0) * Number(curr.rate || 0)), 0);

  const onSubmit = async (values: EntryFormValues) => {
    try {
      const payload = {
        ...values,
        total_items_value: totalValue,
        grand_total: totalValue,
      };

      const res = await fetch("/api/raw-materials/stock/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to record stock entry");

      toast.success("Stock entry logged successfully!");
      router.push("/raw-materials/stock");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit entry");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/raw-materials/stock" className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5 text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Record Stock Entry</h1>
            <p className="text-xs text-[#64748B]">
              Input manual adjustments, physical stock updates, and batch lot parameters.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/raw-materials/stock"
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
            Submit Stock Entry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main section: Info & Items table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Info */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
              1. Entry Header Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Entry Type *</label>
                <select
                  {...register("entry_type")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white font-bold"
                >
                  <option value="stock_in" className="text-green-600">Stock In (Inward)</option>
                  <option value="stock_out" className="text-red-600">Stock Out (Outward)</option>
                  <option value="adjustment" className="text-purple-600">Adjustment (Variance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Godown Location *</label>
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
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Posting Date *</label>
                <input
                  type="date"
                  {...register("posting_date")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
                {errors.posting_date && <p className="text-[10px] text-red-500 mt-1">{errors.posting_date.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Reference Doc Type</label>
                <select
                  {...register("reference_type")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="purchase_invoice">Purchase Invoice</option>
                  <option value="return">Purchase Return</option>
                  <option value="transfer">Godown Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Reference No.</label>
                <input
                  type="text"
                  placeholder="e.g. PO-123 / RET-456"
                  {...register("reference_no")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Reference Date</label>
                <input
                  type="date"
                  {...register("reference_date")}
                  className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Items grid */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
                2. Entry Items & Traceability
              </h2>
              <button
                type="button"
                onClick={() =>
                  append({
                    material_type_id: "",
                    hsn_sac: "",
                    unit: "meter",
                    quantity: 0,
                    rate: 0,
                    batch_lot_no: "",
                    expiry_date: "",
                    amount: 0,
                  })
                }
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-lg flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Item Row
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[#CBD5E1] rounded-xl text-xs text-[#64748B]">
                No items added yet. Click &quot;Add Item Row&quot; to configure.
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC] space-y-3 relative"
                  >
                    {/* Row number + delete */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#6366F1]">
                        Item #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Row 1: Material (wide) + HSN + Unit */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* Raw Material — takes most space */}
                      <div className="md:col-span-5">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          Raw Material Type *
                        </label>
                        <select
                          disabled={loadingMaterials}
                          {...register(`items.${index}.material_type_id` as const)}
                          onChange={(e) => handleMaterialChange(index, e.target.value)}
                          className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                        >
                          <option value="">Select Material</option>
                          {materialTypes.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        {errors.items?.[index]?.material_type_id && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.items[index]?.material_type_id?.message}
                          </p>
                        )}
                      </div>

                      {/* HSN */}
                      <div className="md:col-span-4">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          HSN / SAC Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 5208"
                          {...register(`items.${index}.hsn_sac` as const)}
                          className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono bg-white"
                        />
                      </div>

                      {/* Unit */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          Unit of Measure
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. meter, kg, pcs"
                          {...register(`items.${index}.unit` as const)}
                          className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                        />
                        {errors.items?.[index]?.unit && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.items[index]?.unit?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Quantity + Rate + Batch/Lot + Expiry + Amount */}
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
                      {/* Quantity */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...register(`items.${index}.quantity` as const)}
                          onChange={() => recalcItem(index)}
                          className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right font-bold bg-white"
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.items[index]?.quantity?.message}
                          </p>
                        )}
                      </div>

                      {/* Unit Rate */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          Unit Cost (₹) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...register(`items.${index}.rate` as const)}
                          onChange={() => recalcItem(index)}
                          className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right font-bold bg-white"
                        />
                        {errors.items?.[index]?.rate && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.items[index]?.rate?.message}
                          </p>
                        )}
                      </div>

                      {/* Batch / Lot No */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          Batch / Lot No.
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. B-987"
                          {...register(`items.${index}.batch_lot_no` as const)}
                          className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm font-mono bg-white"
                        />
                      </div>

                      {/* Expiry Date */}
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          {...register(`items.${index}.expiry_date` as const)}
                          className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
                        />
                      </div>

                      {/* Amount (read-only computed) */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[#64748B] mb-1.5">
                          Amount (₹)
                        </label>
                        <div className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm text-right font-mono font-black text-[#6366F1] bg-[#EEF2FF]">
                          ₹{Number(watchItems[index]?.amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Grand Total row */}
                <div className="flex justify-end pt-2">
                  <div className="flex items-center gap-3 bg-[#0F172A] text-white px-5 py-2.5 rounded-xl">
                    <span className="text-xs font-semibold">Total Items Value:</span>
                    <span className="font-mono font-black text-lg text-[#A5B4FC]">
                      ₹{totalValue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Totals, Attachments, Notes */}
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] border-l-4 border-[#6366F1] pl-2.5">
              3. Summary Details
            </h2>
            <div className="flex justify-between items-center bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] font-bold text-[#0F172A]">
              <span>Total Stock Value:</span>
              <span className="font-mono text-lg font-black text-[#6366F1]">
                ₹{totalValue.toFixed(2)}
              </span>
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
                setValue("attachments", newUrls);
              }}
            />
          </div>

          {/* Remarks & Notes */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Remarks / Reason</label>
              <input
                type="text"
                placeholder="e.g. Monthly audit adjustment"
                {...register("remarks")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Internal Notes</label>
              <textarea
                rows={3}
                placeholder="Enter stock entry notes..."
                {...register("notes")}
                className="w-full p-2.5 border border-[#CBD5E1] rounded-lg text-xs"
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
