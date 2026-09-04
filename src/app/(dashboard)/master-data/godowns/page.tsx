"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGodownsList } from "@/hooks/queries/useMasterData";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { ModuleSubNav } from "@/components/shared/ModuleSubNav";
import { MASTER_DATA_NAV } from "@/lib/moduleNav";
import { Pencil, Trash2, Plus, Warehouse } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { DeleteGodownDialog } from "./_components/DeleteGodownDialog";

const godownSchema = z.object({
  name: z.string().min(2, "Godown Name must be at least 2 characters"),
  code: z.string().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  description: z.string().optional(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
});

type GodownFormValues = z.infer<typeof godownSchema>;

interface Godown {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  description: string | null;
  is_primary: boolean;
  is_active: boolean;
  updated_at: string;
}

export default function GodownsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGodown, setEditingGodown] = useState<Godown | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingGodown, setDeletingGodown] = useState<Godown | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GodownFormValues>({
    resolver: zodResolver(godownSchema),
  });

  const { data: godownsData, isLoading: loading, error, refetch } = useGodownsList();

  const godowns: Godown[] = godownsData?.godowns || [];

  const handleOpenAdd = () => {
    setEditingGodown(null);
    reset({
      name: "",
      code: "",
      address: "",
      contact_person: "",
      phone: "",
      description: "",
      is_primary: false,
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (godown: Godown) => {
    setEditingGodown(godown);
    reset({
      name: godown.name,
      code: godown.code || "",
      address: godown.address || "",
      contact_person: godown.contact_person || "",
      phone: godown.phone || "",
      description: godown.description || "",
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
          updated_at: editingGodown?.updated_at,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        // Fallback if response is empty or HTML (e.g. 405 Method Not Allowed)
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to save godown (Status: ${res.status})`);
      }

      toast.success(
        editingGodown
          ? "Godown updated successfully"
          : "Godown created successfully"
      );
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["master-data", "godowns"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast.error(message);
    }
  };

  const handleOpenDelete = (godown: Godown) => {
    setDeletingGodown(godown);
    setDeleteOpen(true);
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
        <div className="w-9 h-9 rounded-lg bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
          <Warehouse size={18} />
        </div>
      ),
    },
    {
      key: "name",
      header: "Godown Name",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--primary)] cursor-pointer">
            {row.name}
          </span>
          {row.code && (
            <span className="bg-[var(--primary-light)] text-[var(--primary)] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[var(--border)] uppercase font-mono">
              {row.code}
            </span>
          )}
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
        <span className="text-[var(--text-muted)] truncate max-w-xs block">
          {row.address || "—"}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact Person",
      render: (row) => <span className="text-[var(--text-primary)]">{row.contact_person || "—"}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="font-mono text-xs text-[var(--text-primary)]">{row.phone || "—"}</span>,
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
            className="w-9 h-9 border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Godown"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
            title="Delete Godown"
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

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error ? (error instanceof Error ? error.message : "Failed to load godowns") : undefined}
        onRetry={refetch}
        isEmpty={filteredGodowns.length === 0}
        emptyTitle="No Godowns Found"
        emptyMessage="No godowns configured yet. Click Add Godown to create your primary warehouse location."
        emptyAction={
          <AsyncButton onClick={handleOpenAdd} variant="primary">
            + Add First Godown
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={6}
      >
        {/* ── MOBILE: Godown Card List ── */}
        <div className="md:hidden space-y-3">
          {filteredGodowns.map((g) => (
            <div key={g.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3 cursor-pointer"
              onClick={() => router.push(`/master-data/godowns/${g.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] shrink-0">
                    <Warehouse size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-[var(--primary)] text-sm">{g.name}</p>
                      {g.is_primary && (
                        <Badge variant="primary" className="text-[9px] px-1.5 py-0">Primary</Badge>
                      )}
                    </div>
                    {g.contact_person && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Contact: {g.contact_person}</p>}
                  </div>
                </div>
                <StatusBadge active={g.is_active} />
              </div>

              {g.address && <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-light)] pt-2 truncate">{g.address}</p>}

              <div className="flex items-center justify-end gap-2 border-t border-[var(--border-light)] pt-2" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => handleOpenEdit(g)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                ><Pencil size={12} /> Edit</button>
                <button type="button" onClick={() => handleOpenDelete(g)}
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
            data={filteredGodowns}
            isLoading={false}
            total={filteredGodowns.length}
            page={1}
            perPage={10}
            onPageChange={() => {}}
            onRowClick={(row) => router.push(`/master-data/godowns/${row.id}`)}
            emptyMessage="No matching godowns found."
          />
        </div>
      </PageState>


      {/* Add/Edit Shared Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingGodown ? "Edit Godown Location" : "Add New Godown"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Godown Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Godown Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Main Warehouse"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs font-semibold text-red-500">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Godown Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Unique Code (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. GDN-001 (auto-generated if empty)"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all font-mono uppercase"
              {...register("code")}
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Address
            </label>
            <textarea
              placeholder="Physical location address"
              rows={2}
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all resize-none"
              {...register("address")}
            />
          </div>

          {/* Contact Person */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Contact Person
            </label>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
              {...register("contact_person")}
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Contact Phone
            </label>
            <input
              type="text"
              placeholder="Contact number"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all font-mono"
              {...register("phone")}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Description / Internal Notes
            </label>
            <textarea
              placeholder="Optional notes or details about this godown"
              rows={2}
              className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all resize-none"
              {...register("description")}
            />
          </div>

          {/* Toggle options */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Primary Godown</h4>
                <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                  Sets as default destination for lot completion stock.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
                {...register("is_primary")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Status</h4>
                <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none mt-0.5">
                  Controls visibility in stock transfers and challans list.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--input-border)] rounded cursor-pointer"
                {...register("is_active")}
              />
            </div>
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
              Save Godown
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* Delete Godown Dialog */}
      <DeleteGodownDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        godown={deletingGodown}
        allGodowns={godowns}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["master-data", "godowns"] })}
      />
    </div>
  );
}
