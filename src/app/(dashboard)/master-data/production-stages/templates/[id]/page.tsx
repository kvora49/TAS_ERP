"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Star,
  GripVertical,
  Pencil,
  Trash2,
  AlertCircle,
  HelpCircle,
  Layers,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
  order_index: number;
  custom_fields: { name: string; type: "text" | "number" | "boolean" | "date"; required: boolean }[];
  is_active: boolean;
  updated_at: string;
}

interface ProductionTemplate {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

interface TemplateDetailResponse {
  template: ProductionTemplate;
  stages: ProductionStage[];
}

export default function TemplateDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProductionStage | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStage, setDeletingStage] = useState<ProductionStage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch Template and stages
  const { data: detailData, isLoading, error } = useQuery<TemplateDetailResponse>({
    queryKey: ["production-template-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/production-templates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch template details");
      return res.json();
    },
  });

  useEffect(() => {
    if (detailData?.stages) {
      setStages(detailData.stages);
    }
  }, [detailData]);

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

  const handleOpenDelete = (stage: ProductionStage) => {
    setDeletingStage(stage);
    setDeleteOpen(true);
  };

  const onSubmit = async (data: StageFormValues) => {
    try {
      const url = editingStage
        ? `/api/master-data/production-stages/${editingStage.id}`
        : "/api/master-data/production-stages";
      const method = editingStage ? "PUT" : "POST";

      const payload = editingStage
        ? { ...data, updated_at: editingStage.updated_at }
        : { ...data, template_id: id };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorResult = await res.json();
        throw new Error(errorResult.error || "Failed to save stage");
      }

      toast.success(
        editingStage
          ? "Stage updated successfully"
          : "Stage added to template successfully"
      );
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production-template-detail", id] });
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    }
  };

  const handleDeleteConfirm = async () => {
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
      queryClient.invalidateQueries({ queryKey: ["production-template-detail", id] });
    } catch (err: any) {
      toast.error(err.message || "An error occurred during deletion");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Drag and Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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

    // Optimistically update frontend state
    const listWithUpdatedOrders = reorderedList.map((stage, idx) => ({
      ...stage,
      order_index: idx + 1,
    }));
    setStages(listWithUpdatedOrders);

    try {
      const res = await fetch(`/api/master-data/production-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: detailData?.template.name,
          description: detailData?.template.description,
          is_default: detailData?.template.is_default,
          stages: listWithUpdatedOrders.map((s) => ({
            id: s.id,
            order_index: s.order_index,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to persist template stage order");
      }
      toast.success("Stage workflow order updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update order");
      queryClient.invalidateQueries({ queryKey: ["production-template-detail", id] });
    }
  };

  const isDataStale = detailData && detailData.template.id !== id;

  if (isLoading || isDataStale) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#64748B]">Loading template...</p>
        </div>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-[#0F172A]">Error Loading Template</h3>
        <p className="text-sm text-[#64748B]">{error?.toString() || "Template not found"}</p>
        <button
          onClick={() => router.push("/master-data/production-stages/templates")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
        >
          Back to Templates
        </button>
      </div>
    );
  }

  const { template } = detailData;

  return (
    <div className="p-6 space-y-6">
      {/* Navigation breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-bold text-[#64748B] select-none">
        <Link href="/" className="hover:text-[#0F172A] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} />
        <span>Master Data</span>
        <ChevronRight size={12} />
        <Link href="/master-data/production-stages/templates" className="hover:text-[#0F172A] transition-colors">
          Templates
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#0F172A]">{template.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10" />

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-xl shadow-sm">
            <Layers size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">{template.name}</h1>
              {template.is_default && (
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase flex items-center gap-1 select-none">
                  <Star size={10} className="fill-current" /> Default Template
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] font-semibold">
              {template.description && (
                <span className="text-sm font-medium text-[#475569]">{template.description}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="h-10 px-4 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#6366F1]/10"
          >
            <Plus size={14} /> Add Stage
          </button>
          <button
            onClick={() => router.push(`/master-data/production-stages/templates`)}
            className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} /> Back to List
          </button>
        </div>
      </div>

      {/* Reorder instructions */}
      <div className="text-xs font-semibold text-[#64748B] bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2 select-none">
        <GripVertical size={14} className="text-[#94A3B8]" />
        <span>Grip and drag the handle icon to reorder the stages. The layout sequence updates dynamically.</span>
      </div>

      {/* Stages Reorderable Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider h-12">
                <th className="w-12 text-center">Drag</th>
                <th className="w-16 text-center">Seq No</th>
                <th className="px-6">Stage Name</th>
                <th className="px-6">Description</th>
                <th className="px-6 w-36">Color Tag</th>
                <th className="px-6">Custom Fields</th>
                <th className="px-6 w-32">Status</th>
                <th className="px-6 w-36 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
              {stages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#64748B]">
                    <div className="text-sm font-semibold">
                      No stages added to this template. Click &quot;Add Stage&quot; to begin.
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
                    items={stages.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {stages.map((stage) => (
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

      {/* Add/Edit Stage Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingStage ? "Edit Stage details" : "Add New Stage to Template"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Stage Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Stage Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cutting, Stitching, Quality Check"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold"
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
                  placeholder="Define work instructions or stage scope..."
                  rows={2}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                  {...register("description")}
                />
              </div>

              {/* Color Tag Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Visual Theme Color *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg cursor-pointer border border-[#D1D5DB]"
                    {...register("color")}
                  />
                  <input
                    type="text"
                    className="flex-1 h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-mono font-bold"
                    {...register("color")}
                  />
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between sm:col-span-1 pt-3">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Stage Status</h4>
                  <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-none">
                    Allows staging assignments.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                  {...register("is_active")}
                />
              </div>
            </div>

            {/* Custom Field Config Block */}
            <div className="border border-[#E5E7EB] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
                    Job Work Stage Fields
                  </h3>
                  <p className="text-[10px] text-[#64748B] font-medium leading-none mt-0.5">
                    Define custom properties to capture during worker stock entry.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ name: "", type: "text", required: false })}
                  className="h-8 px-2.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 text-[#6366F1] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Add Parameter
                </button>
              </div>

              {fields.length === 0 ? (
                <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-xs font-semibold text-[#64748B]">
                  No custom parameters specified. (Defaults: Worker Name, Quantity Out, Pieces Rate)
                </div>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {/* Name */}
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold text-[#475569] uppercase">
                          Label Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Waist Size, Shade Code"
                          className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                          {...register(`custom_fields.${index}.name` as const)}
                        />
                      </div>

                      {/* Type */}
                      <div className="w-28 space-y-1">
                        <label className="text-[10px] font-bold text-[#475569] uppercase">
                          Type
                        </label>
                        <select
                          className="w-full h-8 px-2 bg-white border border-[#D1D5DB] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                          {...register(`custom_fields.${index}.type` as const)}
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="boolean">Yes/No</option>
                          <option value="date">Date</option>
                        </select>
                      </div>

                      {/* Required */}
                      <div className="flex items-center gap-1.5 pb-2">
                        <input
                          type="checkbox"
                          id={`req-${field.id}`}
                          className="h-4 w-4 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                          {...register(`custom_fields.${index}.required` as const)}
                        />
                        <label htmlFor={`req-${field.id}`} className="text-[10px] font-bold text-[#475569] uppercase cursor-pointer select-none">
                          Required
                        </label>
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-md flex items-center justify-center cursor-pointer transition-all border border-transparent hover:border-rose-100 shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Delete Stage Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Production Stage"
        description={`Are you sure you want to delete the stage "${deletingStage?.name}"? Any active lots referencing this stage will continue to show it, but new lots won't copy it.`}
        confirmText="Delete Stage"
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </div>
  );
}

// Sortable table row subcomponent
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
      {/* Drag handle */}
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
      <td className="px-4 text-center align-middle font-bold text-[#475569] text-xs font-mono">
        {stage.order_index}
      </td>

      {/* Name */}
      <td className="px-6 align-middle font-bold text-[#0F172A]">
        {stage.name}
      </td>

      {/* Description */}
      <td className="px-6 align-middle text-xs font-semibold text-[#64748B] max-w-xs truncate">
        {stage.description || "—"}
      </td>

      {/* Color Picker */}
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

      {/* Custom Fields */}
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
        <div className="flex items-center justify-center gap-2 select-none" onClick={(e) => e.stopPropagation()}>
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
