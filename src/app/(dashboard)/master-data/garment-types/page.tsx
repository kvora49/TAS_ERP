"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, Shirt } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const garmentTypeSchema = z.object({
  name: z.string().min(2, "Garment Type name must be at least 2 characters"),
});

type GarmentTypeFormValues = z.infer<typeof garmentTypeSchema>;

interface GarmentType {
  id: string;
  name: string;
  created_at: string;
}

export default function GarmentTypesPage() {
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<GarmentType | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingType, setDeletingType] = useState<GarmentType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GarmentTypeFormValues>({
    resolver: zodResolver(garmentTypeSchema),
    defaultValues: {
      name: "",
    },
  });

  const fetchGarmentTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/garment-types");
      if (!res.ok) throw new Error("Failed to load garment types");
      const result = await res.json();
      setGarmentTypes(result.garmentTypes || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching garment types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarmentTypes();
  }, []);

  const handleOpenAdd = () => {
    setEditingType(null);
    reset({
      name: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (type: GarmentType) => {
    setEditingType(type);
    reset({
      name: type.name,
    });
    setModalOpen(true);
  };

  const handleOpenDelete = (type: GarmentType) => {
    setDeletingType(type);
    setDeleteOpen(true);
  };

  const onSubmit = async (data: GarmentTypeFormValues) => {
    try {
      const url = editingType
        ? `/api/master-data/garment-types/${editingType.id}`
        : "/api/master-data/garment-types";
      const method = editingType ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to save garment type");
      }

      toast.success(
        editingType
          ? "Garment type updated successfully"
          : "Garment type created successfully"
      );
      setModalOpen(false);
      fetchGarmentTypes();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingType) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/garment-types/${deletingType.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to delete garment type");
      }

      toast.success("Garment type deleted successfully");
      setDeleteOpen(false);
      fetchGarmentTypes();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete garment type");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = garmentTypes.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: DataTableColumn<GarmentType>[] = [
    {
      key: "name",
      header: "Garment Type Name",
      render: (row) => (
        <div className="flex items-center gap-2 font-bold text-[#0F172A]">
          <Shirt size={16} className="text-[#6366F1]" />
          <span>{row.name}</span>
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Date Created",
      render: (row) => (
        <span className="text-[#64748B] font-medium">
          {new Date(row.created_at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "120px",
      render: (row) => (
        <div className="flex items-center gap-2 select-none" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenEdit(row)}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Type"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete Type"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-[#64748B] select-none">
          <Link href="/" className="hover:text-[#0F172A] transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <span>Master Data</span>
          <span>/</span>
          <span className="text-[#0F172A]">Garment Types</span>
        </div>
      </div>

      <PageHeader
        title="Garment Types"
        subtitle="Manage product category classifications for design templates"
        searchPlaceholder="Search garment type name..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Garment Type"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loading}
        total={filtered.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        emptyMessage="No garment types defined yet. Click Add Garment Type to begin."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingType ? "Edit Garment Type" : "Add Garment Type"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Type Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Garment Type Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Jeans, Jacket, T-Shirt"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {errors.name.message}
                </p>
              )}
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
                  "Save Garment Type"
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Garment Type"
        description={`Are you sure you want to delete the garment type "${deletingType?.name}"? Any active designs referencing this garment type will continue to show it.`}
        confirmText="Delete Type"
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </div>
  );
}
