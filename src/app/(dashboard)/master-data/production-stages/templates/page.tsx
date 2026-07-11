"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Pencil, Trash2, Plus, RefreshCw, Star, Layers } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const templateSchema = z.object({
  name: z.string().min(2, "Template Name must be at least 2 characters"),
  description: z.string().optional(),
  is_default: z.boolean(),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

interface ProductionTemplate {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
}

export default function ProductionTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProductionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProductionTemplate | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ProductionTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      is_default: false,
    },
  });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/production-templates");
      if (!res.ok) throw new Error("Failed to load templates");
      const result = await res.json();
      setTemplates(result.templates || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenAdd = () => {
    setEditingTemplate(null);
    reset({
      name: "",
      description: "",
      is_default: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (template: ProductionTemplate) => {
    setEditingTemplate(template);
    reset({
      name: template.name,
      description: template.description || "",
      is_default: template.is_default,
    });
    setModalOpen(true);
  };

  const handleOpenDelete = (template: ProductionTemplate) => {
    setDeletingTemplate(template);
    setDeleteOpen(true);
  };

  const onSubmit = async (data: TemplateFormValues) => {
    try {
      const url = editingTemplate
        ? `/api/master-data/production-templates/${editingTemplate.id}`
        : "/api/master-data/production-templates";
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
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/master-data/production-templates/${deletingTemplate.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to delete template");
      }

      toast.success("Template deleted successfully");
      setDeleteOpen(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const columns: DataTableColumn<ProductionTemplate>[] = [
    {
      key: "name",
      header: "Template Name",
      render: (row) => (
        <div className="flex items-center gap-2 font-bold text-[#0F172A]">
          <span>{row.name}</span>
          {row.is_default && (
            <Badge variant="primary" className="gap-1 px-1.5 py-0.5">
              <Star size={10} className="fill-current" /> Default
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-[#64748B] truncate max-w-md block">
          {row.description || "—"}
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
            title="Edit Template"
          >
            <Pencil size={15} />
          </button>
          {!row.is_default && (
            <button
              onClick={() => handleOpenDelete(row)}
              className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
              title="Delete Template"
            >
              <Trash2 size={15} />
            </button>
          )}
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
          <span className="text-[#0F172A]">Production Templates</span>
        </div>
        <Link
          href="/master-data/production-stages"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Manage All Stages
        </Link>
      </div>

      <PageHeader
        title="Production Templates"
        subtitle="Configure sequence templates for different manufacturing workflows"
        searchPlaceholder="Search template name..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Template"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <DataTable
        columns={columns}
        data={filteredTemplates}
        isLoading={loading}
        total={filteredTemplates.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        onRowClick={(row) => router.push(`/master-data/production-stages/templates/${row.id}`)}
        emptyMessage="No templates configured yet. Click Add Template to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingTemplate ? "Edit Production Template" : "Add Production Template"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Template Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Template Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Winter Wear Template, Basic T-Shirt"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Description
              </label>
              <textarea
                placeholder="Brief details about the template usage..."
                rows={3}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                {...register("description")}
              />
            </div>

            {/* Default Status */}
            <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6]">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Set as Default Template</h4>
                <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                  New lots will auto-populate stages from this template.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                {...register("is_default")}
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
        title="Delete Production Template"
        description={`Are you sure you want to delete the production template "${deletingTemplate?.name}"? All stages currently referencing this template will remain but won't be grouped under this template.`}
        confirmText="Delete Template"
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </div>
  );
}
