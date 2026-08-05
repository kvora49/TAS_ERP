"use client";

import React, { useState, useCallback } from "react";
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears,
  startOfWeek, endOfWeek, addDays, subDays,
} from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CalendarViewHeader,
  MonthView,
  WeekView,
  DayView,
  YearView,
} from "./_components/calendar/CalendarViews";
import { DailyActivityPanel } from "./_components/calendar/DailyActivityPanel";
import { EntryFormModal } from "./_components/calendar/EntryFormModal";
import { SearchModal } from "./_components/calendar/SearchModal";
import { TemplateManagerModal } from "./_components/calendar/TemplateManagerModal";
import { ReminderCountdownToast } from "./_components/calendar/ReminderCountdownToast";
import {
  useCalendarEntries,
  useCalendarMonthSummary,
  useDeleteCalendarEntry,
  useUpdateCalendarEntry,
  type CalendarEntry,
} from "@/hooks/queries/useCalendarEntries";

type CalendarView = "month" | "week" | "day" | "year";

export function CalendarPlannerTab() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<CalendarView>("week");
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<CalendarEntry["entry_type"]>("note");
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const { data: entriesData, isLoading, isError, refetch } = useCalendarEntries({ date: selectedDateStr });
  const entries = entriesData?.data || [];

  const { data: summaryData } = useCalendarMonthSummary(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1
  );
  const summary = summaryData?.summary || {};

  const deleteEntry = useDeleteCalendarEntry();
  const updateEntry = useUpdateCalendarEntry();

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleNavigate = useCallback((direction: "prev" | "next") => {
    setCurrentDate((d) => {
      if (view === "month") return direction === "next" ? addMonths(d, 1) : subMonths(d, 1);
      if (view === "week") return direction === "next" ? addWeeks(d, 1) : subWeeks(d, 1);
      if (view === "day") return direction === "next" ? addDays(d, 1) : subDays(d, 1);
      if (view === "year") return direction === "next" ? addYears(d, 1) : subYears(d, 1);
      return d;
    });
  }, [view]);

  const handleToday = useCallback(() => {
    setCurrentDate(today);
    setSelectedDate(today);
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    // For week/year views, also update currentDate to keep calendar synced
    if (view === "week" || view === "year") setCurrentDate(date);
    if (view === "day") setCurrentDate(date);
  }, [view]);

  const handleSelectMonth = useCallback((date: Date) => {
    setCurrentDate(date);
    setView("month");
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAdd = useCallback((type?: string) => {
    setFormType((type as CalendarEntry["entry_type"]) || "note");
    setEditingEntry(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((entry: CalendarEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this activity? This cannot be undone.")) return;
    try {
      await deleteEntry.mutateAsync(id);
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }, [deleteEntry]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      await updateEntry.mutateAsync({ id, status } as any);
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  }, [updateEntry]);

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-full min-h-[calc(100vh-180px)] bg-[var(--page-bg)] rounded-2xl overflow-hidden border border-[var(--border)] shadow-[var(--shadow-md)]">
      {/* ── Left Panel — Calendar ──────────────────────────────────────────── */}
      <div className="w-full lg:w-[320px] shrink-0 flex flex-col bg-[var(--card-bg)] border-b lg:border-b-0 lg:border-r border-[var(--border)]">
        {/* Calendar header */}
        <div className="px-4 pt-4 pb-3 space-y-3">
          <CalendarViewHeader
            currentDate={currentDate}
            view={view}
            onViewChange={setView}
            onNavigate={handleNavigate}
            onToday={handleToday}
          />
        </div>

        {/* Calendar view area */}
        <div className="px-3 pb-4 flex-1 overflow-y-auto">
          {view === "month" && (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              summary={summary}
            />
          )}
          {view === "week" && (
            <WeekView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              summary={summary}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          )}
          {view === "year" && (
            <YearView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onSelectMonth={handleSelectMonth}
            />
          )}
        </div>

        {/* Legend */}
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">
          <p className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2">Legend</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {[
              { color: "bg-red-500", label: "Overdue" },
              { color: "bg-amber-400", label: "Reminder" },
              { color: "bg-blue-500", label: "Event" },
              { color: "bg-purple-500", label: "Note" },
              { color: "bg-green-500", label: "Completed" },
              { color: "bg-teal-500", label: "Journal" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full shrink-0", color)} />
                <span className="text-[10px] text-[var(--text-faint)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel — Daily Activity ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <DailyActivityPanel
          selectedDate={selectedDate}
          entries={entries}
          isLoading={isLoading}
          isError={isError}
          onRefetch={refetch}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onAdd={handleAdd}
          onSearch={() => setSearchOpen(true)}
          onOpenTemplates={() => setTemplateManagerOpen(true)}
        />
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <EntryFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingEntry(null); }}
        selectedDate={selectedDate}
        defaultType={formType}
        existingEntry={editingEntry}
      />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectDate={handleSelectDate}
        onEditEntry={handleEdit}
      />

      <TemplateManagerModal
        open={templateManagerOpen}
        onClose={() => setTemplateManagerOpen(false)}
        onSelectTemplate={(tmpl) => {
          setFormType(tmpl.template_type as any);
          setFormOpen(true);
        }}
      />

      <ReminderCountdownToast />
    </div>
  );
}
