"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, AlertTriangle, Package } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Form validation schema
const materialSchema = z.object({
  name: z.string().min(2, "Material Name must be at least 2 characters"),
  description: z.string().optional(),
  category: z.string().min(1, "Please select or type a category"),
  unit: z.string().min(1, "Please select or specify a unit"),
  image_url: z.string().optional(),
  reorder_level: z.string(),
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
  is_active: boolean;
  updated_at: string;
}

const CATEGORIES = ["Fabric", "Thread", "Button", "Elastic", "Zipper", "Label", "Packaging", "Other"];
const UNITS = ["Meters", "Kilograms", "Pieces", "Cones", "Yards", "Rolls", "Sets"];

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterialType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterialType | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingMaterial, setDeletingMaterial] = useState<RawMaterialType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [selectedMaterialDetails, setSelectedMaterialDetails] = useState<RawMaterialType | null>(null);

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

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/raw-materials");
      if (!res.ok) throw new Error("Failed to load materials");
      const result = await res.json();
      setMaterials(result.materialTypes || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching materials list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    reset({
      name: "",
      description: "",
      category: "Fabric",
      unit: "Meters",
      image_url: "",
      reorder_level: "0",
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
      is_active: material.is_active,
    });
    setModalOpen(true);
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
      fetchMaterials();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
      fetchMaterials();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
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
      width: "80px",
      render: (row) =>
        row.image_url ? (
          <img
            src={row.image_url}
            alt={row.name}
            className="w-10 h-10 object-contain rounded border border-[#E5E7EB] bg-[#F8FAFC] p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded border border-[#E5E7EB] bg-[#F1F5F9] flex items-center justify-center text-[10px] font-bold text-[#94A3B8] uppercase">
            No Image
          </div>
        ),
    },
    {
      key: "name",
      header: "Material Name",
      render: (row) => (
        <button
          onClick={() => setSelectedMaterialDetails(row)}
          className="font-bold text-[#6366F1] hover:underline cursor-pointer text-left bg-transparent border-0 p-0"
        >
          {row.name}
        </button>
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
        <span className="text-xs font-semibold text-[#475569]">{row.unit}</span>
      ),
    },
    {
      key: "reorder",
      header: "Reorder Alert Level",
      render: (row) => (
        <div className="flex items-center gap-1.5 font-bold font-mono text-xs text-[#E11D48]">
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
            onClick={() => handleOpenEdit(row)}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Material"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
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

      <DataTable
        columns={columns}
        data={filteredMaterials}
        isLoading={loading}
        total={filteredMaterials.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        emptyMessage="No material categories configured. Click Add Material Type to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingMaterial ? "Edit Material Configuration" : "Add Material Configuration"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Image Upload */}
              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
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
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Material Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cotton Drill Navy 240GSM, YKK Zipper 8-inch"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs font-semibold text-[#DC2626]">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Material Category *
                </label>
                <select
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
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
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Measurement Unit *
                </label>
                <select
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155]"
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
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Reorder Level Alert Threshold
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("reorder_level")}
                />
              </div>

              {/* Description */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Specification / Notes
                </label>
                <textarea
                  placeholder="Material specifications, yarn count, density, thread weight, etc."
                  rows={2}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                  {...register("description")}
                />
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6]">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Active Material</h4>
                <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                  Allows purchase and lot consumption tagging.
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
                  "Save Material"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Soft Delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Raw Material Type?"
        description={`Are you sure you want to delete material type "${deletingMaterial?.name}"? Historical stock logs will maintain reference, but new purchase orders cannot select this item.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      {/* View Raw Material Details Modal */}
      <Dialog open={selectedMaterialDetails !== null} onOpenChange={(open) => !open && setSelectedMaterialDetails(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Package className="h-5 w-5 text-[#6366F1]" />
              Raw Material Details
            </DialogTitle>
          </DialogHeader>

          {selectedMaterialDetails && (
            <div className="space-y-4 pt-3 text-sm text-[#374151]">
              <div className="flex items-center gap-4 border-b border-[#F3F4F6] pb-4">
                {selectedMaterialDetails.image_url ? (
                  <img
                    src={selectedMaterialDetails.image_url}
                    alt={selectedMaterialDetails.name}
                    className="w-16 h-16 object-contain rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-1.5"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-[#E5E7EB] bg-[#F1F5F9] flex items-center justify-center text-xs font-bold text-[#94A3B8] uppercase">
                    No Image
                  </div>
                )}
                <div>
                  <h4 className="text-base font-bold text-[#0F172A]">{selectedMaterialDetails.name}</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                    <Badge variant="purple" className="text-[10px] font-bold uppercase tracking-wider">
                      {selectedMaterialDetails.category || "General"}
                    </Badge>
                    <StatusBadge active={selectedMaterialDetails.is_active} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Measurement Unit</span>
                  <span className="font-semibold text-xs text-[#334155]">{selectedMaterialDetails.unit}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Reorder Alert Level</span>
                  <span className="font-mono text-xs font-bold text-[#E11D48] flex items-center gap-1">
                    <AlertTriangle size={12} /> {selectedMaterialDetails.reorder_level} {selectedMaterialDetails.unit}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-bold text-[#64748B] block uppercase tracking-wider">Description</span>
                  <p className="text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                    {selectedMaterialDetails.description || "No description provided."}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-2">
            <button
              onClick={() => setSelectedMaterialDetails(null)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-all cursor-pointer"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
