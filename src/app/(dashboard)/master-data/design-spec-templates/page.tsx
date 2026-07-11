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
import { Pencil, Trash2, Plus, RefreshCw, Layers, ClipboardList } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Zod validation schemas
const fieldSchema = z.object({
  name: z.string().min(1, "Field Name is required"),
  type: z.enum(["text", "textarea", "dropdown", "photo"]),
  options: z.string().optional(), // Comma-separated options for dropdown
});

const templateSchema = z.object({
  garment_type_id: z.string().min(1, "Garment Type is required"),
  fields: z.array(fieldSchema),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

interface GarmentType {
  id: string;
  name: string;
}

interface SpecField {
  name: string;
  type: "text" | "textarea" | "dropdown" | "photo";
  options?: string;
}

interface SpecTemplate {
  id: string;
  garment_type_id: string;
  fields: SpecField[];
  created_at: string;
  garment_types?: {
    name: string;
  };
}

export default function DesignSpecTemplatesPage() {
  const [templates, setTemplates] = useState<SpecTemplate[]>([]);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SpecTemplate | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<SpecTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      garment_type_id: "",
      fields: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "fields",
  });

  const watchFields = watch("fields") || [];

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const [resTemplates, resGarmentTypes] = await Promise.all([
        fetch("/api/master-data/design-spec-templates"),
        fetch("/api/master-data/garment-types"),
      ]);

      if (!resTemplates.ok) throw new Error("Failed to load templates");
      if (!resGarmentTypes.ok) throw new Error("Failed to load garment types");

      const tData = await resTemplates.json();
      const gData = await resGarmentTypes.json();

      setTemplates(tData.templates || []);
      setGarmentTypes(gData.garmentTypes || []);
    } catch (err: any) {
      toast.error(err.message || "Error loading page assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleOpenAdd = () => {
    setEditingTemplate(null);
    reset({
      garment_type_id: garmentTypes[0]?.id || "",
      fields: [{ name: "", type: "text", options: "" }],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (template: SpecTemplate) => {
    setEditingTemplate(template);
    reset({
      garment_type_id: template.garment_type_id,
      fields: (template.fields || []).map((f) => ({
        name: f.name,
        type: f.type,
        options: f.options || "",
      })),
    });
    setModalOpen(true);
  };

  const handleOpenDelete = (template: SpecTemplate) => {
    setDeletingTemplate(template);
    setDeleteOpen(true);
  };

  const onSubmit = async (data: TemplateFormValues) => {
    try {
      const url = editingTemplate
        ? `/api/master-data/design-spec-templates/${editingTemplate.id}`
        : "/api/master-data/design-spec-templates";
      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to save template");
      }

      toast.success(
        editingTemplate
          ? "Template updated successfully"
          : "Template created successfully"
      );
      setModalOpen(false);
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/master-data/design-spec-templates/${deletingTemplate.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to delete template");
      }

      toast.success("Template deleted successfully");
      setDeleteOpen(false);
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = templates.filter((t) =>
    (t.garment_types?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const columns: DataTableColumn<SpecTemplate>[] = [
    {
      key: "garment_type",
      header: "Garment Type",
      render: (row) => (
        <div className="flex items-center gap-2 font-bold text-[#0F172A]">
          <ClipboardList size={16} className="text-[#6366F1]" />
          <span>{row.garment_types?.name || "Unknown"}</span>
        </div>
      ),
    },
    {
      key: "fields_count",
      header: "Custom Fields Configured",
      render: (row) => (
        <div className="flex flex-wrap gap-1 max-w-xl">
          {(row.fields || []).map((f, i) => (
            <Badge key={i} variant="purple" className="text-[10px] font-bold">
              {f.name} ({f.type})
            </Badge>
          ))}
          {(!row.fields || row.fields.length === 0) && (
            <span className="text-xs text-[#94A3B8] font-bold">No fields</span>
          )}
        </div>
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
            title="Edit Template"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete Template"
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
          <span className="text-[#0F172A]">Design Spec Templates</span>
        </div>
      </div>

      <PageHeader
        title="Design Spec Templates"
        subtitle="Configure custom measurement and detail field sheets per garment category"
        searchPlaceholder="Search by garment type..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Create Template"
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
        emptyMessage="No spec templates defined. Click Create Template to begin."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingTemplate ? "Edit Design Spec Template" : "Create Design Spec Template"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Garment Type Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Garment Type *
              </label>
              <select
                disabled={!!editingTemplate}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all cursor-pointer font-semibold text-[#334155] disabled:opacity-50"
                {...register("garment_type_id")}
              >
                {garmentTypes.map((gt) => (
                  <option key={gt.id} value={gt.id}>
                    {gt.name}
                  </option>
                ))}
              </select>
              {editingTemplate && (
                <p className="text-[10px] text-[#94A3B8] font-semibold">
                  Garment type cannot be changed after template creation.
                </p>
              )}
            </div>

            {/* Template Fields Configuration */}
            <div className="border border-[#E5E7EB] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                    Specification Fields
                  </h3>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Define custom spec properties to record when defining design files.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ name: "", type: "text", options: "" })}
                  className="h-8 px-2.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 text-[#6366F1] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Add Field
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs font-semibold text-[#64748B]">
                  No custom fields configured. Click Add Field to start.
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                      <div className="flex items-end gap-3">
                        {/* Name */}
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold text-[#475569] uppercase">
                            Field Label / Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Chest Size, Cuff Type, Zipper Style"
                            className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                            {...register(`fields.${index}.name` as const)}
                          />
                        </div>

                        {/* Type */}
                        <div className="w-32 space-y-1">
                          <label className="text-[10px] font-bold text-[#475569] uppercase">
                            Field Type
                          </label>
                          <select
                            className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                            {...register(`fields.${index}.type` as const)}
                          >
                            <option value="text">Text Box</option>
                            <option value="textarea">Paragraph Text</option>
                            <option value="dropdown">Dropdown Options</option>
                            <option value="photo">Photo / Image</option>
                          </select>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-md flex items-center justify-center cursor-pointer transition-all border border-transparent hover:border-rose-100 shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Dropdown Options Input */}
                      {watchFields[index]?.type === "dropdown" && (
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-[#475569] uppercase">
                            Dropdown Options (Comma-separated)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Regular, Slim Fit, Boxy"
                            className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                            {...register(`fields.${index}.options` as const)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
                  "Save Template"
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
        title="Delete Design Spec Template"
        description={`Are you sure you want to delete this spec template? Active designs using these spec attributes will preserve their saved values, but you won't be able to edit them against this template layout.`}
        confirmText="Delete Template"
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </div>
  );
}
