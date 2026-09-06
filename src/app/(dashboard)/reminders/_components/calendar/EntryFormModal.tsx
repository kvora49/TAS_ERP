"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Plus, X, Trash2, GripVertical, Bell, Clock, Tag, User2,
  Palette, Building2, FileText,
} from "lucide-react";
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
import { EntryTypeSelector, CATEGORY_CONFIG } from "./EntryCard";
import { AttachmentManager } from "./AttachmentManager";
import {
  useCreateCalendarEntry,
  useUpdateCalendarEntry,
  useCalendarTemplates,
  type CalendarEntry,
  type CalendarAttachment,
} from "@/hooks/queries/useCalendarEntries";
import { cn } from "@/lib/utils";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-slate-500" },
  { value: "medium", label: "Medium", color: "text-blue-500" },
  { value: "high", label: "High", color: "text-amber-500" },
  { value: "urgent", label: "Urgent", color: "text-red-500" },
];

const REPEAT_OPTIONS = [
  { value: "never", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const NOTIFY_OPTIONS = [
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
];

// ─── Task Item Row ─────────────────────────────────────────────────────────────
function TaskItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: { title: string; sort_order: number };
  onChange: (title: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <GripVertical className="h-3.5 w-3.5 text-[var(--text-faint)] cursor-grab" />
      <div className="w-4 h-4 rounded border-2 border-[var(--input-border)] shrink-0" />
      <input
        type="text"
        value={item.title}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Checklist item..."
        className="flex-1 bg-transparent text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] outline-none border-b border-transparent focus:border-[var(--input-border)] transition-colors"
      />
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-faint)] hover:text-red-500 transition-all"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Tag Input ─────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const t = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput("");
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 text-xs bg-[var(--primary-light)] text-[var(--primary)] px-2 py-0.5 rounded-full font-medium">
          #{tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder="Add tag..."
        className="text-xs bg-transparent text-[var(--text-body)] placeholder:text-[var(--text-faint)] outline-none min-w-[80px] border-b border-[var(--input-border)] focus:border-[var(--primary)] transition-colors"
      />
    </div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────
function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</label>
      {children}
    </div>
  );
}

// ─── Entry Form Modal ──────────────────────────────────────────────────────────
interface EntryFormModalProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  defaultType?: CalendarEntry["entry_type"];
  existingEntry?: CalendarEntry | null;
}

