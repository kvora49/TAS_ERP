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
  id: string; // client-side temporary ID
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order_index: number;
  custom_fields: { name: string; type: "text" | "number" | "boolean" | "date"; required: boolean }[];
  is_active: boolean;
}

// Drag & Drop Sortable Row Component
function SortableRow({
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
    backgroundColor: isDragging ? "#F8FAFC" : "transparent",
  };

  return (
    <tr ref={setNodeRef} style={style} className="group hover:bg-[#F8FAFC]/50 transition-colors">
      {/* Handle */}
      <td className="align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors mx-auto cursor-grab active:cursor-grabbing"
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
            type="button"
            onClick={() => onEdit(stage)}
            className="w-9 h-9 border border-[#E5E7EB] rounded-lg hover:bg-[#F1F5F9] text-[#6B7280] flex items-center justify-center cursor-pointer transition-all"
            title="Edit Stage"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
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

export default function NewTemplatePage() {
  const router = useRouter();

  // Template Metadata state (handled via native react state or react-hook-form)
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateDefault, setTemplateDefault] = useState(false);

  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProductionStage | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingStage, setDeletingStage] = useState<ProductionStage | null>(null);
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);

  // Stage form hook
  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting: isSubmittingStage },
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

  // dnd-kit sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setStages((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      const reordered = arrayMove(items, oldIndex, newIndex);
      return reordered.map((item, idx) => ({
        ...item,
        order_index: idx + 1,
      }));
    });
  };

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
      custom_fields: stage.custom_fields,
      is_active: stage.is_active,
    });
    setModalOpen(true);
  };

  const handleOpenDelete = (stage: ProductionStage) => {
    setDeletingStage(stage);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingStage) return;
    setStages((prev) => {
      const filtered = prev.filter((s) => s.id !== deletingStage.id);
      return filtered.map((s, i) => ({ ...s, order_index: i + 1 }));
    });
    setDeleteOpen(false);
    toast.success("Stage removed from local list.");
  };

  // On stage form submit (Local memory only)
  const onStageSubmit = (data: StageFormValues) => {
    if (editingStage) {
      // Edit existing local stage
      setStages((prev) =>
        prev.map((s) =>
          s.id === editingStage.id
            ? {
                ...s,
                name: data.name,
                description: data.description || null,
                icon: data.icon || null,
                color: data.color || "#6366F1",
                custom_fields: data.custom_fields,
                is_active: data.is_active,
              }
            : s
        )
      );
      toast.success("Stage updated in local list.");
    } else {
      // Add new local stage
      const newStage: ProductionStage = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        name: data.name,
        description: data.description || null,
        icon: data.icon || null,
        color: data.color || "#6366F1",
        order_index: stages.length + 1,
        custom_fields: data.custom_fields,
        is_active: data.is_active,
      };
      setStages((prev) => [...prev, newStage]);
      toast.success("Stage added to local list.");
    }
    setModalOpen(false);
  };

  // Submit complete template with inline stages
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Template name is required.");
      return;
    }

    setIsSubmittingTemplate(true);
    try {
      const res = await fetch("/api/master-data/production-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          description: templateDesc,
          is_default: templateDefault,
          stages: stages.map((s) => ({
            name: s.name,
            description: s.description,
            icon: s.icon,
            color: s.color,
            custom_fields: s.custom_fields,
            is_active: s.is_active,
          })),
        }),
      });

      if (!res.ok) {
        const errResult = await res.json();
        throw new Error(errResult.error || "Failed to create template");
      }

      toast.success("Production template created successfully!");
      router.push("/master-data/production-stages/templates");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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
        <span className="text-[#0F172A]">New Template</span>
      </div>

      {/* Main Form Fields (Aesthetics card) */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#F1F5F9]">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-xl shadow-sm">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">Create Production Template</h1>
              <p className="text-xs text-[#64748B] font-semibold mt-0.5">Configure your stages sequence and custom inputs inline.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleSaveTemplate}
              disabled={isSubmittingTemplate}
              className="flex-1 md:flex-initial h-10 px-5 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-[#6366F1]/10 disabled:opacity-50"
            >
              {isSubmittingTemplate ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                "Save Template"
              )}
            </button>
            <button
              onClick={() => router.push(`/master-data/production-stages/templates`)}
              className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Template Name *</label>
              <input
                type="text"
                placeholder="e.g. Winter Wear Template, Basic T-Shirt"
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold text-[#0F172A]"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Description</label>
              <textarea
                placeholder="Brief details about the template usage..."
                rows={3}
                className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none text-[#334155]"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Default Template</h4>
                <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-normal max-w-[200px]">
                  Setting this automatically defaults newly created production lots to this sequence.
                </p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                checked={templateDefault}
                onChange={(e) => setTemplateDefault(e.target.checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stages Reorderable Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wider">Stages Sequence</h2>
          <button
            onClick={handleOpenAdd}
            className="h-9 px-3 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#6366F1]/10"
          >
            <Plus size={14} /> Add Stage
          </button>
        </div>

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
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
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
      </div>

      {/* Add/Edit Stage Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-xl shadow-lg border border-[#E5E7EB] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0F172A]">
              {editingStage ? "Edit Stage details" : "Add New Stage to Template"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onStageSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Stage Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Stage Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Cutting, Stitching, Quality Check"
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all font-semibold"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs font-semibold text-[#DC2626]">{errors.name.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Description</label>
                <textarea
                  placeholder="Define work instructions or stage scope..."
                  rows={2}
                  className="w-full p-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all resize-none"
                  {...register("description")}
                />
              </div>

              {/* Color Tag Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Visual Theme Color *</label>
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
                  <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Job Work Stage Fields</h3>
                  <p className="text-[10px] text-[#64748B] font-medium mt-0.5 leading-none">
                    Define variables that workers/managers must input when completing this stage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ name: "", type: "text", required: true })}
                  className="h-8 px-3 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Field
                </button>
              </div>

              {fields.length === 0 ? (
                <p className="text-xs text-center py-4 text-[#94A3B8] font-bold">No custom fields added yet.</p>
              ) : (
                <div className="space-y-3">
                  {fields.map((item, index) => (
                    <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex-1 w-full space-y-1">
                        <input
                          type="text"
                          placeholder="Field Name (e.g. Reject count, Cutting Operator)"
                          className="w-full h-9 px-3 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold"
                          {...register(`custom_fields.${index}.name` as const)}
                        />
                        {errors.custom_fields?.[index]?.name && (
                          <p className="text-[10px] text-red-500 font-bold">
                            {errors.custom_fields[index]?.name?.message}
                          </p>
                        )}
                      </div>

                      <div className="w-full sm:w-36">
                        <select
                          className="w-full h-9 px-2 bg-white border border-[#D1D5DB] rounded-lg text-xs font-semibold"
                          {...register(`custom_fields.${index}.type` as const)}
                        >
                          <option value="text">Text / String</option>
                          <option value="number">Numeric</option>
                          <option value="boolean">Toggle / Checkbox</option>
                          <option value="date">Date picker</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto pt-1 sm:pt-0">
                        <label className="text-[10px] font-bold text-[#64748B] flex items-center gap-1.5 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-[#6366F1] focus:ring-[#6366F1] border-gray-300 rounded cursor-pointer"
                            {...register(`custom_fields.${index}.required` as const)}
                          />
                          Required
                        </label>

                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="w-8 h-8 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 ml-auto cursor-pointer"
                          title="Remove custom field"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t border-[#F1F5F9]">
              <button
                type="submit"
                disabled={isSubmittingStage}
                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all cursor-pointer shadow-md shadow-[#6366F1]/10 disabled:opacity-50"
              >
                {editingStage ? "Update Stage" : "Add Stage"}
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-all cursor-pointer"
              >
                Close
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove Stage?"
        description="Are you sure you want to remove this stage from the template? This action only affects this template draft."
        confirmText="Remove"
        loading={false}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
