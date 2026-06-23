"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Form validation schema
const expenseTypeSchema = z.object({
  name: z.string().min(2, "Expense Name must be at least 2 characters"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string(),
  applicable_for: z.array(z.string()).min(1, "Select at least one area of applicability"),
  is_active: z.boolean(),
});

type ExpenseTypeFormValues = z.infer<typeof expenseTypeSchema>;

interface ExpenseType {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  applicable_for: string[];
  is_active: boolean;
  updated_at: string;
}

const APPLICABLE_AREAS = [
  { id: "Purchase", label: "Purchase Layer" },
  { id: "Sales", label: "Sales Layer" },
  { id: "Production", label: "Production Line" },
  { id: "General", label: "General Overhead" },
];

export default function ExpenseTypesPage() {
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExpenseType | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingType, setDeletingType] = useState<ExpenseType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseTypeFormValues>({
    resolver: zodResolver(expenseTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "",
      color: "#6366F1",
      applicable_for: [],
      is_active: true,
    },
  });

  const selectedAreas = watch("applicable_for") || [];
  const selectedColor = watch("color");

  const fetchExpenseTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/expense-types");
      if (!res.ok) throw new Error("Failed to load expense types");
      const result = await res.json();
      setExpenseTypes(result.expenseTypes || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching expense types list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseTypes();
  }, []);

  const handleOpenAdd = () => {
    setEditingType(null);
    reset({
      name: "",
      description: "",
      icon: "",
      color: "#6366F1",
      applicable_for: [],
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (type: ExpenseType) => {
    setEditingType(type);
    reset({
      name: type.name,
      description: type.description || "",
      icon: type.icon || "",
      color: type.color || "#6366F1",
      applicable_for: type.applicable_for || [],
      is_active: type.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: ExpenseTypeFormValues) => {
    try {
      const url = editingType
        ? `/api/master-data/expense-types/${editingType.id}`
        : "/api/master-data/expense-types";

      const method = editingType ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingType?.updated_at,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save expense type");
      }

      toast.success(
        editingType ? "Expense type updated successfully" : "Expense type created successfully"
      );
      setModalOpen(false);
      fetchExpenseTypes();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (type: ExpenseType) => {
    setDeletingType(type);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingType) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/expense-types/${deletingType.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete expense type");
      }

      toast.success("Expense type deleted successfully");
      setDeleteOpen(false);
      fetchExpenseTypes();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAreaChange = (areaId: string, checked: boolean) => {
    if (checked) {
      setValue("applicable_for", [...selectedAreas, areaId]);
    } else {
      setValue(
        "applicable_for",
        selectedAreas.filter((a) => a !== areaId)
      );
    }
  };

  const renderAreaBadge = (area: string) => {
    switch (area) {
      case "Purchase":
        return (
          <span key={area} className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EDE9FE] text-[#7C3AED]">
            Purchase
          </span>
        );
      case "Sales":
        return (
          <span key={area} className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D]">
            Sales
          </span>
        );
      case "Production":
        return (
          <span key={area} className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FEF3C7] text-[#D97706]">
            Production
          </span>
        );
      default:
        return (
          <span key={area} className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">
            General
          </span>
        );
    }
  };

  const filteredTypes = expenseTypes.filter((type) =>
    type.name.toLowerCase().includes(search.toLowerCase()) ||
    (type.description && type.description.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: DataTableColumn<ExpenseType>[] = [
    {
      key: "name",
      header: "Expense Category",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
            style={{ backgroundColor: row.color || "#6366F1" }}
          />
          <span className="font-bold text-[#0F172A]">{row.name}</span>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-[#64748B] text-xs font-semibold max-w-xs block truncate">
          {row.description || "—"}
        </span>
      ),
    },
    {
      key: "applicable_for",
      header: "Layer Applicability",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.applicable_for && row.applicable_for.map((area) => renderAreaBadge(area))}
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
            title="Edit Expense Type"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete Expense Type"
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
        title="Expense Types"
        subtitle="Manage cash flow overhead tags and cost center categories"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Expense Types" },
        ]}
        searchPlaceholder="Search expense category..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Expense Type"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <DataTable
        columns={columns}
        data={filteredTypes}
        isLoading={loading}
        total={filteredTypes.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        emptyMessage="No expense types found. Click 'Add Expense Type' to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingType ? "Edit Expense Category" : "Add Expense Category"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Category Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Category Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Thread Consumables, Factory Rent, Freight"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
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
                placeholder="Describe expense details"
                rows={2}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                {...register("description")}
              />
            </div>

            {/* Theme color picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Cost Visual Color Tag
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="w-10 h-10 border border-[#D1D5DB] rounded-lg cursor-pointer p-0 bg-transparent"
                  {...register("color")}
                />
                <span className="text-xs font-mono font-medium text-[#475569]">{selectedColor}</span>
              </div>
            </div>

            {/* Multi-select check list for applicable areas */}
            <div className="space-y-2 border-t border-[#F3F4F6] pt-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Applicable Modules *
              </label>
              <p className="text-[10px] text-[#64748B] font-medium leading-none mb-2">
                Select areas where this expense type can be tagged.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {APPLICABLE_AREAS.map((area) => {
                  const isChecked = selectedAreas.includes(area.id);
                  return (
                    <label
                      key={area.id}
                      className={`flex items-center justify-between border rounded-lg p-2.5 cursor-pointer transition-all ${
                        isChecked
                          ? "bg-[#EEF2FF] border-[#6366F1] text-[#4F46E5] font-bold"
                          : "bg-white border-[#E2E8F0] text-[#334155] font-semibold"
                      }`}
                    >
                      <span className="text-xs">{area.label}</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleAreaChange(area.id, e.target.checked)}
                        className="h-4 w-4 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer ml-2"
                      />
                    </label>
                  );
                })}
              </div>

              {errors.applicable_for && (
                <p className="text-xs font-semibold text-[#DC2626] mt-1">
                  {errors.applicable_for.message}
                </p>
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6]">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Active Expense Category</h4>
                <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                  Allows tagging on active transactions.
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
                  "Save Category"
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
        title="Delete Expense Category?"
        description={`Are you sure you want to delete expense category "${deletingType?.name}"? Historical ledger records will preserve this tag but no new logs can select it.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
