"use client";

import { useEffect, useState } from "react";
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
import { Pencil, Trash2, Plus, Ruler, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// Form validation schema
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
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [selectedUnitDetails, setSelectedUnitDetails] = useState<Unit | null>(null);

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

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/units");
      if (!res.ok) throw new Error("Failed to load Units");
      const result = await res.json();
      setUnits(result.units || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching units list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

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
      fetchUnits();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (unit: Unit) => {
    setDeletingUnit(unit);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUnit) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/units/${deletingUnit.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete unit");
      }

      toast.success("Unit deleted successfully");
      setDeleteOpen(false);
      fetchUnits();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter out the editing unit from list of potential base units to prevent self-reference loops
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
          className="font-bold text-sm text-[#6366F1] cursor-pointer text-left bg-transparent border-0 p-0"
        >
          {row.name}
        </button>
      ),
    },
    {
      key: "abbreviation",
      header: "Abbreviation",
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
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
            <span className="text-xs font-semibold text-slate-600">
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
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Unit"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDelete(row);
            }}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
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

      <DataTable
        columns={columns}
        data={filteredUnits}
        isLoading={loading}
        total={filteredUnits.length}
        page={1}
        perPage={100}
        onPageChange={() => {}}
        onRowClick={setSelectedUnitDetails}
        emptyMessage="No units of measurement found. Click 'Add Unit' to create one."
      />

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? "Edit Unit of Measurement" : "Add Unit of Measurement"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Unit Name *</label>
              <input
                type="text"
                placeholder="e.g. Metre"
                {...register("name")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
              />
              {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Abbreviation *</label>
              <input
                type="text"
                placeholder="e.g. m"
                {...register("abbreviation")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm"
              />
              {errors.abbreviation && <p className="text-[10px] text-red-500 mt-1">{errors.abbreviation.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Sub-unit of / Base Unit (Optional)</label>
              <select
                {...register("base_unit_id")}
                className="w-full px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm bg-white"
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
                <label className="block text-xs font-semibold text-[#64748B] mb-1.5">Conversion Factor *</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-500">1 unit =</span>
                  <input
                    type="text"
                    placeholder="e.g. 100"
                    {...register("conversion_factor")}
                    className="w-24 px-3 py-2 border border-[#CBD5E1] rounded-lg text-sm text-right"
                  />
                  <span className="text-sm font-semibold text-slate-500">
                    {getBaseUnitName(baseUnitId).split(" ")[0]}
                  </span>
                </div>
                {errors.conversion_factor && (
                  <p className="text-[10px] text-red-500 mt-1">{errors.conversion_factor.message}</p>
                )}
                <p className="text-[10px] text-slate-500 mt-1 italic">
                  Example: If 1 Roll = 100 Metres, Unit is Roll, Base Unit is Metre, Conversion Factor is 100.
                </p>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg flex items-center gap-2"
              >
                {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                {editingUnit ? "Save Changes" : "Create Unit"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Unit of Measurement"
        description={`Are you sure you want to delete unit "${deletingUnit?.name}"? This action cannot be undone.`}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
      />

      {/* View Details Modal */}
      <Dialog open={!!selectedUnitDetails} onOpenChange={(open) => !open && setSelectedUnitDetails(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Unit Details</DialogTitle>
          </DialogHeader>
          {selectedUnitDetails && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-[#6366F1] rounded-lg flex items-center justify-center">
                  <Ruler size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{selectedUnitDetails.name}</h3>
                  <p className="text-xs text-slate-500">Symbol: <span className="font-mono font-bold">{selectedUnitDetails.abbreviation}</span></p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2.5 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Base Unit Type:</span>
                  <span>{selectedUnitDetails.base_unit_id ? "Derived Unit" : "Primary Base Unit"}</span>
                </div>
                {selectedUnitDetails.base_unit_id && (
                  <>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Parent Base Unit:</span>
                      <span>{getBaseUnitName(selectedUnitDetails.base_unit_id)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-500">Conversion Multiplier:</span>
                      <span className="font-mono">{selectedUnitDetails.conversion_factor}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Created At:</span>
                  <span>{new Date(selectedUnitDetails.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUnitDetails(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Close
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
