"use client";

import { useEffect, useState, KeyboardEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { ModuleSubNav } from "@/components/shared/ModuleSubNav";
import { MASTER_DATA_NAV } from "@/lib/moduleNav";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { DeleteMasterItemDialog } from "@/components/shared/DeleteMasterItemDialog";
import { useSizeSetsList } from "@/hooks/queries/useMasterData";
import { useQueryClient } from "@tanstack/react-query";

const sizeSetSchema = z.object({
  name: z.string().min(2, "Size Set Name must be at least 2 characters"),
  sizes: z.array(z.string().min(1)).min(1, "At least one size tag is required"),
  is_active: z.boolean(),
});

type SizeSetFormValues = z.infer<typeof sizeSetSchema>;

interface SizeSet {
  id: string;
  name: string;
  sizes: string[];
  is_active: boolean;
  updated_at: string;
}

export default function SizeSetsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSizeSet, setEditingSizeSet] = useState<SizeSet | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSizeSet, setDeletingSizeSet] = useState<SizeSet | null>(null);

  const [sizeInput, setSizeInput] = useState("");

  const { data: sizeSetsData, isLoading: loading, error, refetch } = useSizeSetsList();
  const sizeSets: SizeSet[] = sizeSetsData?.sizeSets || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SizeSetFormValues>({
    resolver: zodResolver(sizeSetSchema),
    defaultValues: {
      name: "",
      sizes: [],
      is_active: true,
    },
  });

  const sizes = watch("sizes") || [];

  const handleOpenAdd = () => {
    setEditingSizeSet(null);
    setSizeInput("");
    reset({
      name: "",
      sizes: [],
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (sizeSet: SizeSet) => {
    setEditingSizeSet(sizeSet);
    setSizeInput("");
    reset({
      name: sizeSet.name,
      sizes: sizeSet.sizes || [],
      is_active: sizeSet.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: SizeSetFormValues) => {
    try {
      const url = editingSizeSet
        ? `/api/master-data/size-sets/${editingSizeSet.id}`
        : "/api/master-data/size-sets";

      const method = editingSizeSet ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingSizeSet?.updated_at,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save size set");
      }

      toast.success(
        editingSizeSet ? "Size set updated successfully" : "Size set created successfully"
      );
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["master-data", "size-sets"] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (sizeSet: SizeSet) => {
    setDeletingSizeSet(sizeSet);
    setDeleteOpen(true);
  };

  const addSizeTag = () => {
    const trimmed = sizeInput.trim();
    if (!trimmed) return;

    if (sizes.includes(trimmed)) {
      toast.warning(`Size "${trimmed}" is already added.`);
      return;
    }

    setValue("sizes", [...sizes, trimmed]);
    setSizeInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSizeTag();
    }
  };

  const removeSizeTag = (indexToRemove: number) => {
    setValue(
      "sizes",
      sizes.filter((_, idx) => idx !== indexToRemove)
    );
  };

  const filteredSizeSets = sizeSets.filter((set) =>
    set.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: DataTableColumn<SizeSet>[] = [
    {
      key: "name",
      header: "Size Set Name",
      render: (row) => (
        <span className="font-bold text-[var(--text-primary)]">{row.name}</span>
      ),
    },
    {
      key: "sizes",
      header: "Available Sizes",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5 max-w-lg">
          {row.sizes && row.sizes.map((size, idx) => (
            <Badge key={idx} variant="blue" className="text-xs font-bold px-2 py-0.5">
              {size}
            </Badge>
          ))}
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
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Size Set"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
            title="Delete Size Set"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <ModuleSubNav items={MASTER_DATA_NAV} />
      <PageHeader
        title="Size Sets"
        subtitle="Define standard apparel sizing standards and scale labels"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Size Sets" },
        ]}
        searchPlaceholder="Search size set..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Size Set"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error ? (error instanceof Error ? error.message : "Failed to load size sets") : undefined}
        onRetry={refetch}
        isEmpty={filteredSizeSets.length === 0}
        emptyTitle="No Size Sets Found"
        emptyMessage="No size sets configured yet. Click Add Size Set to define apparel size scales."
        emptyAction={
          <AsyncButton onClick={handleOpenAdd} variant="primary">
            + Add First Size Set
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={4}
      >
        {/* ── MOBILE: Size Set Card List ── */}
        <div className="md:hidden space-y-3">
          {filteredSizeSets.map((ss) => (
            <div key={ss.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-[var(--primary)] text-sm">{ss.name}</p>
                <StatusBadge active={ss.is_active} />
              </div>

              <div className="flex flex-wrap gap-1 border-t border-[var(--border-light)] pt-2">
                {ss.sizes?.map((sz, i) => (
                  <span key={i} className="text-xs font-bold bg-[var(--page-bg)] border border-[var(--border)] px-2 py-0.5 rounded text-[var(--text-primary)]">
                    {sz}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--border-light)] pt-2">
                <button type="button" onClick={() => handleOpenEdit(ss)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                ><Pencil size={12} /> Edit</button>
                <button type="button" onClick={() => handleOpenDelete(ss)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-600 flex items-center gap-1 cursor-pointer"
                ><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: DataTable ── */}
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={filteredSizeSets}
            isLoading={false}
            total={filteredSizeSets.length}
            page={1}
            perPage={10}
            onPageChange={() => {}}
            emptyMessage="No size sets found."
          />
        </div>
      </PageState>


      {/* Add/Edit Shared Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingSizeSet ? "Edit Size Set" : "Add Size Set"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Size Set Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Adult Unisex, Toddler, Jeans Sizing"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs font-semibold text-red-500">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Chips input for Sizes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Configure Sizes *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type size (e.g. S) and press Enter or comma"
                value={sizeInput}
                onChange={(e) => setSizeInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
              />
              <button
                type="button"
                onClick={addSizeTag}
                className="h-10 px-4 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-sm font-semibold text-[var(--text-body)] transition-all cursor-pointer"
              >
                Add
              </button>
            </div>

            {errors.sizes && (
              <p className="text-xs font-semibold text-red-500">
                {errors.sizes.message}
              </p>
            )}

            {/* Tag Render Container */}
            <div className="border border-[var(--border)] bg-[var(--page-bg)] rounded-xl p-3 min-h-[100px] flex flex-wrap gap-2 items-start mt-2">
              {sizes.length === 0 ? (
                <span className="text-xs text-[var(--text-faint)] italic">No sizes added. Configure tags above to build size scales.</span>
              ) : (
                sizes.map((size, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-[var(--primary-light)] border border-[var(--border)] text-[var(--primary)] text-xs font-bold px-2.5 py-1 rounded-lg select-none"
                  >
                    {size}
                    <button
                      type="button"
                      onClick={() => removeSizeTag(idx)}
                      className="w-4 h-4 rounded-full hover:bg-[var(--primary)]/10 text-[var(--primary)] inline-flex items-center justify-center cursor-pointer transition-all"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Active status */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Sizing Scale</h4>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                Controls availability when styling new designs.
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
              Save Size Set
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* Delete Size Set Dialog */}
      <DeleteMasterItemDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Size Set"
        item={deletingSizeSet}
        allItems={sizeSets}
        apiEndpoint="/api/master-data/size-sets"
        targetQueryParam="target_size_set_id"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["master-data", "size-sets"] })}
      />
    </div>
  );
}
