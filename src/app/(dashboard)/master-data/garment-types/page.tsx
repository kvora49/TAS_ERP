"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, Shirt, ClipboardList } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Zod schemas
const garmentTypeSchema = z.object({
  name: z.string().min(2, "Garment Type name must be at least 2 characters"),
  fields: z.array(
    z.object({
      name: z.string().min(1, "Field Name is required"),
      type: z.enum(["text", "textarea", "dropdown", "photo"]),
      options: z.string().optional(),
    })
  ),
});

type GarmentTypeFormValues = z.infer<typeof garmentTypeSchema>;

interface SpecField {
  name: string;
  type: "text" | "textarea" | "dropdown" | "photo";
  options?: string;
}

interface SpecTemplate {
  id: string;
  fields: SpecField[];
}

interface GarmentType {
  id: string;
  name: string;
  created_at: string;
  specTemplate: SpecTemplate | null;
}

export default function GarmentTypesPage() {
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Centralized Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<GarmentType | null>(null);

  // Delete Garment Type Modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingType, setDeletingType] = useState<GarmentType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Unified Form Hook
  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GarmentTypeFormValues>({
    resolver: zodResolver(garmentTypeSchema),
    defaultValues: {
      name: "",
      fields: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "fields",
  });

  const watchFieldsList = watch("fields") || [];

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
      fields: [{ name: "Size / Dimensions", type: "text", options: "" }],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (type: GarmentType) => {
    setEditingType(type);
    reset({
      name: type.name,
      fields: type.specTemplate?.fields?.map((f) => ({
        name: f.name,
        type: f.type,
        options: f.options || "",
      })) || [{ name: "Size / Dimensions", type: "text", options: "" }],
    });
    setModalOpen(true);
  };

  const handleOpenDelete = (type: GarmentType) => {
    setDeletingType(type);
    setDeleteOpen(true);
  };

  const onSubmitType = async (data: GarmentTypeFormValues) => {
    try {
      const url = editingType
        ? `/api/master-data/garment-types/${editingType.id}`
        : "/api/master-data/garment-types";
      const method = editingType ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to save garment type");
      }

      const typeRes = await res.json();
      const savedGarmentTypeId = editingType ? editingType.id : typeRes.garmentType?.id;

      if (savedGarmentTypeId) {
        // Save/Update the Spec Template
        const existingSpec = editingType?.specTemplate;
        const specUrl = existingSpec
          ? `/api/master-data/design-spec-templates/${existingSpec.id}`
          : "/api/master-data/design-spec-templates";
        const specMethod = existingSpec ? "PUT" : "POST";

        const specPayload = existingSpec
          ? { fields: data.fields }
          : { garment_type_id: savedGarmentTypeId, fields: data.fields };

        const specRes = await fetch(specUrl, {
          method: specMethod,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(specPayload),
        });

        if (!specRes.ok) {
          console.error("Warning: Garment type saved, but spec template configuration failed.");
        }
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
      key: "specTemplate",
      header: "Design Spec Template Fields",
      render: (row) => {
        const spec = row.specTemplate;
        if (spec && spec.fields && spec.fields.length > 0) {
          return (
            <div className="flex flex-wrap gap-1 max-w-[280px] sm:max-w-xs md:max-w-sm py-1">
              {spec.fields.map((f, idx) => (
                <Badge key={idx} variant="purple" className="text-[10px] font-bold">
                  {f.name} ({f.type})
                </Badge>
              ))}
            </div>
          );
        }

        return (
          <span className="text-xs text-[#94A3B8] font-bold italic">No fields defined</span>
        );
      },
    },
    {
      key: "created_at",
      header: "Date Created",
      render: (row) => (
        <span className="text-[#64748B] font-semibold text-xs">
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
        subtitle="Manage product types and their respective design specification entry forms"
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

      {/* Unified Add/Edit Garment Type & Fields Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <ClipboardList className="text-[#6366F1]" size={20} />
              <span>{editingType ? "Edit Garment Type" : "Add Garment Type"}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmitType)} className="space-y-4 pt-2">
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

            <div className="border border-[#E5E7EB] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                    Design Spec Sheet Fields
                  </h3>
                  <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-normal max-w-md">
                    Define the fields that must be entered when creating a new Design for this Garment Type.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ name: "", type: "text", options: "" })}
                  className="h-8 px-3 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Field
                </button>
              </div>

              {fields.length === 0 ? (
                <p className="text-xs text-center py-6 text-[#94A3B8] font-bold">
                  No spec fields added yet. Click &quot;Add Field&quot; to begin.
                </p>
              ) : (
                <div className="space-y-3">
                  {fields.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
                    >
                      {/* Field Name */}
                      <div className="flex-1 w-full space-y-1">
                        <input
                          type="text"
                          placeholder="Field Name (e.g. Chest, Length, Fabric Composition)"
                          className="w-full h-9 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold"
                          {...register(`fields.${index}.name` as const)}
                        />
                        {errors.fields?.[index]?.name && (
                          <p className="text-[10px] text-red-500 font-bold">
                            {errors.fields[index]?.name?.message}
                          </p>
                        )}
                      </div>

                      {/* Field Type selector */}
                      <div className="w-full sm:w-36">
                        <select
                          className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold"
                          {...register(`fields.${index}.type` as const)}
                        >
                          <option value="text">Short Text</option>
                          <option value="textarea">Paragraph Description</option>
                          <option value="dropdown">Dropdown Options</option>
                          <option value="photo">Photo / Attachment</option>
                        </select>
                      </div>

                      {/* Options string input (Only visible/applicable for Dropdown type) */}
                      {watchFieldsList[index]?.type === "dropdown" && (
                        <div className="w-full sm:w-44">
                          <input
                            type="text"
                            placeholder="Options (comma separated)"
                            className="w-full h-9 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold"
                            {...register(`fields.${index}.options` as const)}
                          />
                        </div>
                      )}

                      {/* Remove Field button */}
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="w-8 h-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 ml-auto cursor-pointer"
                        title="Remove field"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-[#F1F5F9] flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all cursor-pointer shadow-md shadow-[#6366F1]/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
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
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Garment Type Confirm */}
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
