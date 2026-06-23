"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/shared/Badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Info,
  X,
  PlusCircle,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

// drag and drop kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Form validation schema
const customFieldSchema = z.object({
  name: z.string().min(1, "Field Name is required"),
  type: z.enum(["text", "number", "boolean", "date"]),
  required: z.boolean(),
});

const stageSchema = z.object({
  name: z.string().min(2, "Stage Name must be at least 2 characters"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string(),
  custom_fields: z.array(customFieldSchema),
  is_active: z.boolean(),
});

type StageFormValues = z.infer<typeof stageSchema>;

interface ProductionStage {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  custom_fields: { name: string; type: "text" | "number" | "boolean" | "date"; required: boolean }[];
  is_active: boolean;
  updated_at: string;
}

export default function ProductionStagesPage() {
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProductionStage | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStage, setDeletingStage] = useState<ProductionStage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: "",
      description: "",
      icon: "",
      color: "#6366F1",
      custom_fields: [],
      is_active: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "custom_fields",
  });

  const selectedColor = watch("color");

  const fetchStages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master-data/production-stages");
      if (!res.ok) throw new Error("Failed to load stages");
      const result = await res.json();
      setStages(result.stages || []);
    } catch (err: any) {
      toast.error(err.message || "Error fetching stages list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const handleOpenAdd = () => {
    setEditingStage(null);
    reset({
      name: "",
      description: "",
      icon: "",
      color: "#6366F1",
      custom_fields: [],
      is_active: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (stage: ProductionStage) => {
    setEditingStage(stage);
    reset({
      name: stage.name,
      description: stage.description || "",
      icon: stage.icon || "",
      color: stage.color || "#6366F1",
      custom_fields: stage.custom_fields || [],
      is_active: stage.is_active,
    });
    setModalOpen(true);
  };

  const onSubmit = async (values: StageFormValues) => {
    try {
      const url = editingStage
        ? `/api/master-data/production-stages/${editingStage.id}`
        : "/api/master-data/production-stages";

      const method = editingStage ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          updated_at: editingStage?.updated_at,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save stage");
      }

      toast.success(
        editingStage ? "Stage updated successfully" : "Stage created successfully"
      );
      setModalOpen(false);
      fetchStages();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleOpenDelete = (stage: ProductionStage) => {
    setDeletingStage(stage);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStage) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/master-data/production-stages/${deletingStage.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete stage");
      }

      toast.success("Stage deleted successfully");
      setDeleteOpen(false);
      fetchStages();
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Drag and Drop implementation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const reorderedList = arrayMove(stages, oldIndex, newIndex);
    
    // Optimistically update front-end
    const listWithUpdatedOrders = reorderedList.map((stage, idx) => ({
      ...stage,
      sort_order: idx + 1,
    }));
    setStages(listWithUpdatedOrders);

    try {
      const res = await fetch("/api/master-data/production-stages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stages: listWithUpdatedOrders.map((s) => ({
            id: s.id,
            sort_order: s.sort_order,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to persist new sort order");
      }
      toast.success("Workflow order updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update order in database");
      fetchStages(); // revert
    }
  };

  const filteredStages = stages.filter((stage) =>
    stage.name.toLowerCase().includes(search.toLowerCase()) ||
    (stage.description && stage.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Stages"
        subtitle="Organize production sequences and configure operation checklists"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Master Data" },
          { label: "Production Stages" },
        ]}
        searchPlaceholder="Search stage..."
        searchValue={search}
        onSearch={setSearch}
        actionLabel="Add Stage"
        onAction={handleOpenAdd}
        actionIcon={<Plus size={16} className="text-white" />}
      />

      {/* Info Banner */}
      <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-4 flex gap-3 items-start shadow-sm text-sm text-[#1E40AF]">
        <Info className="text-[#3B82F6] shrink-0 mt-0.5" size={18} />
        <span className="font-semibold text-xs leading-normal">
          Adjust the sequence of stages by dragging them. Reordering updates the workflow path for new production lots.
        </span>
      </div>

      {/* Custom Draggable Stage Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-[#374151]">
            <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E5E7EB]">
              <tr className="h-11">
                <th className="w-12 px-4 text-center">Grip</th>
                <th className="w-16 px-4 text-center">Seq</th>
                <th className="px-6 font-semibold">Stage Name</th>
                <th className="px-6 font-semibold">Description</th>
                <th className="px-6 font-semibold">Color Tag</th>
                <th className="px-6 font-semibold">Custom Fields</th>
                <th className="px-6 font-semibold">Status</th>
                <th className="w-[120px] px-6 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#64748B]">
                    <div className="flex justify-center items-center gap-2 text-sm font-semibold">
                      <RefreshCw className="animate-spin" size={16} />
                      Loading production stages...
                    </div>
                  </td>
                </tr>
              ) : filteredStages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B]">
                    <div className="text-sm font-medium">
                      No stages found. Click &quot;Add Stage&quot; to begin.
                    </div>
                  </td>
                </tr>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={filteredStages.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredStages.map((stage) => (
                      <SortableRow
                        key={stage.id}
                        stage={stage}
                        onEdit={handleOpenEdit}
                        onDelete={handleOpenDelete}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingStage ? "Edit Production Stage" : "Add Production Stage"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Grid fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Stage Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Stage Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cutting, Stitching, Ironing"
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
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Description
                </label>
                <textarea
                  placeholder="Describe operations performed in this stage"
                  rows={2}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                  {...register("description")}
                />
              </div>

              {/* Color tag picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Theme Color (Badge Tag)
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

              {/* Icon selector placeholder */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Icon ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scissors, Pencil (optional)"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
                  {...register("icon")}
                />
              </div>
            </div>

            {/* Custom fields JSON manager section */}
            <div className="border-t border-[#F3F4F6] pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Custom Properties</h4>
                  <p className="text-[10px] text-[#64748B] font-medium">
                    Add parameters captured during this stage (e.g. Stitch Length, Shrinkage %).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ name: "", type: "text", required: false })}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#6366F1] hover:text-[#4F46E5] transition-all cursor-pointer"
                >
                  <PlusCircle size={14} /> Add Parameter
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="bg-[#F8FAFC] border border-dashed border-[#E2E8F0] rounded-xl p-6 text-center text-xs text-[#94A3B8] font-medium">
                  No custom parameters configured. Click &quot;Add Parameter&quot; to capture custom checklist data.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 relative">
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          placeholder="Property Name (e.g. Stitch Count)"
                          className="w-full h-8 px-2.5 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6366F1] transition-all font-medium text-[#334155]"
                          {...register(`custom_fields.${idx}.name` as const)}
                        />
                      </div>

                      <div className="w-full sm:w-[130px]">
                        <select
                          className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer font-medium text-[#334155]"
                          {...register(`custom_fields.${idx}.type` as const)}
                        >
                          <option value="text">Text Input</option>
                          <option value="number">Numeric</option>
                          <option value="boolean">Yes/No</option>
                          <option value="date">Date Picker</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between sm:justify-start gap-2 bg-white border border-[#E2E8F0] h-8 px-3 rounded-lg">
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Required</span>
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                          {...register(`custom_fields.${idx}.required` as const)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center cursor-pointer transition-all border border-red-100 self-end sm:self-center"
                        title="Remove Parameter"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Status Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6]">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Active Stage</h4>
                <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                  Controls visibility of this stage in production checklists.
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
                  "Save Stage"
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
        title="Delete Stage?"
        description={`Are you sure you want to delete stage "${deletingStage?.name}"? New workflow pathways will bypass this stage.`}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}

// Sortable Table Row Subcomponent
interface SortableRowProps {
  stage: ProductionStage;
  onEdit: (stage: ProductionStage) => void;
  onDelete: (stage: ProductionStage) => void;
}

function SortableRow({ stage, onEdit, onDelete }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`h-16 hover:bg-[#F8FAFC] transition-colors border-b border-[#E5E7EB] last:border-b-0 ${
        isDragging ? "bg-[#EEF2FF]" : ""
      }`}
    >
      {/* Grip Drag Handle column */}
      <td className="px-4 text-center align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1.5 rounded hover:bg-[#E2E8F0] cursor-grab text-[#94A3B8] hover:text-[#64748B] transition-all inline-flex items-center"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
      </td>

      {/* Seq Number */}
      <td className="px-4 text-center align-middle font-bold text-[#475569] text-xs">
        {stage.sort_order}
      </td>

      {/* Name */}
      <td className="px-6 align-middle font-bold text-[#0F172A]">
        {stage.name}
      </td>

      {/* Description */}
      <td className="px-6 align-middle text-xs font-semibold text-[#64748B] max-w-xs truncate">
        {stage.description || "—"}
      </td>

      {/* Color Tag */}
      <td className="px-6 align-middle">
        <div className="flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block"
            style={{ backgroundColor: stage.color || "#6366F1" }}
          />
          <span className="text-xs font-mono font-bold text-[#475569]">
            {stage.color || "#6366F1"}
          </span>
        </div>
      </td>

      {/* Custom Fields Count / Tags */}
      <td className="px-6 align-middle">
        {stage.custom_fields && stage.custom_fields.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {stage.custom_fields.map((f, i) => (
              <Badge key={i} variant="purple" className="text-[10px] font-bold">
                {f.name} ({f.type})
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[#94A3B8] font-bold">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-6 align-middle">
        <StatusBadge active={stage.is_active} />
      </td>

      {/* Actions */}
      <td className="px-6 align-middle">
        <div className="flex items-center justify-center gap-2 select-none">
          <button
            onClick={() => onEdit(stage)}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Stage"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(stage)}
            className="w-9 h-9 border border-[#FEE2E2] rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center cursor-pointer transition-all"
            title="Delete Stage"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}
