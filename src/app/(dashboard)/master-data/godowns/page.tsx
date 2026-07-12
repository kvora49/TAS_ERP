"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Pencil, Trash2, Plus, RefreshCw, Warehouse } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

const godownSchema = z.object({
  name: z.string().min(2, "Godown Name must be at least 2 characters"),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
});

type GodownFormValues = z.infer<typeof godownSchema>;

interface Godown {
  id: string;
  name: string;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
  updated_at: string;
}

export default function GodownsPage() {
  const router = useRouter();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingGodown, setDeletingGodown] = useState<Godown | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GodownFormValues>({
    resolver: zodResolver(godownSchema),
  });

  const fetchGodowns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/godowns");
      if (!res.ok) throw new Error("Failed to load godowns");
      const result = await res.json();
      setGodowns(result.godowns || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching godowns list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGodowns();
  }, []);

  const handleOpenAdd = () => {
    setEditingGodown(null);
    reset({
      name: "",
      address: "",
      contact_person: "",
      phone: "",
      is_primary: false,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (godown: Godown) => {
    setEditingGodown(godown);
    reset({
      name: godown.name,
      address: godown.address || "",
      contact_person: godown.contact_person || "",
      phone: godown.phone || "",
      is_primary: godown.is_primary,
      is_active: godown.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: GodownFormValues) => {
    try {
      const url = editingGodown
        ? `/api/master-data/godowns/${editingGodown.id}`
        : "/api/master-data/godowns";

      const method = editingGodown ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingGodown?.updated_at, // Optimistic Lock Check
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save godown");
      }

      toast.success(
        editingGodown
          ? "Godown updated successfully"
          : "Godown created successfully"
      );
      setModalOpen(false);
      fetchGodowns();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (godown: Godown) => {
    setDeletingGodown(godown);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingGodown) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/godowns/${deletingGodown.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete godown");
      }

      toast.success("Godown deleted successfully");
      setDeleteOpen(false);
      fetchGodowns();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredGodowns = godowns.filter((godown) =>
    godown.name.toLowerCase().includes(search.toLowerCase()) ||
    (godown.contact_person &&
      godown.contact_person.toLowerCase().includes(search.toLowerCase()))
  );

  const columns: DataTableColumn<Godown>[] = [
    {
      key: "icon",
      header: "",
      width: "50px",
      render: () => (
        <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] flex items-center justify-center text-[#6366F1]">
          <Warehouse size={18} />
        </div>
      ),
    },
    {
      key: "name",
      header: "Godown Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#6366F1] hover:underline cursor-pointer">
            {row.name}
          </span>
          {row.is_primary && (
            <Badge variant="primary">
              Primary
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (row) => (
        <span className="text-[#64748B] truncate max-w-xs block">
          {row.address || "—"}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact Person",
      render: (row) => <span>{row.contact_person || "—"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="font-mono text-xs">{row.phone || "—"}</span>,
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
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEdit(row);
            }}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Godown"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete Godown"
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
        title="Godowns"
        subtitle="Manage your warehouse locations, stock storage godowns, and defaults"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Godowns" },
        ]}
        searchPlaceholder="Search godown name or contact..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Godown"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <DataTable
        columns={columns}
        data={filteredGodowns}
        isLoading={loading}
        total={filteredGodowns.length}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        onRowClick={(row) => router.push(`/master-data/godowns/${row.id}`)}
        emptyMessage="No godowns configured yet. Click Add Godown to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingGodown ? "Edit Godown Location" : "Add New Godown"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Godown Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Godown Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Main Warehouse"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs font-semibold text-[#DC2626]">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Address
              </label>
              <textarea
                placeholder="Physical location address"
                rows={2}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                {...register("address")}
              />
            </div>

            {/* Contact Person */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Contact Person
              </label>
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                {...register("contact_person")}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="Contact number"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                {...register("phone")}
              />
            </div>

            {/* Toggle options */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-[#F3F4F6]">
              {/* Primary Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Primary Godown</h4>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Sets as default destination for lot completion stock.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                  {...register("is_primary")}
                />
              </div>

              {/* Active Status Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Active Status</h4>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Controls visibility in stock transfers and challans list.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                  {...register("is_active")}
                />
              </div>
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
                  "Save Godown"
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
        title="Delete Godown Location?"
        description={`Are you sure you want to delete godown "${deletingGodown?.name}"? Wiping locations could make stock tracking invalid.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
