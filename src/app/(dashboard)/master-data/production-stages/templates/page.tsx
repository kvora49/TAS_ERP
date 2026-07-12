"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import { Pencil, Trash2, Plus, RefreshCw, Star, Layers } from "lucide-react";
import { toast } from "sonner";



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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ProductionTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    router.push("/master-data/production-stages/templates/new");
  };

  const handleOpenEdit = (template: ProductionTemplate) => {
    router.push(`/master-data/production-stages/templates/${template.id}`);
  };

  const handleOpenDelete = (template: ProductionTemplate) => {
    setDeletingTemplate(template);
    setDeleteOpen(true);
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
