"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { ModuleSubNav } from "@/components/shared/ModuleSubNav";
import { MASTER_DATA_NAV } from "@/lib/moduleNav";
import { Pencil, Trash2, Plus, Star, Layers } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<ProductionTemplate | null>(null);

  // TanStack Query
  const {
    data: templatesData,
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["master-data", "production-templates"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-templates");
      if (!res.ok) throw new Error("Failed to load production templates");
      return res.json();
    },
    staleTime: 30_000,
  });

  const templates: ProductionTemplate[] = templatesData?.templates || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/master-data/production-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to delete template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Template deleted successfully");
      setDeleteOpen(false);
      setDeletingTemplate(null);
      queryClient.invalidateQueries({ queryKey: ["master-data", "production-templates"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete template");
    },
  });

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
        <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Layers size={16} />
          </div>
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
        <span className="text-[var(--text-muted)] truncate max-w-md block">
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
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Template"
          >
            <Pencil size={15} />
          </button>
          {!row.is_default && (
            <button
              onClick={() => handleOpenDelete(row)}
              className="w-9 h-9 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
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
    <div className="space-y-4 sm:space-y-6">
      {/* ── Sub-Navigation ── */}
      <ModuleSubNav items={MASTER_DATA_NAV} />

      <PageHeader
        title="Production Stages &amp; Templates"
        subtitle="Manage workflow templates and stages for different manufacturing lines"
        searchPlaceholder="Search template name..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Template"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <PageState
        isLoading={loading}
        isError={isError}
        error={error instanceof Error ? error.message : "Failed to load templates"}
        onRetry={refetch}
        isEmpty={filteredTemplates.length === 0}
        emptyTitle="No Templates Found"
        emptyMessage="No production stage templates created yet. Click Add Template to define a workflow."
        emptyAction={
          <AsyncButton onClick={handleOpenAdd} variant="primary">
            + Add First Template
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={3}
      >
        {/* ── MOBILE: Card List View ── */}
        <div className="md:hidden space-y-3">
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              onClick={() => handleOpenEdit(t)}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                    <Layers size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-[var(--text-primary)] text-sm">{t.name}</p>
                    {t.is_default && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] mt-0.5">
                        <Star size={10} className="fill-current" /> Default Template
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {t.description && (
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 border-t border-[var(--border-light)] pt-2">
                  {t.description}
                </p>
              )}

              <div
                className="flex items-center justify-end gap-2 border-t border-[var(--border-light)] pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => handleOpenEdit(t)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer hover:bg-[var(--card-bg)] transition-colors"
                >
                  <Pencil size={12} /> Edit
                </button>
                {!t.is_default && (
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(t)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-500 flex items-center gap-1 cursor-pointer hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: DataTable ── */}
        <div className="hidden md:block">
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
        </div>
      </PageState>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Production Template"
        description={`Are you sure you want to delete the production template "${deletingTemplate?.name}"? All stages currently referencing this template will remain but won't be grouped under this template.`}
        confirmText="Delete Template"
        onConfirm={() => {
          if (deletingTemplate) deleteMutation.mutate(deletingTemplate.id);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
