"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, HelpCircle, Percent } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Form validation schema
const gstRateSchema = z.object({
  hsn_code: z.string().min(2, "HSN Code must be at least 2 characters"),
  description: z.string().optional(),
  gst_percent: z.string().min(1, "GST Percent is required"),
  auto_tier: z.boolean(),
  tier_threshold: z.string().optional(),
  tier_low_gst: z.string().optional(),
  tier_high_gst: z.string().optional(),
  is_active: z.boolean(),
});

type GstRateFormValues = z.infer<typeof gstRateSchema>;

interface GstRate {
  id: string;
  hsn_code: string;
  description: string | null;
  gst_percent: number;
  auto_tier: boolean;
  tier_threshold: number | null;
  tier_low_gst: number | null;
  tier_high_gst: number | null;
  is_active: boolean;
  updated_at: string;
}

export default function GstRatesPage() {
  const router = useRouter();
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGst, setEditingGst] = useState<GstRate | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingGst, setDeletingGst] = useState<GstRate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GstRateFormValues>({
    resolver: zodResolver(gstRateSchema),
    defaultValues: {
      hsn_code: "",
      description: "",
      gst_percent: "5",
      auto_tier: false,
      tier_threshold: "1000",
      tier_low_gst: "5",
      tier_high_gst: "12",
      is_active: true,
    },
  });

  const autoTier = watch("auto_tier");

  const fetchGstRates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/gst-rates");
      if (!res.ok) throw new Error("Failed to load GST rates");
      const result = await res.json();
      setGstRates(result.gstRates || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching GST rates list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGstRates();
  }, []);

  const handleOpenAdd = () => {
    setEditingGst(null);
    reset({
      hsn_code: "",
      description: "",
      gst_percent: "5",
      auto_tier: false,
      tier_threshold: "1000",
      tier_low_gst: "5",
      tier_high_gst: "12",
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (gstRate: GstRate) => {
    setEditingGst(gstRate);
    reset({
      hsn_code: gstRate.hsn_code,
      description: gstRate.description || "",
      gst_percent: String(gstRate.gst_percent),
      auto_tier: gstRate.auto_tier,
      tier_threshold: gstRate.tier_threshold !== null ? String(gstRate.tier_threshold) : "1000",
      tier_low_gst: gstRate.tier_low_gst !== null ? String(gstRate.tier_low_gst) : "5",
      tier_high_gst: gstRate.tier_high_gst !== null ? String(gstRate.tier_high_gst) : "12",
      is_active: gstRate.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: GstRateFormValues) => {
    try {
      const url = editingGst
        ? `/api/master-data/gst-rates/${editingGst.id}`
        : "/api/master-data/gst-rates";

      const method = editingGst ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingGst?.updated_at,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save GST rate");
      }

      toast.success(
        editingGst ? "GST rate updated successfully" : "GST rate created successfully"
      );
      setModalOpen(false);
      fetchGstRates();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (gstRate: GstRate) => {
    setDeletingGst(gstRate);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingGst) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/gst-rates/${deletingGst.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete GST rate");
      }

      toast.success("GST rate deleted successfully");
      setDeleteOpen(false);
      fetchGstRates();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredRates = gstRates.filter((rate) =>
    rate.hsn_code.toLowerCase().includes(search.toLowerCase()) ||
    (rate.description && rate.description.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: DataTableColumn<GstRate>[] = [
    {
      key: "hsn_code",
      header: "HSN Code",
      render: (row) => (
        <span className="font-bold font-mono text-sm text-[#6366F1] hover:underline cursor-pointer">
          {row.hsn_code}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description / Item Type",
      render: (row) => (
        <span className="text-[#64748B] text-xs font-semibold max-w-xs block truncate">
          {row.description || "—"}
        </span>
      ),
    },
    {
      key: "gst_percent",
      header: "GST Rate Structure",
      render: (row) => {
        if (row.auto_tier) {
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#374151]">Auto Tiering</span>
                <Badge variant="purple" className="text-[9px] px-1.5">Tiered</Badge>
              </div>
              <span className="text-[10px] text-[#64748B] font-semibold">
                Threshold: ₹{row.tier_threshold} · Low: {row.tier_low_gst}% · High: {row.tier_high_gst}%
              </span>
            </div>
          );
        } else {
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[#1E293B]">{row.gst_percent}%</span>
              <Badge variant="gray" className="text-[9px] px-1.5">Flat</Badge>
            </div>
          );
        }
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge active={row.is_active} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "120px",
      render: (row) => (
        <div className="flex items-center gap-2 select-none">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit GST Rate"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete GST Rate"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Rates"
        subtitle="Configure HSN tax tables and auto-tiering thresholds"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "GST Rates" },
        ]}
        searchPlaceholder="Search HSN code..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add GST Rate"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <DataTable
        columns={columns}
        data={filteredRates}
        isLoading={loading}
        total={filteredRates.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        onRowClick={(row) => router.push(`/master-data/gst-rates/${row.id}`)}
        emptyMessage="No GST rate configurations found. Click 'Add GST Rate' to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingGst ? "Edit Tax Configuration" : "Add Tax Configuration"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* HSN Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                HSN Code *
              </label>
              <input
                type="text"
                placeholder="e.g. 6203, 6204"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-mono"
                {...register("hsn_code")}
              />
              {errors.hsn_code && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {errors.hsn_code.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Description / Material Tag
              </label>
              <textarea
                placeholder="e.g. Woven fabrics of cotton, Knitted shirts"
                rows={2}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                {...register("description")}
              />
            </div>

            {/* Flat Base GST percent */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Base GST Percent (%) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5, 12, 18"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                {...register("gst_percent")}
              />
              {errors.gst_percent && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {errors.gst_percent.message}
                </p>
              )}
            </div>

            {/* Auto-tiering Toggle */}
            <div className="flex items-center justify-between border border-[#E2E8F0] p-3 rounded-xl bg-[#F8FAFC]">
              <div className="flex gap-2 items-start flex-1 pr-2">
                <div className="mt-0.5">
                  <h4 className="text-xs font-bold text-[#0F172A]">Enable Auto-Tier Slabs</h4>
                  <p className="text-[10px] text-[#64748B] font-medium leading-normal mt-0.5">
                    For garments, check this to automatically switch tax percentage based on transaction value.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                {...register("auto_tier")}
              />
            </div>

            {/* Auto-tiering Sub-fields: render ONLY if auto_tier is checked */}
            {autoTier && (
              <div className="border border-[#E2E8F0] bg-white rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="flex items-center gap-1.5 border-b border-[#F3F4F6] pb-1.5 mb-1.5">
                  <HelpCircle size={14} className="text-[#6366F1]" />
                  <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Configure Slabs</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Threshold Value (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="1000"
                      className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                      {...register("tier_threshold")}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Below Threshold (%)
                    </label>
                    <input
                      type="number"
                      placeholder="5"
                      className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                      {...register("tier_low_gst")}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Above Threshold (%)
                    </label>
                    <input
                      type="number"
                      placeholder="12"
                      className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                      {...register("tier_high_gst")}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Active Status */}
            <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6]">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Active Tax Option</h4>
                <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                  Allows selection on bills and materials.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                {...register("is_active")}
              />
            </div>

            <DialogFooter className="pt-4 border-t border-[#F3F4F6] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-sm font-semibold text-[#374151] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#6366F1]/10"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Config"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Hard/Soft Delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete GST Rate?"
        description={`Are you sure you want to delete HSN code "${deletingGst?.hsn_code}"? If this tax configuration is referenced in prior transactions, deletion will block.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
