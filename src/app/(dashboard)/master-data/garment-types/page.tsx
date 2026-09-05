"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Pencil, Trash2, Plus, Shirt, ClipboardList } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useGarmentTypesList } from "@/hooks/queries/useMasterData";
import { DeleteMasterItemDialog } from "@/components/shared/DeleteMasterItemDialog";

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Centralized Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<GarmentType | null>(null);

  // Delete Garment Type Modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingType, setDeletingType] = useState<GarmentType | null>(null);

  // TanStack Query
  const { data: garmentTypesData, isLoading: loading, error, refetch } = useGarmentTypesList();
  const garmentTypes: GarmentType[] = garmentTypesData?.garmentTypes || [];

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

  const watchFieldsList = watch("fields");

  const handleOpenAdd = () => {
    setEditingType(null);
    reset({
      name: "",
      fields: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (type: GarmentType) => {
    setEditingType(type);
    reset({
      name: type.name,
      fields: type.specTemplate?.fields
        ? type.specTemplate.fields.map((f) => ({
            name: f.name,
            type: f.type,
            options: f.options || "",
          }))
        : [],
    });
    setModalOpen(true);
  };

  const handleOpenDelete = (type: GarmentType) => {
    setDeletingType(type);
    setDeleteOpen(true);
  };

  const onSubmitType = async (data: GarmentTypeFormValues) => {
    try {
      if (editingType) {
        const res = await fetch(`/api/master-data/garment-types/${editingType.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Failed to update Garment Type");
        toast.success("Garment Type updated successfully");
      } else {
        const res = await fetch("/api/master-data/garment-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.error || "Failed to create Garment Type");
        toast.success("Garment Type created successfully");
      }

      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["master-data", "garment-types"] });
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const filtered = garmentTypes.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: DataTableColumn<GarmentType>[] = [
    {
      key: "name",
      header: "Garment Type",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Shirt size={16} />
          </div>
          <span className="font-bold text-[var(--text-primary)] text-sm">{row.name}</span>
        </div>
      ),
    },
    {
      key: "fields",
      header: "Design Spec Template",
      render: (row) => {
        const specFields = row.specTemplate?.fields || [];
        if (specFields.length > 0) {
          return (
            <div className="flex flex-wrap gap-1.5 max-w-lg">
              {specFields.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-secondary)] px-2 py-0.5 rounded"
                >
                  <span>{f.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono">({f.type})</span>
                </span>
              ))}
            </div>
          );
        }
        return (
          <span className="text-xs text-[var(--text-faint)] font-medium italic">No fields defined</span>
        );
      },
    },
    {
      key: "created_at",
      header: "Date Created",
      render: (row) => (
        <span className="text-[var(--text-muted)] font-semibold text-xs">
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
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Type"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
            title="Delete Type"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
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

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error ? (error instanceof Error ? error.message : "Failed to load garment types") : undefined}
        onRetry={refetch}
        isEmpty={filtered.length === 0}
        emptyTitle="No Garment Types Found"
        emptyMessage="No garment types defined yet. Click Add Garment Type to begin."
        emptyAction={
          <AsyncButton onClick={handleOpenAdd} variant="primary">
            + Add First Garment Type
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={4}
      >
        {/* ── MOBILE: Garment Types Card List ── */}
        <div className="md:hidden space-y-3">
          {filtered.map((gt) => {
            const fieldCount = gt.specTemplate?.fields?.length || 0;
            return (
              <div key={gt.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] shrink-0">
                      <Shirt size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)] text-sm">{gt.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{fieldCount} Spec Field{fieldCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                </div>

                {fieldCount > 0 ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-light)] pt-2.5">
                    {gt.specTemplate!.fields.map((f, idx) => (
                      <span key={idx} className="text-[10px] font-bold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20 px-2 py-0.5 rounded-md">
                        {f.name} ({f.type})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-faint)] italic border-t border-[var(--border-light)] pt-2">No spec fields configured</p>
                )}

                <div className="flex items-center justify-end gap-2 border-t border-[var(--border-light)] pt-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(gt)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer hover:bg-[var(--card-bg)] transition-colors"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(gt)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-500 flex items-center gap-1 cursor-pointer hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── DESKTOP: DataTable ── */}
        <div className="hidden md:block">
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
        </div>
      </PageState>

      {/* Unified Add/Edit Garment Type & Fields Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={
          <span className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]">
            <ClipboardList className="text-[var(--primary)]" size={20} />
            <span>{editingType ? "Edit Garment Type" : "Add Garment Type"}</span>
          </span>
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmitType)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Garment Type Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Jeans, Jacket, T-Shirt"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all font-semibold"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs font-semibold text-red-500">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="border border-[var(--border)] rounded-xl p-4 space-y-4 bg-[var(--card-bg)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Design Spec Sheet Fields
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5 leading-normal max-w-md">
                  Define the fields that must be entered when creating a new Design for this Garment Type.
                </p>
              </div>
              <button
                type="button"
                onClick={() => append({ name: "", type: "text", options: "" })}
                className="h-8 px-3 rounded-lg border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary-light)] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Add Field
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-xs text-center py-6 text-[var(--text-faint)] font-bold">
                No spec fields added yet. Click &quot;Add Field&quot; to begin.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[var(--page-bg)] p-3 rounded-xl border border-[var(--border)]"
                  >
                    {/* Field Name */}
                    <div className="flex-1 w-full space-y-1">
                      <input
                        type="text"
                        placeholder="Field Name (e.g. Chest, Length, Fabric Composition)"
                        className="w-full h-9 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
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
                        className="w-full h-9 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] cursor-pointer"
                        {...register(`fields.${index}.type` as const)}
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Paragraph Description</option>
                        <option value="dropdown">Dropdown Options</option>
                        <option value="photo">Photo / Attachment</option>
                      </select>
                    </div>

                    {/* Options string input */}
                    {watchFieldsList[index]?.type === "dropdown" && (
                      <div className="w-full sm:w-44">
                        <input
                          type="text"
                          placeholder="Options (comma separated)"
                          className="w-full h-9 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                          {...register(`fields.${index}.options` as const)}
                        />
                      </div>
                    )}

                    {/* Remove Field button */}
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="w-8 h-8 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 flex items-center justify-center shrink-0 ml-auto cursor-pointer transition-colors"
                      title="Remove field"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[var(--border-light)] flex flex-col sm:flex-row gap-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="submit"
              isLoading={isSubmitting}
              variant="primary"
            >
              Save Garment Type
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* Delete Garment Type Dialog */}
      <DeleteMasterItemDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Garment Type"
        item={deletingType}
        allItems={garmentTypes}
        apiEndpoint="/api/master-data/garment-types"
        targetQueryParam="target_garment_type_id"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["master-data", "garment-types"] });
        }}
      />
    </div>
  );
}
