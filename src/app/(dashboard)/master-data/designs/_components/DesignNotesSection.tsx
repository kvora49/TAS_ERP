"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Plus,
  Bell,
  CheckCircle2,
  Trash2,
  Clock,
} from "lucide-react";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  content: string;
  note_date: string;
  has_reminder: boolean;
  reminder_time: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  category: "general" | "production" | "payment" | "order" | "inventory" | "followup";
  design_id: string | null;
  is_completed: boolean;
  is_pinned: boolean;
}

export default function DesignNotesSection({ designId }: { designId: string }) {
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [currentMonth, setCurrentMonth] = useState<string>(todayStr.substring(0, 7));
  const [filterMode, setFilterMode] = useState<"date" | "all">("date");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDate, setNewDate] = useState(todayStr);
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newCategory, setNewCategory] = useState<"general" | "production" | "payment" | "order" | "inventory" | "followup">("general");
  const [newHasReminder, setNewHasReminder] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState("");

  const { data: notesData, refetch } = useQuery({
    queryKey: ["calendar-notes-list", designId, currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/designs/notes?design_id=${designId}&month=${currentMonth}`);
      if (!res.ok) return { notes: [] };
      return res.json();
    },
    enabled: !!designId,
  });

  const notes: Note[] = notesData?.notes || [];

  const createNoteMutation = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) throw new Error("Note title is required");
      const res = await fetch("/api/master-data/designs/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          note_date: newDate,
          priority: newPriority,
          category: newCategory,
          has_reminder: newHasReminder,
          reminder_time: newHasReminder && newReminderTime ? new Date(newReminderTime).toISOString() : null,
          design_id: designId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create note");
      return json;
    },
    onSuccess: () => {
      toast.success("Note saved!");
      queryClient.invalidateQueries({ queryKey: ["calendar-notes-list"] });
      setAddModalOpen(false);
      setNewTitle("");
      setNewContent("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async (payload: { id: string; is_completed: boolean }) => {
      const res = await fetch("/api/master-data/designs/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payload.id, action: "toggle_complete", is_completed: payload.is_completed }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-notes-list"] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/master-data/designs/notes?id=${id}`, { method: "DELETE" });
      return res.json();
    },
    onSuccess: () => {
      toast.success("Note deleted");
      queryClient.invalidateQueries({ queryKey: ["calendar-notes-list"] });
    },
  });

  const displayedNotes = useMemo(() => {
    if (filterMode === "all") return notes;
    return notes.filter((n) => n.note_date === selectedDate);
  }, [notes, selectedDate, filterMode]);

  const inputClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-faint)]
    focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-2.5 h-8 text-xs font-semibold
    transition-colors
  `;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-5 shadow-[var(--shadow-sm)] space-y-4">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-light)] pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-emerald-500" />
            <span>Date Notes & Reminders</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
            Store date-wise instructions, milestones, and scheduled alerts
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewDate(selectedDate);
            setAddModalOpen(true);
          }}
          className="h-8 sm:h-9 px-3.5 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] transition-all cursor-pointer shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" /> Add Note
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Quick Date Selector */}
        <div className="lg:col-span-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-primary)] uppercase text-[10px]">Filter Mode</span>
            <div className="flex items-center gap-1 bg-[var(--card-bg)] p-0.5 rounded-lg border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setFilterMode("date")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors",
                  filterMode === "date" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"
                )}
              >
                Date
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors",
                  filterMode === "all" ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"
                )}
              >
                All ({notes.length})
              </button>
            </div>
          </div>

          {filterMode === "date" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2 h-8 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[10px] font-bold text-[var(--text-secondary)] hover:bg-[var(--table-row-hover)]"
                >
                  Today
                </button>
              </div>

              <div className="p-2 bg-[var(--card-bg)] rounded-lg border border-[var(--border-light)] text-[11px] flex justify-between">
                <span className="text-[var(--text-muted)] font-medium">{selectedDate}</span>
                <span className="font-bold text-[var(--primary)]">{displayedNotes.length} notes</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Notes Cards List */}
        <div className="lg:col-span-8 space-y-2.5">
          {displayedNotes.length === 0 ? (
            <div className="p-8 text-center bg-[var(--page-bg)] border border-dashed border-[var(--border)] rounded-xl space-y-1.5">
              <CalendarIcon className="h-6 w-6 text-[var(--text-faint)] mx-auto" />
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {filterMode === "date" ? `No notes for ${selectedDate}` : "No notes recorded"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewDate(selectedDate);
                  setAddModalOpen(true);
                }}
                className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
              >
                + Add Note Now
              </button>
            </div>
          ) : (
            displayedNotes.map((note) => (
              <div
                key={note.id}
                className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-1.5 flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      toggleCompleteMutation.mutate({ id: note.id, is_completed: !note.is_completed })
                    }
                    className="mt-0.5 cursor-pointer shrink-0"
                    title={note.is_completed ? "Mark incomplete" : "Mark complete"}
                  >
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4 transition-colors",
                        note.is_completed
                          ? "text-emerald-500 fill-emerald-500/15"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      )}
                    />
                  </button>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4
                        className={cn(
                          "text-xs font-bold text-[var(--text-primary)]",
                          note.is_completed && "line-through opacity-50"
                        )}
                      >
                        {note.title}
                      </h4>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[var(--table-header-bg)] text-[var(--text-muted)] border border-[var(--border)] uppercase">
                        {note.note_date}
                      </span>
                    </div>

                    {note.content && (
                      <p className="text-xs text-[var(--text-body)] leading-relaxed font-medium">
                        {note.content}
                      </p>
                    )}

                    {note.has_reminder && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        <Bell className="h-3 w-3" />
                        <span>Reminder Scheduled</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => deleteNoteMutation.mutate(note.id)}
                  className="text-[var(--text-muted)] hover:text-red-500 p-1 cursor-pointer shrink-0 transition-colors"
                  title="Delete note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Add Date Note"
        description="Schedule a note or reminder for this design SKU"
        maxWidth="max-w-md"
      >
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
              Target Date
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
              Note Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Confirm Fabric Dyeing Match"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
              Details
            </label>
            <textarea
              placeholder="Provide context or instructions..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              className={`${inputClass} w-full h-auto py-1.5 resize-none`}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="chkSecRem"
              checked={newHasReminder}
              onChange={(e) => setNewHasReminder(e.target.checked)}
              className="w-4 h-4 text-[var(--primary)] border-[var(--border)] rounded cursor-pointer"
            />
            <label htmlFor="chkSecRem" className="text-xs font-bold text-[var(--text-primary)] cursor-pointer">
              Schedule Reminder Alert
            </label>
          </div>

          {newHasReminder && (
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-1">
                Reminder Time
              </label>
              <input
                type="datetime-local"
                value={newReminderTime}
                onChange={(e) => setNewReminderTime(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="h-9 px-3.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--table-row-hover)] cursor-pointer"
            >
              Cancel
            </button>
            <AsyncButton
              variant="primary"
              onClick={() => createNoteMutation.mutateAsync()}
              isLoading={createNoteMutation.isPending}
              className="h-9 px-4 rounded-xl text-xs font-bold"
            >
              Save Note
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
