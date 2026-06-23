"use client";

import { useEffect, useState, KeyboardEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Form validation schema
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
  const [sizeSets, setSizeSets] = useState<SizeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSizeSet, setEditingSizeSet] = useState<SizeSet | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSizeSet, setDeletingSizeSet] = useState<SizeSet | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Custom state for managing individual size tag input
  const [sizeInput, setSizeInput] = useState("");

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

  const fetchSizeSets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/size-sets");
      if (!res.ok) throw new Error("Failed to load size sets");
      const result = await res.json();
      setSizeSets(result.sizeSets || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching size sets list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSizeSets();
  }, []);

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
      fetchSizeSets();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (sizeSet: SizeSet) => {
    setDeletingSizeSet(sizeSet);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSizeSet) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/size-sets/${deletingSizeSet.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete size set");
      }

      toast.success("Size set deleted successfully");
      setDeleteOpen(false);
      fetchSizeSets();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Tag chip addition
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
        <span className="font-bold text-[#0F172A]">{row.name}</span>
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
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Size Set"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete Size Set"
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

      <DataTable
        columns={columns}
        data={filteredSizeSets}
        isLoading={loading}
        total={filteredSizeSets.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        emptyMessage="No size sets found. Click 'Add Size Set' to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingSizeSet ? "Edit Size Set" : "Add Size Set"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Size Set Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Adult Unisex, Toddler, Jeans Sizing"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Chips input for Sizes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Configure Sizes *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type size (e.g. S) and press Enter or comma"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={addSizeTag}
                  className="h-10 px-4 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] hover:bg-[#E2E8F0] text-sm font-semibold text-[#374151] transition-all cursor-pointer"
                >
                  Add
                </button>
              </div>

              {errors.sizes && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {errors.sizes.message}
                </p>
              )}

              {/* Tag Render Container */}
              <div className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-xl p-3 min-h-[100px] flex flex-wrap gap-2 items-start mt-2">
                {sizes.length === 0 ? (
                  <span className="text-xs text-[#94A3B8] italic">No sizes added. Configure tags above to build size scales.</span>
                ) : (
                  sizes.map((size, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 bg-[#EEF2FF] border border-[#E2E8F0] text-[#4F46E5] text-xs font-bold px-2.5 py-1 rounded-lg select-none"
                    >
                      {size}
                      <button
                        type="button"
                        onClick={() => removeSizeTag(idx)}
                        className="w-4 h-4 rounded-full hover:bg-[#6366F1]/10 text-[#6366F1] inline-flex items-center justify-center cursor-pointer transition-all"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Active status */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Active Sizing Scale</h4>
                <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                  Controls availability when styling new designs.
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
                  "Save Size Set"
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
        title="Delete Size Set?"
        description={`Are you sure you want to delete size set "${deletingSizeSet?.name}"? New design templates cannot select this size scale.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
