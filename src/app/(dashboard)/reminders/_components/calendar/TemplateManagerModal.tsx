"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, FileText, CheckSquare, Bell, Calendar, Star, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";

const RichTextEditor = dynamic(
  () => import("@/components/shared/RichTextEditor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-xl animate-pulse" />
    ),
  }
);
import { useCalendarTemplates, type CalendarTemplate } from "@/hooks/queries/useCalendarEntries";
import { ENTRY_TYPE_CONFIG } from "./EntryCard";
import { cn } from "@/lib/utils";

interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate?: (template: CalendarTemplate) => void;
}

export function TemplateManagerModal({ open, onClose, onSelectTemplate }: TemplateManagerModalProps) {
  const { data, isLoading } = useCalendarTemplates();
  const templates = data?.data || [];

  const [editingTemplate, setEditingTemplate] = useState<Partial<CalendarTemplate> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateType, setTemplateType] = useState<CalendarTemplate["template_type"]>("task");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [taskItems, setTaskItems] = useState<{ title: string; sort_order: number }[]>([]);
  const [newTaskItem, setNewTaskItem] = useState("");

  const openCreate = () => {
    setEditingTemplate(null);
    setName("");
    setDescription("");
    setTemplateType("task");
    setContent("");
    setCategory("general");
    setPriority("medium");
    setTaskItems([]);
    setIsFormOpen(true);
  };

  const openEdit = (tmpl: CalendarTemplate) => {
    if (tmpl.is_system) {
      toast.error("System templates cannot be edited. Clone or create a custom template.");
      return;
    }
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setDescription(tmpl.description || "");
    setTemplateType(tmpl.template_type);
    setContent(tmpl.content || "");
    setCategory(tmpl.category);
    setPriority(tmpl.priority);
    setTaskItems(tmpl.task_items || []);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    try {
      const payload = {
        id: editingTemplate?.id,
        name: name.trim(),
        description: description.trim() || null,
        template_type: templateType,
        content: content || null,
        task_items: taskItems,
        category,
        priority,
      };

      const method = editingTemplate?.id ? "PUT" : "POST";
      const res = await fetch("/api/calendar/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save template");

      toast.success(editingTemplate?.id ? "Template updated" : "Template created");
      setIsFormOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this custom template?")) return;
    try {
      const res = await fetch(`/api/calendar/templates?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
      toast.success("Template deleted");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Activity Templates"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {!isFormOpen ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">
                Select a template to use or manage custom templates for quick activity creation.
              </p>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--primary-dark)] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Template
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {templates.map((tmpl) => {
                const typeConfig = ENTRY_TYPE_CONFIG[tmpl.template_type as keyof typeof ENTRY_TYPE_CONFIG];
                const TypeIcon = typeConfig?.icon || FileText;

                return (
                  <div
                    key={tmpl.id}
                    className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--primary)] transition-all flex flex-col justify-between group space-y-2"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn("p-1.5 rounded-md", typeConfig?.bgColor || "bg-slate-100")}>
                            <TypeIcon className={cn("h-3.5 w-3.5", typeConfig?.textColor || "text-slate-600")} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1">
                              {tmpl.name}
                              {tmpl.is_system && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-500 font-semibold px-1.5 py-0.2 rounded-full border border-amber-500/20">
                                  System
                                </span>
                              )}
                            </h4>
                          </div>
                        </div>

                        {!tmpl.is_system && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEdit(tmpl)}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--primary)]"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tmpl.id)}
                              className="p-1 text-[var(--text-muted)] hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {tmpl.description && (
                        <p className="text-xs text-[var(--text-muted)] mt-1.5">{tmpl.description}</p>
                      )}

                      {tmpl.task_items && tmpl.task_items.length > 0 && (
                        <div className="mt-2 text-[11px] text-[var(--text-faint)]">
                          📋 {tmpl.task_items.length} checklist items
                        </div>
                      )}
                    </div>

                    {onSelectTemplate && (
                      <button
                        onClick={() => { onSelectTemplate(tmpl); onClose(); }}
                        className="w-full py-1.5 px-3 bg-[var(--primary-light)] text-[var(--primary)] font-semibold text-xs rounded-lg hover:bg-[var(--primary)] hover:text-white transition-colors"
                      >
                        Use Template
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Create / Edit Form */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {editingTemplate?.id ? "Edit Custom Template" : "New Custom Template"}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Back to list
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Template Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Weekly Machine Inspection"
                  className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs px-3 focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Activity Type</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value as any)}
                  className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs px-3 focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                >
                  <option value="note">Note</option>
                  <option value="task">Task</option>
                  <option value="reminder">Reminder</option>
                  <option value="event">Event</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of template purpose"
                className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs px-3 focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
              />
            </div>

            {templateType === "task" ? (
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Checklist Items</label>
                <div className="space-y-1.5 p-3 rounded-lg border border-[var(--border)] bg-[var(--page-bg)]">
                  {taskItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-body)] flex-1">{item.title}</span>
                      <button
                        type="button"
                        onClick={() => setTaskItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newTaskItem}
                      onChange={(e) => setNewTaskItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (newTaskItem.trim()) {
                            setTaskItems([...taskItems, { title: newTaskItem.trim(), sort_order: taskItems.length }]);
                            setNewTaskItem("");
                          }
                        }
                      }}
                      placeholder="Add item and press Enter"
                      className="flex-1 h-8 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-xs px-2 text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Content Template</label>
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="Template default body content..."
                  minHeight="min-h-[100px]"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <AsyncButton
                onClick={handleSave}
                variant="primary"
                className="px-4 py-1.5 text-xs rounded-lg"
              >
                Save Template
              </AsyncButton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
