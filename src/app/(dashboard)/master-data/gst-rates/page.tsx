"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Pencil, Trash2, Plus, HelpCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useGstRatesList } from "@/hooks/queries/useMasterData";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGst, setEditingGst] = useState<GstRate | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingGst, setDeletingGst] = useState<GstRate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: gstRatesData, isLoading: loading, error, refetch } = useGstRatesList();
  const gstRates: GstRate[] = gstRatesData?.gstRates || [];

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
      queryClient.invalidateQueries({ queryKey: ["master-data", "gst-rates"] });
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
      queryClient.invalidateQueries({ queryKey: ["master-data", "gst-rates"] });
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
        <span className="font-bold font-mono text-sm text-[var(--primary)] cursor-pointer">
          {row.hsn_code}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description / Item Type",
      render: (row) => (
        <span className="text-[var(--text-muted)] text-xs font-semibold max-w-xs block truncate">
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
                <span className="text-xs font-bold text-[var(--text-primary)]">Auto Tiering</span>
                <Badge variant="purple" className="text-[9px] px-1.5">Tiered</Badge>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-semibold">
                Threshold: ₹{row.tier_threshold} · Low: {row.tier_low_gst}% · High: {row.tier_high_gst}%
              </span>
            </div>
          );
        } else {
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[var(--text-primary)]">{row.gst_percent}%</span>
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
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit GST Rate"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
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

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error ? (error instanceof Error ? error.message : "Failed to load GST rates") : undefined}
        onRetry={refetch}
        isEmpty={filteredRates.length === 0}
        emptyTitle="No GST Rates Found"
        emptyMessage="No HSN tax codes configured yet. Click Add GST Rate to create tax rules."
        emptyAction={
          <AsyncButton onClick={handleOpenAdd} variant="primary">
            + Add First GST Rate
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={5}
      >
        <DataTable
          columns={columns}
          data={filteredRates}
          isLoading={false}
          total={filteredRates.length}
          page={1}
          perPage={10}
          onPageChange={() => {}}
          onRowClick={(row) => router.push(`/master-data/gst-rates/${row.id}`)}
          emptyMessage="No matching GST rate configurations found."
        />
      </PageState>

      {/* Add/Edit Shared Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingGst ? "Edit Tax Configuration" : "Add Tax Configuration"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* HSN Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              HSN Code *
            </label>
            <input
              type="text"
              placeholder="e.g. 6203, 6204"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all font-mono"
              {...register("hsn_code")}
            />
            {errors.hsn_code && (
              <p className="text-xs font-semibold text-red-500">
                {errors.hsn_code.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Description / Material Tag
            </label>
            <textarea
              placeholder="e.g. Woven fabrics of cotton, Knitted shirts"
              rows={2}
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all resize-none"
              {...register("description")}
            />
          </div>

          {/* Flat Base GST percent */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Base GST Percent (%) *
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 5, 12, 18"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
              {...register("gst_percent")}
            />
            {errors.gst_percent && (
              <p className="text-xs font-semibold text-red-500">
                {errors.gst_percent.message}
              </p>
            )}
          </div>

          {/* Auto-tiering Toggle */}
          <div className="flex items-center justify-between border border-[var(--border)] p-3 rounded-xl bg-[var(--page-bg)]">
            <div className="flex gap-2 items-start flex-1 pr-2">
              <div className="mt-0.5">
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Enable Auto-Tier Slabs</h4>
                <p className="text-[10px] text-[var(--text-muted)] font-medium leading-normal mt-0.5">
                  For garments, check this to automatically switch tax percentage based on transaction value.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
              {...register("auto_tier")}
            />
          </div>

          {/* Auto-tiering Sub-fields */}
          {autoTier && (
            <div className="border border-[var(--border)] bg-[var(--card-bg)] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-[var(--border)] pb-1.5 mb-1.5">
                <HelpCircle size={14} className="text-[var(--primary)]" />
                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Configure Slabs</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Threshold (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="1000"
                    className="w-full h-9 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-xs font-mono"
                    {...register("tier_threshold")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Below (%)
                  </label>
                  <input
                    type="number"
                    placeholder="5"
                    className="w-full h-9 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-xs font-mono"
                    {...register("tier_low_gst")}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Above (%)
                  </label>
                  <input
                    type="number"
                    placeholder="12"
                    className="w-full h-9 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-xs font-mono"
                    {...register("tier_high_gst")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Tax Option</h4>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                Allows selection on bills and materials.
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
              {...register("is_active")}
            />
          </div>

          <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-muted)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="submit"
              isLoading={isSubmitting}
              variant="primary"
              className="h-10 px-4 text-sm font-semibold"
            >
              Save Config
            </AsyncButton>
          </div>
        </form>
      </Modal>

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
