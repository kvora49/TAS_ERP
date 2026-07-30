"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Plus,
  Bell,
  CheckCircle2,
  Pin,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";

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

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newDate, setNewDate] = useState(todayStr);
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newCategory, setNewCategory] = useState<"general" | "production" | "payment" | "order" | "inventory" | "followup">("general");
  const [newHasReminder, setNewHasReminder] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState("");

  const { data: notesData, isLoading, refetch } = useQuery({
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

  const selectedDateNotes = useMemo(() => {
    return notes.filter((n) => n.note_date === selectedDate);
  }, [notes, selectedDate]);

  const inputClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-faint)]
    focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-3 h-10 text-xs
    transition-colors
  `;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-sm)] space-y-6">
      {/* Title & Action Bar */}
      <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-emerald-500" />
            <span>Date-Wise Notes & Scheduled Reminders</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Store date-wise instructions, follow-ups, and reminders for this design
          </p>
        </div>

        <button
          onClick={() => {
            setNewDate(selectedDate);
            setAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Note for Design
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Date Selector */}
        <div className="lg:col-span-5 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase">Calendar View</h3>
            <span className="text-xs font-bold text-[var(--primary)]">{notes.length} Notes Recorded</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[var(--text-muted)] shrink-0">Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`${inputClass} flex-1`}
            />
          </div>

          <div className="p-3 bg-[var(--card-bg)] rounded-xl border border-[var(--border-light)] space-y-1 text-xs">
            <p className="font-bold text-[var(--text-primary)]">Selected: {selectedDate}</p>
            <p className="text-[var(--text-muted)]">{selectedDateNotes.length} notes for this date</p>
          </div>
        </div>

        {/* Right: Notes List */}
        <div className="lg:col-span-7 space-y-3">
          {selectedDateNotes.length === 0 ? (
            <div className="p-8 text-center bg-[var(--page-bg)] border border-dashed border-[var(--border)] rounded-xl space-y-2">
              <CalendarIcon className="h-8 w-8 text-[var(--text-faint)] mx-auto" />
              <p className="text-xs font-bold text-[var(--text-primary)]">No notes recorded for {selectedDate}</p>
              <button
                onClick={() => {
                  setNewDate(selectedDate);
                  setAddModalOpen(true);
                }}
                className="text-xs font-bold text-[var(--primary)] underline cursor-pointer"
              >
                + Add Note Now
              </button>
            </div>
          ) : (
            selectedDateNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-2 flex items-start justify-between"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      toggleCompleteMutation.mutate({ id: note.id, is_completed: !note.is_completed })
                    }
                    className="mt-0.5 cursor-pointer"
                  >
                    <CheckCircle2
                      className={`h-5 w-5 ${note.is_completed ? "text-emerald-500 fill-emerald-500/10" : "text-[var(--text-muted)]"}`}
                    />
                  </button>
                  <div>
                    <h4 className={`text-xs font-bold text-[var(--text-primary)] ${note.is_completed ? "line-through opacity-50" : ""}`}>
                      {note.title}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{note.content}</p>
                    {note.has_reminder && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                        <Bell className="h-3 w-3" /> Reminder Set
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteNoteMutation.mutate(note.id)}
                  className="text-[var(--text-muted)] hover:text-red-500 p-1 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal open={addModalOpen} onOpenChange={setAddModalOpen} title="Add Date Note for Design" maxWidth="max-w-md">
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Target Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Note Title *</label>
            <input
              type="text"
              placeholder="e.g. Confirm Fabric Dyeing Colour Match"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Details</label>
            <textarea
              placeholder="Note details..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className={`${inputClass} w-full h-auto py-2`}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="chkSecRem"
              checked={newHasReminder}
              onChange={(e) => setNewHasReminder(e.target.checked)}
              className="w-4 h-4 text-[var(--primary)]"
            />
            <label htmlFor="chkSecRem" className="text-xs font-bold text-[var(--text-primary)] cursor-pointer">
              Schedule Reminder Alert
            </label>
          </div>

          {newHasReminder && (
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Reminder Time</label>
              <input
                type="datetime-local"
                value={newReminderTime}
                onChange={(e) => setNewReminderTime(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <button onClick={() => setAddModalOpen(false)} className="text-xs text-[var(--text-muted)] px-3 py-1.5">
              Cancel
            </button>
            <AsyncButton variant="primary" onClick={() => createNoteMutation.mutateAsync()} className="text-xs px-3 py-1.5">
              Save Note
            </AsyncButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
