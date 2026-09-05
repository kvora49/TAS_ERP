"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import { Pencil, Trash2, Plus, RefreshCw, AlertTriangle, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useERPQuery } from "@/hooks/useERPQuery";
import { toast } from "sonner";
import { useGstRateLookup } from "@/hooks/useGstRateLookup";

// Form validation schema
const materialSchema = z.object({
  name: z.string().min(2, "Material Name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Please select or type a category"),
  unit: z.string().min(1, "Please select or specify a unit"),
  image_url: z.string().optional(),
  reorder_level: z.string(),
  hsn_code: z.string().optional(),
  gst_percent: z.string().optional(),
  is_active: z.boolean(),
});

type MaterialFormValues = z.infer<typeof materialSchema>;

interface RawMaterialType {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  image_url: string | null;
  reorder_level: number;
  hsn_code?: string | null;
  gst_percent?: number | null;
  is_active: boolean;
  updated_at: string;
}

const CATEGORIES = ["Fabric", "Thread", "Button", "Elastic", "Zipper", "Label", "Packaging", "Other"];
const UNITS = ["Meters", "Kilograms", "Pieces", "Cones", "Yards", "Rolls", "Sets"];

export default function RawMaterialsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lookupGst, hsnOptions } = useGstRateLookup();
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterialType | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<RawMaterialType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaterialFormValues>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "Fabric",
      unit: "Meters",
      image_url: "",
      reorder_level: "0",
      is_active: true,
    },
  });

  const imageUrl = watch("image_url");

  const { data: materialsData, isLoading: loading } = useERPQuery<RawMaterialType[]>(["raw-materials-list"], async () => {
    const res = await fetch("/api/raw-materials");
    if (!res.ok) throw new Error("Failed to load materials");
    const result = await res.json();
    return result.materialTypes || [];
  }, { skeleton: "table" });

  const materials = materialsData || [];

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    reset({
      name: "",
      description: "",
      category: "Fabric",
      unit: "Meters",
      image_url: "",
      reorder_level: "0",
      hsn_code: "",
      gst_percent: "",
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (material: RawMaterialType) => {
    setEditingMaterial(material);
    reset({
      name: material.name,
      description: material.description || "",
      category: material.category || "Fabric",
      unit: material.unit || "Meters",
      image_url: material.image_url || "",
      reorder_level: String(material.reorder_level || 0),
      hsn_code: material.hsn_code || "",
      gst_percent: material.gst_percent !== undefined && material.gst_percent !== null ? String(material.gst_percent) : "",
      is_active: material.is_active,
    });
    setModalOpen(true);
  };

  const handleHsnChange = (code: string) => {
    setValue("hsn_code", code);
    const resolved = lookupGst(code, 0);
    if (resolved) {
      setValue("gst_percent", String(resolved.gstPercent));
    }
  };

  const onSubmit = async (values: MaterialFormValues) => {
    try {
      const url = editingMaterial
        ? `/api/raw-materials/${editingMaterial.id}`
        : "/api/raw-materials";

      const method = editingMaterial ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingMaterial?.updated_at,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save raw material type");
      }

      toast.success(
        editingMaterial
          ? "Raw material updated successfully"
          : "Raw material created successfully"
      );
      setModalOpen(false);
      queryClient.setQueryData(["raw-materials-list"], (old: RawMaterialType[] | undefined) => {
        if (!old) return [data.materialType];
        if (editingMaterial) {
          return old.map((m) => (m.id === data.materialType.id ? data.materialType : m));
        }
        return [data.materialType, ...old];
      });
      queryClient.invalidateQueries({ queryKey: ["raw-materials-list"], refetchType: "none" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    }
  };

  const handleOpenDelete = (material: RawMaterialType) => {
    setDeletingMaterial(material);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMaterial) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/raw-materials/${deletingMaterial.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete raw material");
      }

      toast.success("Raw material deleted successfully");
      setDeleteOpen(false);
      setDeletingMaterial(null);
      queryClient.setQueryData(["raw-materials-list"], (old: RawMaterialType[] | undefined) => {
        if (!old) return [];
        return old.filter((m) => m.id !== deletingMaterial.id);
      });
      queryClient.invalidateQueries({ queryKey: ["raw-materials-list"], refetchType: "none" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred during deletion";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredMaterials = materials.filter((mat) =>
    mat.name.toLowerCase().includes(search.toLowerCase()) ||
    (mat.category && mat.category.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: DataTableColumn<RawMaterialType>[] = [
    {
      key: "thumbnail",
      header: "Preview",
      width: "130px",
      render: (row) =>
        row.image_url ? (
          <div
            className="relative group w-20 h-20 sm:w-24 sm:h-24 shrink-0 my-1 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setZoomImageUrl(row.image_url);
            }}
            title="Click to preview full size"
          >
            <img
              src={row.image_url}
              alt={row.name}
              className="w-full h-full object-cover rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-sm group-hover:scale-105 transition-all duration-200"
            />
            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold select-none">
              <span className="bg-black/70 px-2 py-1 rounded-md shadow-sm">Zoom 🔍</span>
            </div>
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg border border-dashed border-[var(--border)] bg-[var(--page-bg)]/40 flex items-center justify-center text-xs font-semibold text-[var(--text-muted)]">
            —
          </div>
        ),
    },
    {
      key: "name",
      header: "Material Name",
      render: (row) => (
        <span className="font-bold text-[var(--primary)] cursor-pointer">
          {row.name}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <Badge variant="purple" className="text-xs font-bold uppercase tracking-wider">
          {row.category || "General"}
        </Badge>
      ),
    },
    {
      key: "unit",
      header: "Measurement Unit",
      render: (row) => (
        <span className="text-xs font-semibold text-[var(--text-secondary)]">{row.unit}</span>
      ),
    },
    {
      key: "reorder",
      header: "Reorder Alert Level",
      render: (row) => (
        <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle size={13} />
          {row.reorder_level} {row.unit}
        </div>
      ),
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
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Material"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-rose-500/20 rounded-lg hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer transition-all"
            title="Delete Material"
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
        title="Raw Materials"
        subtitle="Manage resource items and threshold triggers for manufacturing"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Raw Materials" },
        ]}
        searchPlaceholder="Search material name or category..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Material Type"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      {/* ── MOBILE: Raw Materials Card List ── */}
      <div className="md:hidden space-y-3">
        {filteredMaterials.length === 0 ? (
          <div className="text-center py-10 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 text-sm text-[var(--text-muted)]">
            No raw material types found.
          </div>
        ) : (
          filteredMaterials.map((mat) => (
            <div
              key={mat.id}
              onClick={() => router.push(`/master-data/raw-materials/${mat.id}`)}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3 cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start gap-3">
                {mat.image_url ? (
                  <div
                    className="w-16 h-16 rounded-xl border border-[var(--border)] overflow-hidden shrink-0 bg-[var(--page-bg)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomImageUrl(mat.image_url);
                    }}
                  >
                    <img src={mat.image_url} alt={mat.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-dashed border-[var(--border)] bg-[var(--page-bg)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                    <Package size={20} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <Badge variant="purple" className="text-[10px] font-bold uppercase tracking-wider">
                      {mat.category || "General"}
                    </Badge>
                    <StatusBadge active={mat.is_active} />
                  </div>
                  <h4 className="font-bold text-sm text-[var(--text-primary)] mt-1 truncate">{mat.name}</h4>
                  <p className="text-xs text-[var(--text-muted)]">Unit: <span className="font-semibold text-[var(--text-secondary)]">{mat.unit}</span></p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-2 text-xs">
                <div className="flex items-center gap-1 font-bold font-mono text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={12} />
                  <span>Reorder: {mat.reorder_level} {mat.unit}</span>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(mat)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(mat)}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── DESKTOP: DataTable ── */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filteredMaterials}
          isLoading={loading}
          total={filteredMaterials.length}
          page={1}
          perPage={10}
          onPageChange={() => {}}
          onRowClick={(row) => router.push(`/master-data/raw-materials/${row.id}`)}
          emptyMessage="No material categories configured. Click Add Material Type to create one."
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingMaterial ? "Edit Material Configuration" : "Add Material Configuration"}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Image Upload */}
            <div className="sm:col-span-2 flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Material Image (Swatch/Photo)
              </label>
              <ImageUpload
                value={imageUrl}
                folder="material_thumbnails"
                onChange={(url) => setValue("image_url", url)}
                onRemove={() => setValue("image_url", "")}
                label="Upload Swatch / Photo"
              />
            </div>

            {/* Material Name */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Material Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Cotton Drill Navy 240GSM, YKK Zipper 8-inch"
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs font-semibold text-rose-500">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Material Category *
              </label>
              <select
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors cursor-pointer font-semibold"
                {...register("category")}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Measurement Unit *
              </label>
              <select
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors cursor-pointer font-semibold"
                {...register("unit")}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Reorder Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Reorder Level Alert Threshold
              </label>
              <input
                type="number"
                placeholder="e.g. 50"
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors"
                {...register("reorder_level")}
              />
            </div>

            {/* HSN / SAC Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                HSN / SAC Code
              </label>
              <input
                type="text"
                list="raw-materials-hsn-datalist"
                placeholder="e.g. 5208, 6006"
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm font-mono transition-colors"
                {...register("hsn_code")}
                onChange={(e) => {
                  register("hsn_code").onChange(e);
                  handleHsnChange(e.target.value);
                }}
              />
              <datalist id="raw-materials-hsn-datalist">
                {hsnOptions.map((opt) => (
                  <option key={opt.hsn_code} value={opt.hsn_code}>
                    {opt.label}
                  </option>
                ))}
              </datalist>
            </div>

            {/* GST Percent */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                GST Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5, 12, 18"
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm font-mono transition-colors"
                {...register("gst_percent")}
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Specification / Notes
              </label>
              <textarea
                placeholder="Material specifications, yarn count, density, thread weight, etc."
                rows={2}
                className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg text-sm transition-colors resize-none"
                {...register("description")}
              />
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-light)]">
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Material</h4>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                Allows purchase and lot consumption tagging.
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
              {...register("is_active")}
            />
          </div>

          <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-body)] transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[var(--primary)]/10"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Material"
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Soft Delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Raw Material Type?"
        description={`Are you sure you want to delete material type "${deletingMaterial?.name}"? Historical stock logs will maintain reference, but new purchase orders cannot select this item.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      {/* Image Preview Lightbox Modal */}
      <Modal
        open={!!zoomImageUrl}
        onOpenChange={() => setZoomImageUrl(null)}
        title="Material Image Preview"
        maxWidth="max-w-2xl"
      >
        {zoomImageUrl && (
          <div className="w-full flex items-center justify-center p-2 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <img
              src={zoomImageUrl}
              alt="Full size material image"
              className="max-h-[70vh] object-contain rounded-lg shadow-md"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
