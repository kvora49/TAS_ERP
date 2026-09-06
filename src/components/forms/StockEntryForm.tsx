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
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema) as any,
    defaultValues,
  });

  useUnsavedChangesGuard(isDirty);

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
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Record Stock Entry</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Input manual adjustments, physical stock updates, and batch lot parameters.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/raw-materials/stock"
            className="px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg transition-all shadow-md shadow-[var(--primary)]/20 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Stock Entry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-[var(--primary)] pl-2.5">
              1. Entry Header Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Entry Type *</label>
                <select
                  {...register("entry_type")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                >
                  <option value="stock_in" className="text-green-600 bg-[var(--card-bg)]">Stock In (Inward)</option>
                  <option value="stock_out" className="text-red-600 bg-[var(--card-bg)]">Stock Out (Outward)</option>
                  <option value="adjustment" className="text-purple-600 bg-[var(--card-bg)]">Adjustment (Variance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Godown Location *</label>
                <select
                  disabled={loadingGodowns}
                  {...register("godown_id")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                >
                  <option value="" className="bg-[var(--card-bg)]">Select Godown</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id} className="bg-[var(--card-bg)]">
                      {g.name}
                    </option>
                  ))}
                </select>
                {errors.godown_id && <p className="text-[10px] text-red-500 mt-1">{errors.godown_id.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Posting Date *</label>
                <input
                  type="date"
                  {...register("posting_date")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                />
                {errors.posting_date && <p className="text-[10px] text-red-500 mt-1">{errors.posting_date.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Reference Doc Type</label>
                <select
                  {...register("reference_type")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                >
                  <option value="manual" className="bg-[var(--card-bg)]">Manual Entry</option>
                  <option value="purchase_invoice" className="bg-[var(--card-bg)]">Purchase Invoice</option>
                  <option value="return" className="bg-[var(--card-bg)]">Purchase Return</option>
                  <option value="transfer" className="bg-[var(--card-bg)]">Godown Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Reference No.</label>
                <input
                  type="text"
                  placeholder="e.g. PO-8921"
                  {...register("reference_no")}
                  className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-[var(--primary)] pl-2.5">
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
                className="px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Item Row
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)]">
                No items added yet. Click &quot;Add Item Row&quot; to configure.
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="border border-[var(--border)] rounded-xl p-4 bg-[var(--page-bg)] space-y-3 relative"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
                        Item #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-5">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          Raw Material Type *
                        </label>
                        <select
                          disabled={loadingMaterials}
                          {...register(`items.${index}.material_type_id` as const)}
                          onChange={(e) => handleMaterialChange(index, e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                        >
                          <option value="" className="bg-[var(--card-bg)]">Select Material</option>
                          {materialTypes.map((m) => (
                            <option key={m.id} value={m.id} className="bg-[var(--card-bg)]">
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

                      <div className="md:col-span-4">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          HSN / SAC Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 5208"
                          {...register(`items.${index}.hsn_sac` as const)}
                          className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          Unit of Measure
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. meter, kg, pcs"
                          {...register(`items.${index}.unit` as const)}
                          className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                        />
                        {errors.items?.[index]?.unit && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.items[index]?.unit?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          Quantity *
                        </label>
                        <NumericInput
                          step="0.01"
                          placeholder="0.00"
                          {...register(`items.${index}.quantity` as const)}
                          onChange={(e) => {
                            register(`items.${index}.quantity` as const).onChange(e);
                            recalcItem(index);
                          }}
                          className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.items[index]?.quantity?.message}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          Unit Cost (₹) *
                        </label>
                        <NumericInput
                          step="0.01"
                          placeholder="0.00"
                          {...register(`items.${index}.rate` as const)}
                          onChange={(e) => {
                            register(`items.${index}.rate` as const).onChange(e);
                            recalcItem(index);
                          }}
                          className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                        />
                        {errors.items?.[index]?.rate && (
                          <p className="text-[10px] text-red-500 mt-1">
                            {errors.items[index]?.rate?.message}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          Batch / Lot No.
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. B-987"
                          {...register(`items.${index}.batch_lot_no` as const)}
                          className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          {...register(`items.${index}.expiry_date` as const)}
                          className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                          Amount (₹)
                        </label>
                        <div className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-right font-mono font-black text-[var(--primary)] bg-[var(--primary-light)]">
                          ₹{Number(watchItems[index]?.amount || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <div className="flex items-center gap-3 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] px-5 py-2.5 rounded-xl shadow-[var(--shadow-sm)]">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">Total Items Value:</span>
                    <span className="font-mono font-black text-lg text-[var(--primary)]">
                      ₹{totalValue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)] space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] border-l-4 border-[var(--primary)] pl-2.5">
              3. Summary Details
            </h2>
            <div className="flex justify-between items-center bg-[var(--page-bg)] p-3 rounded-lg border border-[var(--border)] font-bold text-[var(--text-primary)]">
              <span className="text-[var(--text-muted)] text-xs uppercase">Total Stock Value:</span>
              <span className="font-mono text-lg font-black text-[var(--primary)]">
                ₹{totalValue.toFixed(2)}
              </span>
            </div>
          </div>

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
                setValue("attachments", newUrls);
              }}
            />
          </div>

          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-6 shadow-[var(--shadow-sm)] space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Remarks / Reason</label>
              <input
                type="text"
                placeholder="e.g. Monthly audit adjustment"
                {...register("remarks")}
                className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Internal Notes</label>
              <textarea
                rows={3}
                placeholder="Enter stock entry notes..."
                {...register("notes")}
                className="w-full p-2.5 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-colors"
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
