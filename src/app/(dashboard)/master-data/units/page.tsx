"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, DataTableColumn } from "@/components/tables/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/shared/Badge";
import { Modal } from "@/components/shared/Modal";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Pencil, Trash2, Plus, Ruler } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { DeleteMasterItemDialog } from "@/components/shared/DeleteMasterItemDialog";
import { useUnitsList } from "@/hooks/queries/useMasterData";
import { useQueryClient } from "@tanstack/react-query";

const unitSchema = z.object({
  name: z.string().min(1, "Unit Name is required"),
  abbreviation: z.string().min(1, "Abbreviation is required"),
  base_unit_id: z.string().or(z.literal("")).nullable(),
  conversion_factor: z.string().optional().refine(val => !val || !isNaN(Number(val)), {
    message: "Conversion factor must be a valid number",
  }),
});

type UnitFormValues = z.infer<typeof unitSchema>;

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  base_unit_id: string | null;
  conversion_factor: number;
  created_at: string;
}

export default function UnitsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);

  const [selectedUnitDetails, setSelectedUnitDetails] = useState<Unit | null>(null);

  const { data: unitsData, isLoading: loading, error, refetch } = useUnitsList();
  const units: Unit[] = unitsData?.units || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      name: "",
      abbreviation: "",
      base_unit_id: "",
      conversion_factor: "1.0",
    },
  });

  const baseUnitId = watch("base_unit_id");

  const handleOpenAdd = () => {
    setEditingUnit(null);
    reset({
      name: "",
      abbreviation: "",
      base_unit_id: "",
      conversion_factor: "1.0",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    reset({
      name: unit.name,
      abbreviation: unit.abbreviation,
      base_unit_id: unit.base_unit_id || "",
      conversion_factor: String(unit.conversion_factor),
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: UnitFormValues) => {
    try {
      const url = editingUnit
        ? `/api/master-data/units/${editingUnit.id}`
        : "/api/master-data/units";

      const method = editingUnit ? "PUT" : "POST";

      const payload = {
        ...values,
        base_unit_id: values.base_unit_id || null,
        conversion_factor: values.base_unit_id ? Number(values.conversion_factor || 1.0) : 1.0,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save unit");
      }

      toast.success(
        editingUnit ? "Unit updated successfully" : "Unit created successfully"
      );
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["master-data", "units"] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (unit: Unit) => {
    setDeletingUnit(unit);
    setDeleteOpen(true);
  };

  const potentialBaseUnits = units.filter(
    (u) => !editingUnit || u.id !== editingUnit.id
  );

  const getBaseUnitName = (id: string | null) => {
    if (!id) return "—";
    const found = units.find((u) => u.id === id);
    return found ? `${found.name} (${found.abbreviation})` : "—";
  };

  const filteredUnits = units.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.abbreviation.toLowerCase().includes(search.toLowerCase())
  );

  const columns: DataTableColumn<Unit>[] = [
    {
      key: "name",
      header: "Unit Name",
      render: (row) => (
        <button
          onClick={() => setSelectedUnitDetails(row)}
          className="font-bold text-sm text-[var(--primary)] cursor-pointer text-left bg-transparent border-0 p-0 hover:underline"
        >
          {row.name}
        </button>
      ),
    },
    {
      key: "abbreviation",
      header: "Abbreviation",
      render: (row) => (
        <span className="font-mono text-xs font-bold text-[var(--text-primary)] bg-[var(--page-bg)] px-2 py-0.5 rounded border border-[var(--border)]">
          {row.abbreviation}
        </span>
      ),
    },
    {
      key: "base_unit",
      header: "Base Unit Reference",
      render: (row) => getBaseUnitName(row.base_unit_id),
    },
    {
      key: "conversion_factor",
      header: "Conversion Factor",
      render: (row) => {
        if (row.base_unit_id) {
          const baseUnit = units.find((u) => u.id === row.base_unit_id);
          return (
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              1 {row.abbreviation} = {row.conversion_factor} {baseUnit?.abbreviation || ""}
            </span>
          );
        }
        return <Badge variant="gray">Base Unit</Badge>;
      },
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
            title="Edit Unit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-red-500/20 rounded-lg hover:bg-red-500/10 text-red-500 flex items-center justify-center cursor-pointer transition-all"
            title="Delete Unit"
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
        title="Units of Measurement"
        subtitle="Manage inventory UoMs and unit conversion matrices"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Units" },
        ]}
        searchPlaceholder="Search unit name or symbol..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Unit"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      <PageState
        isLoading={loading}
        isError={!!error}
        error={error ? (error instanceof Error ? error.message : "Failed to load units") : undefined}
        onRetry={refetch}
        isEmpty={filteredUnits.length === 0}
        emptyTitle="No Units of Measurement Found"
        emptyMessage="No inventory units created yet. Click Add Unit to create primary and derived measurement units."
        emptyAction={
          <AsyncButton onClick={handleOpenAdd} variant="primary">
            + Add First Unit
          </AsyncButton>
        }
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={5}
      >
        {/* ── MOBILE: Units Card List ── */}
        <div className="md:hidden space-y-3">
          {filteredUnits.map((u) => {
            const baseUnit = units.find((bu) => bu.id === u.base_unit_id);
            return (
              <div key={u.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3 cursor-pointer"
                onClick={() => setSelectedUnitDetails(u)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] shrink-0">
                      <Ruler size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-[var(--primary)] text-sm">{u.name}</p>
                      <span className="text-[10px] font-mono font-bold bg-[var(--page-bg)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)] mt-0.5 inline-block">
                        {u.abbreviation}
                      </span>
                    </div>
                  </div>
                </div>

                {baseUnit ? (
                  <p className="text-xs text-[var(--text-muted)] border-t border-[var(--border-light)] pt-2 font-mono">
                    1 {u.abbreviation} = {u.conversion_factor} {baseUnit.abbreviation}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-emerald-600 border-t border-[var(--border-light)] pt-2">
                    Primary / Base Unit
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 border-t border-[var(--border-light)] pt-2" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => handleOpenEdit(u)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                  ><Pencil size={12} /> Edit</button>
                  <button type="button" onClick={() => handleOpenDelete(u)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-600 flex items-center gap-1 cursor-pointer"
                  ><Trash2 size={12} /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── DESKTOP: DataTable ── */}
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={filteredUnits}
            isLoading={false}
            total={filteredUnits.length}
            page={1}
            perPage={100}
            onPageChange={() => {}}
            onRowClick={setSelectedUnitDetails}
            emptyMessage="No matching units of measurement found."
          />
        </div>
      </PageState>


      {/* Add/Edit Shared Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingUnit ? "Edit Unit of Measurement" : "Add Unit of Measurement"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
              Unit Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Metre"
              {...register("name")}
              className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            />
            {errors.name && (
              <p className="text-[10px] text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
              Abbreviation *
            </label>
            <input
              type="text"
              placeholder="e.g. m"
              {...register("abbreviation")}
              className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] font-mono"
            />
            {errors.abbreviation && (
              <p className="text-[10px] text-red-500 mt-1">{errors.abbreviation.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
              Sub-unit of / Base Unit (Optional)
            </label>
            <select
              {...register("base_unit_id")}
              className="w-full px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="">No Base Unit (This is a primary unit)</option>
              {potentialBaseUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.abbreviation})
                </option>
              ))}
            </select>
          </div>

          {baseUnitId && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                Conversion Factor *
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-muted)]">1 unit =</span>
                <input
                  type="text"
                  placeholder="e.g. 100"
                  {...register("conversion_factor")}
                  className="w-24 px-3 py-2 border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg text-sm text-right font-mono"
                />
                <span className="text-sm font-semibold text-[var(--text-muted)]">
                  {getBaseUnitName(baseUnitId).split(" ")[0]}
                </span>
              </div>
              {errors.conversion_factor && (
                <p className="text-[10px] text-red-500 mt-1">{errors.conversion_factor.message}</p>
              )}
              <p className="text-[10px] text-[var(--text-faint)] mt-1 italic">
                Example: If 1 Roll = 100 Metres, Unit is Roll, Base Unit is Metre, Conversion Factor is 100.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] bg-[var(--card-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              type="submit"
              isLoading={isSubmitting}
              variant="primary"
              className="px-4 py-2 text-sm font-semibold"
            >
              {editingUnit ? "Save Changes" : "Create Unit"}
            </AsyncButton>
          </div>
        </form>
      </Modal>

      {/* View Details Shared Modal */}
      <Modal
        open={!!selectedUnitDetails}
        onOpenChange={(open) => !open && setSelectedUnitDetails(null)}
        title="Unit Details"
        maxWidth="max-w-md"
      >
        {selectedUnitDetails && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--primary-light)] text-[var(--primary)] rounded-lg flex items-center justify-center">
                <Ruler size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[var(--text-primary)]">{selectedUnitDetails.name}</h3>
                <p className="text-xs text-[var(--text-muted)]">Symbol: <span className="font-mono font-bold text-[var(--text-primary)]">{selectedUnitDetails.abbreviation}</span></p>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-3 space-y-2.5 text-sm text-[var(--text-body)]">
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text-muted)]">Base Unit Type:</span>
                <span>{selectedUnitDetails.base_unit_id ? "Derived Unit" : "Primary Base Unit"}</span>
              </div>
              {selectedUnitDetails.base_unit_id && (
                <>
                  <div className="flex justify-between">
                    <span className="font-semibold text-[var(--text-muted)]">Parent Base Unit:</span>
                    <span>{getBaseUnitName(selectedUnitDetails.base_unit_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-[var(--text-muted)]">Conversion Multiplier:</span>
                    <span className="font-mono font-bold">{selectedUnitDetails.conversion_factor}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="font-semibold text-[var(--text-muted)]">Created At:</span>
                <span>{new Date(selectedUnitDetails.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUnitDetails(null)}
                className="px-4 py-2 text-sm font-semibold text-[var(--text-muted)] bg-[var(--page-bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Unit Dialog */}
      <DeleteMasterItemDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Unit of Measure"
        item={deletingUnit}
        allItems={units}
        apiEndpoint="/api/master-data/units"
        targetQueryParam="target_unit_id"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["master-data", "units"] })}
      />
    </div>
  );
}
