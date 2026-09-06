"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Star,
  GripVertical,
  Pencil,
  Trash2,
  Layers,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/shared/Badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import PageState from "@/components/shared/PageState";
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

const PRESET_COLORS = [
  "#6366F1", // Indigo
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#F43F5E", // Rose
  "#8B5CF6", // Purple
  "#64748B", // Slate
];

// Mobile Sortable Card Component
function SortableStageCard({
  stage,
  index,
  total,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  stage: ProductionStage;
  index: number;
  total: number;
  onEdit: (stage: ProductionStage) => void;
  onDelete: (stage: ProductionStage) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  const accentColor = stage.color || "#6366F1";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] relative overflow-hidden transition-all space-y-3",
        isDragging && "ring-2 ring-[var(--primary)] shadow-lg"
      )}
    >
      {/* Left color stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: accentColor }}
      />

      {/* Card Header: Drag grip, Step number, Reorder buttons & Status */}
      <div className="flex items-center justify-between gap-2 pl-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="w-8 h-8 rounded-lg hover:bg-[var(--table-row-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to reorder"
            aria-label="Drag to reorder stage"
          >
            <GripVertical size={18} />
          </button>

          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--table-header-bg)] text-[var(--text-secondary)] border border-[var(--border)]">
            Step {stage.order_index}
          </span>

          <div className="flex items-center gap-0.5 border border-[var(--border)] rounded-lg p-0.5 bg-[var(--table-header-bg)]">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMoveUp(index)}
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Move Up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={() => onMoveDown(index)}
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Move Down"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        <StatusBadge active={stage.is_active} />
      </div>

      {/* Stage Details */}
      <div className="pl-1.5 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-black/10"
            style={{ backgroundColor: accentColor }}
          />
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight">
            {stage.name}
          </h3>
        </div>
        {stage.description ? (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
            {stage.description}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-faint)] italic">No scope description</p>
        )}
      </div>

      {/* Custom Fields Preview */}
      <div className="pl-1.5 pt-1 border-t border-[var(--border-light)]">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">
          <span>Job Work Parameters</span>
          <span className="font-mono">{stage.custom_fields?.length || 0} fields</span>
        </div>

        {stage.custom_fields && stage.custom_fields.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {stage.custom_fields.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[var(--table-header-bg)] border border-[var(--border)] text-[var(--text-secondary)]"
              >
                <span>{f.name}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">({f.type})</span>
                {f.required && (
                  <span className="text-[9px] text-red-500 font-bold uppercase">*</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-[var(--text-faint)]">
            Standard tracking only (worker, quantity out, piece rate)
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="pl-1.5 pt-2 border-t border-[var(--border-light)] flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit(stage)}
          className="flex-1 h-9 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-[var(--text-secondary)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Pencil size={14} /> Edit Stage
        </button>
        <button
          type="button"
          onClick={() => onDelete(stage)}
          className="h-9 px-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// Desktop Sortable Row Component
function SortableDesktopRow({
  stage,
  onEdit,
  onDelete,
}: {
  stage: ProductionStage;
  onEdit: (stage: ProductionStage) => void;
  onDelete: (stage: ProductionStage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const accentColor = stage.color || "#6366F1";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "group hover:bg-[var(--table-row-hover)] transition-colors border-b border-[var(--border)] last:border-b-0",
        isDragging && "bg-[var(--table-header-bg)]"
      )}
    >
      {/* Handle */}
      <td className="w-12 text-center align-middle py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="w-8 h-8 rounded-lg hover:bg-[var(--table-row-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mx-auto cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
          aria-label="Drag to reorder stage"
        >
          <GripVertical size={16} />
        </button>
      </td>

      {/* Seq Number */}
      <td className="w-16 text-center align-middle font-mono font-bold text-xs text-[var(--text-secondary)] py-3">
        {stage.order_index}
      </td>

      {/* Name */}
      <td className="px-4 align-middle font-bold text-[var(--text-primary)] text-sm py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-black/10"
            style={{ backgroundColor: accentColor }}
          />
          <span>{stage.name}</span>
        </div>
      </td>

      {/* Description */}
      <td className="px-4 align-middle text-xs text-[var(--text-muted)] max-w-xs truncate py-3">
        {stage.description || "—"}
      </td>

      {/* Color Picker / Tag */}
      <td className="px-4 align-middle py-3">
        <div className="flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <span className="text-xs font-mono font-semibold text-[var(--text-secondary)]">
            {accentColor}
          </span>
        </div>
      </td>

      {/* Custom Fields */}
      <td className="px-4 align-middle py-3">
        {stage.custom_fields && stage.custom_fields.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {stage.custom_fields.map((f, i) => (
              <Badge key={i} variant="purple" className="text-[10px] font-semibold">
                {f.name} ({f.type})
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[var(--text-faint)]">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 align-middle py-3">
        <StatusBadge active={stage.is_active} />
      </td>

      {/* Actions */}
      <td className="px-4 align-middle text-center py-3">
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onEdit(stage)}
            className="w-8 h-8 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer transition-colors"
            title="Edit Stage"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(stage)}
            className="w-8 h-8 rounded-lg border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center cursor-pointer transition-colors"
            title="Delete Stage"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
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
  const { data: detailData, isLoading, error, refetch } = useQuery<TemplateDetailResponse>({
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

  const selectedColor = watch("color") || "#6366F1";

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

  const persistStageOrder = async (updatedStages: ProductionStage[]) => {
    try {
      const res = await fetch(`/api/master-data/production-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: detailData?.template.name,
          description: detailData?.template.description,
          is_default: detailData?.template.is_default,
          stages: updatedStages.map((s) => ({
            id: s.id,
            order_index: s.order_index,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to persist template stage order");
      }
      toast.success("Workflow order saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to update order");
      queryClient.invalidateQueries({ queryKey: ["production-template-detail", id] });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const reorderedList = arrayMove(stages, oldIndex, newIndex);
    const listWithUpdatedOrders = reorderedList.map((stage, idx) => ({
      ...stage,
      order_index: idx + 1,
    }));
    setStages(listWithUpdatedOrders);
    await persistStageOrder(listWithUpdatedOrders);
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const reordered = arrayMove(stages, index, index - 1);
    const listWithUpdatedOrders = reordered.map((stage, idx) => ({
      ...stage,
      order_index: idx + 1,
    }));
    setStages(listWithUpdatedOrders);
    await persistStageOrder(listWithUpdatedOrders);
  };

  const handleMoveDown = async (index: number) => {
    if (index >= stages.length - 1) return;
    const reordered = arrayMove(stages, index, index + 1);
    const listWithUpdatedOrders = reordered.map((stage, idx) => ({
      ...stage,
      order_index: idx + 1,
    }));
    setStages(listWithUpdatedOrders);
    await persistStageOrder(listWithUpdatedOrders);
  };

  const template = detailData?.template;

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error || (!isLoading && !template)}
      error={error ? String(error) : "Template not found"}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={3}
    >
      {template && (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
          {/* Mobile App Bar Header */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <Link
                href="/master-data/production-stages/templates"
                className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] flex items-center justify-center text-[var(--text-secondary)] transition-colors shrink-0"
                aria-label="Back to templates"
              >
                <ArrowLeft size={18} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-xl font-bold text-[var(--text-primary)] truncate">
                    {template.name}
                  </h1>
                  {template.is_default && (
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0 select-none">
                      <Star size={10} className="fill-current" /> Default
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-[var(--text-muted)] truncate">
                  {stages.length} workflow {stages.length === 1 ? "stage" : "stages"} configured
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="h-10 px-3.5 sm:px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[var(--primary)]/15"
              >
                <Plus size={15} />
                <span className="hidden sm:inline">Add Stage</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Template Info Card */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-bold shadow-sm">
                <Layers size={22} />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                    {template.name}
                  </h2>
                  {template.is_default && (
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 select-none">
                      <Star size={10} className="fill-current" /> Default Template
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {template.description || "No description provided for this template."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-light)] shrink-0">
              <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[var(--table-header-bg)] border border-[var(--border)] text-[var(--text-secondary)]">
                {stages.filter((s) => s.is_active).length} / {stages.length} Active Stages
              </span>
            </div>
          </div>

          {/* Stages Sequence Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                  Workflow Stages
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
                  {stages.length} {stages.length === 1 ? "Stage" : "Stages"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="h-9 px-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Stage
              </button>
            </div>

            {stages.length > 0 && (
              <div className="text-xs font-medium text-[var(--text-muted)] bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-2 select-none">
                <GripVertical size={15} className="text-[var(--text-faint)] shrink-0" />
                <span>
                  Touch drag the grip handle or use the ▲ / ▼ buttons to adjust the sequence order.
                </span>
              </div>
            )}

            {/* Empty State */}
            {stages.length === 0 ? (
              <div className="bg-[var(--card-bg)] border border-dashed border-[var(--border)] rounded-2xl p-8 sm:p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--primary-light)] border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] mx-auto">
                  <Layers size={26} />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    No stages defined in this template
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Add production stages to this workflow so lots can follow this execution pipeline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-[var(--primary)]/15"
                >
                  <Plus size={16} /> Add First Stage
                </button>
              </div>
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
                  {/* Mobile Card List View (block md:hidden) - 0 horizontal scroll */}
                  <div className="block md:hidden space-y-3">
                    {stages.map((stage, idx) => (
                      <SortableStageCard
                        key={stage.id}
                        stage={stage}
                        index={idx}
                        total={stages.length}
                        onEdit={handleOpenEdit}
                        onDelete={handleOpenDelete}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                      />
                    ))}
                  </div>

                  {/* Desktop Table View (hidden md:block) */}
                  <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider h-11">
                            <th className="w-12 text-center">Drag</th>
                            <th className="w-16 text-center">Seq</th>
                            <th className="px-4">Stage Name</th>
                            <th className="px-4">Scope Description</th>
                            <th className="px-4 w-32">Theme Color</th>
                            <th className="px-4">Custom Fields</th>
                            <th className="px-4 w-28">Status</th>
                            <th className="px-4 w-28 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-sm">
                          {stages.map((stage) => (
                            <SortableDesktopRow
                              key={stage.id}
                              stage={stage}
                              onEdit={handleOpenEdit}
                              onDelete={handleOpenDelete}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Add / Edit Stage Modal (Using shared Modal) */}
          <Modal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title={editingStage ? "Edit Workflow Stage" : "Add Workflow Stage"}
            description={
              editingStage
                ? "Modify stage scope, color accent, or worker input parameters"
                : "Define a step in this production workflow sequence"
            }
            maxWidth="max-w-xl"
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
              {/* Stage Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Stage Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cutting, Stitching, Embroidery, QC"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-xl px-3.5 h-11 text-sm font-semibold transition-colors"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs font-medium text-red-500">{errors.name.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Scope / Instructions <span className="text-[10px] lowercase text-[var(--text-faint)]">(optional)</span>
                </label>
                <textarea
                  placeholder="Define work instructions or quality requirements for this stage..."
                  rows={2}
                  className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-xl text-sm transition-colors resize-none"
                  {...register("description")}
                />
              </div>

              {/* Color Accent Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                  <span>Visual Accent Color</span>
                  <span className="font-mono text-[11px] text-[var(--text-secondary)]">{selectedColor}</span>
                </label>

                {/* Quick preset color swatches */}
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setValue("color", c)}
                      className={cn(
                        "w-8 h-8 rounded-xl transition-transform flex items-center justify-center cursor-pointer border border-black/10",
                        selectedColor.toLowerCase() === c.toLowerCase()
                          ? "scale-110 ring-2 ring-offset-2 ring-[var(--primary)]"
                          : "hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {selectedColor.toLowerCase() === c.toLowerCase() && (
                        <CheckCircle2 size={16} className="text-white" />
                      )}
                    </button>
                  ))}

                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="color"
                      className="w-8 h-8 rounded-lg cursor-pointer border border-[var(--input-border)] bg-transparent"
                      {...register("color")}
                    />
                  </div>
                </div>
              </div>

              {/* Active Status Row */}
              <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    Active Stage
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Allow production lots to be assigned to this stage
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="is_active_toggle_detail"
                  className="h-4.5 w-4.5 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)] rounded cursor-pointer"
                  {...register("is_active")}
                />
              </div>

              {/* Job Work Stage Custom Parameters Subform */}
              <div className="border border-[var(--border)] rounded-xl p-3 sm:p-4 space-y-3 bg-[var(--card-bg)]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Job Work Custom Fields
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Parameters recorded upon stage completion (e.g. Reject Count)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => append({ name: "", type: "text", required: false })}
                    className="h-8 px-2.5 rounded-lg border border-[var(--primary)]/30 text-[var(--primary)] hover:bg-[var(--primary-light)] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus size={14} /> Add Parameter
                  </button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-3 px-2 bg-[var(--table-header-bg)] border border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--text-faint)]">
                    No custom parameters. Standard metrics (worker, quantity out, piece rate) will apply.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {fields.map((item, index) => (
                      <div
                        key={item.id}
                        className="bg-[var(--table-header-bg)] p-3 rounded-xl border border-[var(--border)] space-y-2"
                      >
                        {/* Field label */}
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Parameter Name (e.g. Reject Count, Shade, Waist)"
                            className="w-full h-9 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] rounded-lg text-xs font-semibold"
                            {...register(`custom_fields.${index}.name` as const)}
                          />
                          {errors.custom_fields?.[index]?.name && (
                            <p className="text-[10px] text-red-500 font-medium">
                              {errors.custom_fields[index]?.name?.message}
                            </p>
                          )}
                        </div>

                        {/* Type, Required toggle, and Delete button */}
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 h-8 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                            {...register(`custom_fields.${index}.type` as const)}
                          >
                            <option value="text">Text string</option>
                            <option value="number">Numeric count / measurement</option>
                            <option value="boolean">Yes / No toggle</option>
                            <option value="date">Date selector</option>
                          </select>

                          <label className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5 select-none cursor-pointer px-2 shrink-0">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)] rounded cursor-pointer"
                              {...register(`custom_fields.${index}.required` as const)}
                            />
                            Required
                          </label>

                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="w-8 h-8 rounded-lg border border-red-200 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                            title="Remove parameter"
                            aria-label="Remove custom field"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-[var(--border)] flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isSubmitting}
                  className="h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-xs font-semibold text-[var(--text-secondary)] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <AsyncButton
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="h-10 px-5 text-xs font-bold"
                >
                  {editingStage ? "Update Stage" : "Add Stage"}
                </AsyncButton>
              </div>
            </form>
          </Modal>

          {/* Delete Stage Confirm */}
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Delete Production Stage?"
            description={`Are you sure you want to delete "${deletingStage?.name}"? Any active production lots referencing this stage will continue to retain it, but future lots will omit this stage.`}
            confirmText="Delete Stage"
            onConfirm={handleDeleteConfirm}
            loading={deleteLoading}
          />
        </div>
      )}
    </PageState>
  );
}