export function EntryFormModal({
  open,
  onClose,
  selectedDate,
  defaultType = "note",
  existingEntry,
}: EntryFormModalProps) {
  const isEditing = !!existingEntry;
  const { data: templatesData } = useCalendarTemplates();
  const templates = templatesData?.data || [];

  const [entryType, setEntryType] = useState<CalendarEntry["entry_type"]>(defaultType);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [entryTime, setEntryTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(true);
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [taskItems, setTaskItems] = useState<{ title: string; sort_order: number }[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  // Reminder fields
  const [notifyBefore, setNotifyBefore] = useState(30);
  const [repeatType, setRepeatType] = useState("never");
  // Template
  const [selectedTemplate, setSelectedTemplate] = useState("");
  // Attachments
  const [attachments, setAttachments] = useState<CalendarAttachment[]>([]);
  // Show advanced
  const [showAdvanced, setShowAdvanced] = useState(false);

  const create = useCreateCalendarEntry();
  const update = useUpdateCalendarEntry();

  const isDirty = open && Boolean(title.trim() || content.trim());
  useUnsavedChangesGuard(isDirty);

  // Populate form when editing
  useEffect(() => {
    if (existingEntry) {
      setEntryType(existingEntry.entry_type);
      setTitle(existingEntry.title);
      setContent(existingEntry.content || "");
      setEntryDate(existingEntry.entry_date);
      setEntryTime(existingEntry.entry_time || "");
      setEndDate(existingEntry.end_date || "");
      setIsAllDay(existingEntry.is_all_day);
      setPriority(existingEntry.priority);
      setCategory(existingEntry.category);
      setTags(existingEntry.tags || []);
      setIsPinned(existingEntry.is_pinned);
      setTaskItems(existingEntry.tasks?.map((t) => ({ title: t.title, sort_order: t.sort_order })) || []);
      setAttachments(existingEntry.attachments || []);
      if (existingEntry.reminders?.[0]) {
        setNotifyBefore(existingEntry.reminders[0].notify_before_minutes);
        setRepeatType(existingEntry.reminders[0].repeat_type);
      }
    } else {
      // Reset
      setEntryType(defaultType);
      setTitle("");
      setContent("");
      setEntryDate(format(selectedDate, "yyyy-MM-dd"));
      setEntryTime("");
      setEndDate("");
      setIsAllDay(true);
      setPriority("medium");
      setCategory("general");
      setTags([]);
      setIsPinned(false);
      setTaskItems([]);
      setNewTaskTitle("");
      setNotifyBefore(30);
      setRepeatType("never");
      setSelectedTemplate("");
    }
  }, [existingEntry, open, defaultType, selectedDate]);

  // Apply template
  useEffect(() => {
    if (!selectedTemplate) return;
    const tmpl = templates.find((t) => t.id === selectedTemplate);
    if (!tmpl) return;
    setEntryType(tmpl.template_type as any);
    setContent(tmpl.content || "");
    setCategory(tmpl.category);
    setPriority(tmpl.priority);
    if (tmpl.task_items?.length) {
      setTaskItems(tmpl.task_items.map((i, idx) => ({ title: typeof i === "string" ? i : i.title, sort_order: idx })));
    }
  }, [selectedTemplate, templates]);

  const handleAddTaskItem = () => {
    const t = newTaskTitle.trim();
    if (!t) return;
    setTaskItems((prev) => [...prev, { title: t, sort_order: prev.length }]);
    setNewTaskTitle("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!entryDate) {
      toast.error("Date is required");
      return;
    }

    try {
      if (isEditing) {
        await update.mutateAsync({
          id: existingEntry!.id,
          entry_type: entryType,
          title: title.trim(),
          content: content || null,
          entry_date: entryDate,
          entry_time: isAllDay ? null : entryTime || null,
          end_date: endDate || null,
          is_all_day: isAllDay,
          priority,
          category,
          tags,
          is_pinned: isPinned,
        } as any);
        toast.success("Entry updated");
      } else {
        await create.mutateAsync({
          entry_type: entryType,
          title: title.trim(),
          content: content || null,
          entry_date: entryDate,
          entry_time: isAllDay ? null : entryTime || null,
          end_date: endDate || null,
          is_all_day: isAllDay,
          priority,
          category,
          tags,
          is_pinned: isPinned,
          task_items: entryType === "task" ? taskItems : undefined,
          reminder_notify_before_minutes: entryType === "reminder" ? notifyBefore : undefined,
          reminder_repeat_type: entryType === "reminder" ? repeatType : undefined,
          template_id: selectedTemplate || undefined,
        } as any);
        toast.success(`${entryType.charAt(0).toUpperCase() + entryType.slice(1)} created`);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  const categoryKeys = Object.keys(CATEGORY_CONFIG);

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={isEditing ? `Edit ${existingEntry?.entry_type}` : "Add Activity"}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Type Selector */}
        {!isEditing && <EntryTypeSelector selected={entryType} onChange={setEntryType} />}

        {/* Template picker */}
        {!isEditing && templates.length > 0 && (
          <Section title="Template (optional)">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
            >
              <option value="">No template</option>
              {templates
                .filter((t) => t.template_type === entryType || !entryType)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.is_system ? "⭐ " : ""}{t.name}
                  </option>
                ))}
            </select>
          </Section>
        )}

        {/* Title */}
        <Section title="Title *">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              entryType === "note" ? "Note title..."
              : entryType === "reminder" ? "Reminder title..."
              : entryType === "task" ? "Task title..."
              : entryType === "journal" ? "Journal entry title..."
              : "Event title..."
            }
            className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
        </Section>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <Section title="Date">
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
            />
          </Section>
          <Section title="Time">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded"
                />
                All day
              </label>
              {!isAllDay && (
                <input
                  type="time"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="flex-1 h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              )}
            </div>
          </Section>
        </div>

        {/* Reminder options */}
        {entryType === "reminder" && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <Section title="Notify">
              <select
                value={notifyBefore}
                onChange={(e) => setNotifyBefore(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
              >
                {NOTIFY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Section>
            <Section title="Repeat">
              <select
                value={repeatType}
                onChange={(e) => setRepeatType(e.target.value)}
                className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
              >
                {REPEAT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Section>
          </div>
        )}

        {/* Content */}
        {entryType !== "task" && (
          <Section title={entryType === "journal" ? "Journal Entry" : "Content"}>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={
                entryType === "note" ? "Write your note here..."
                : entryType === "reminder" ? "Describe what this reminder is for..."
                : entryType === "journal" ? "What happened today? What are you thinking about?"
                : "Describe the event..."
              }
              minHeight="min-h-[100px]"
            />
          </Section>
        )}

        {/* Task checklist items */}
        {entryType === "task" && (
          <Section title="Checklist">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3 space-y-2">
              {taskItems.map((item, idx) => (
                <TaskItemRow
                  key={idx}
                  item={item}
                  onChange={(t) => setTaskItems((prev) => prev.map((p, i) => i === idx ? { ...p, title: t } : p))}
                  onRemove={() => setTaskItems((prev) => prev.filter((_, i) => i !== idx))}
                />
              ))}
              <div className="flex items-center gap-2 pt-1">
                <div className="w-3.5 h-3.5 shrink-0" /> {/* grip spacer */}
                <div className="w-4 h-4 rounded border-2 border-[var(--primary)] shrink-0" />
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTaskItem(); } }}
                  placeholder="Add checklist item... (Enter to add)"
                  className="flex-1 bg-transparent text-sm text-[var(--text-body)] placeholder:text-[var(--text-faint)] outline-none"
                />
                {newTaskTitle && (
                  <button
                    type="button"
                    onClick={handleAddTaskItem}
                    className="p-0.5 rounded bg-[var(--primary)] text-white"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-faint)]">Press Enter to add each item</p>
          </Section>
        )}

        {/* Priority & Category */}
        <div className="grid grid-cols-2 gap-3">
          <Section title="Priority">
            <div className="flex gap-1">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-all",
                    priority === p.value
                      ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-muted)] hover:border-[var(--primary)]"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
            >
              {categoryKeys.map((key) => (
                <option key={key} value={key}>{CATEGORY_CONFIG[key].label}</option>
              ))}
            </select>
          </Section>
        </div>

        {/* Tags */}
        <Section title="Tags">
          <div className="min-h-[36px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 flex flex-wrap gap-1 items-center">
            <TagInput tags={tags} onChange={setTags} />
          </div>
        </Section>

        {/* Attachments */}
        <Section title="Attachments">
          <AttachmentManager
            entryId={existingEntry?.id}
            attachments={attachments}
            onAttachmentAdded={(att) => setAttachments((prev) => [...prev, att])}
            onAttachmentDeleted={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
          />
        </Section>

        {/* Advanced */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors flex items-center gap-1"
          >
            {showAdvanced ? "Hide" : "Show"} advanced options
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--page-bg)]">
              {/* End Date */}
              <Section title="End Date (optional)">
                <input
                  type="date"
                  value={endDate}
                  min={entryDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
                />
              </Section>

              {/* Pin */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-[var(--text-body)]">Pin to top of day</span>
              </label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[var(--border)] text-[var(--text-muted)] text-sm font-semibold hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            Cancel
          </button>
          <AsyncButton
            onClick={handleSubmit}
            variant="primary"
            className="flex-1 h-10 rounded-xl"
          >
            {isEditing ? "Save Changes" : `Add ${entryType.charAt(0).toUpperCase() + entryType.slice(1)}`}
          </AsyncButton>
        </div>
      </div>
    </Modal>
  );
}
