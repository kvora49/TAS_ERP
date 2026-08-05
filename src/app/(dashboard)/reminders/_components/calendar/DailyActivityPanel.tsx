"use client";

import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Plus, Filter, Search, StickyNote, Bell, CheckSquare,
  BookOpen, Calendar, LayoutList, AlertTriangle, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EntryCard, ENTRY_TYPE_CONFIG, STATUS_CONFIG } from "./EntryCard";
import type { CalendarEntry } from "@/hooks/queries/useCalendarEntries";

// ─── Day Summary Bar ──────────────────────────────────────────────────────────
interface DaySummaryBarProps {
  entries: CalendarEntry[];
}

function DaySummaryBar({ entries }: DaySummaryBarProps) {
  const counts = {
    note: entries.filter((e) => e.entry_type === "note").length,
    reminder: entries.filter((e) => e.entry_type === "reminder").length,
    task: entries.filter((e) => e.entry_type === "task").length,
    journal: entries.filter((e) => e.entry_type === "journal").length,
    event: entries.filter((e) => e.entry_type === "event").length,
    overdue: entries.filter((e) => e.status === "overdue").length,
    completed: entries.filter((e) => e.status === "completed").length,
  };

  const items = [
    { key: "note", icon: StickyNote, count: counts.note, color: "text-purple-500" },
    { key: "reminder", icon: Bell, count: counts.reminder, color: "text-amber-500" },
    { key: "task", icon: CheckSquare, count: counts.task, color: "text-blue-500" },
    { key: "journal", icon: BookOpen, count: counts.journal, color: "text-teal-500" },
    { key: "event", icon: Calendar, count: counts.event, color: "text-indigo-500" },
  ].filter((i) => i.count > 0);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map(({ key, icon: Icon, count, color }) => (
        <div key={key} className="flex items-center gap-1.5 text-xs">
          <Icon className={cn("h-3.5 w-3.5", color)} />
          <span className="font-semibold text-[var(--text-primary)]">{count}</span>
          <span className="text-[var(--text-muted)] capitalize">{key}{count !== 1 ? "s" : ""}</span>
        </div>
      ))}
      {counts.overdue > 0 && (
        <div className="flex items-center gap-1.5 text-xs ml-auto">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          <span className="font-semibold text-red-500">{counts.overdue} overdue</span>
        </div>
      )}
    </div>
  );
}

// ─── Entry Group (by type) ────────────────────────────────────────────────────
interface EntryGroupProps {
  label: string;
  icon: any;
  iconColor: string;
  entries: CalendarEntry[];
  onEdit: (entry: CalendarEntry) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  defaultOpen?: boolean;
}

function EntryGroup({ label, icon: Icon, iconColor, entries, onEdit, onDelete, onStatusChange, defaultOpen = true }: EntryGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex-1">
          {label}
        </span>
        <span className="text-xs text-[var(--text-muted)] bg-[var(--page-bg)] px-2 py-0.5 rounded-full">
          {entries.length}
        </span>
      </button>
      {open && (
        <div className="space-y-2 pl-0">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Daily Activity Panel ─────────────────────────────────────────────────────
interface DailyActivityPanelProps {
  selectedDate: Date;
  entries: CalendarEntry[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onEdit: (entry: CalendarEntry) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onAdd: (defaultType?: string) => void;
  onSearch: () => void;
  onOpenTemplates?: () => void;
}

export function DailyActivityPanel({
  selectedDate,
  entries,
  isLoading,
  isError,
  onRefetch,
  onEdit,
  onDelete,
  onStatusChange,
  onAdd,
  onSearch,
  onOpenTemplates,
}: DailyActivityPanelProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"time" | "priority" | "type">("time");

  const today = new Date();
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  const dateStr = format(selectedDate, "EEEE, d MMMM yyyy");

  // Filter entries
  const filteredEntries = entries.filter((e) => filterType === "all" || e.entry_type === filterType);

  // Sort
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === "time") {
      const aTime = a.entry_time || "23:59";
      const bTime = b.entry_time || "23:59";
      return aTime.localeCompare(bTime);
    }
    if (sortBy === "priority") {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] || 2) - (order[b.priority] || 2);
    }
    return a.entry_type.localeCompare(b.entry_type);
  });

  // Group by type
  const grouped = {
    event: sortedEntries.filter((e) => e.entry_type === "event"),
    reminder: sortedEntries.filter((e) => e.entry_type === "reminder"),
    task: sortedEntries.filter((e) => e.entry_type === "task"),
    note: sortedEntries.filter((e) => e.entry_type === "note"),
    journal: sortedEntries.filter((e) => e.entry_type === "journal"),
  };

  const typeFilters = [
    { key: "all", label: "All" },
    { key: "event", label: "Events" },
    { key: "reminder", label: "Reminders" },
    { key: "task", label: "Tasks" },
    { key: "note", label: "Notes" },
    { key: "journal", label: "Journal" },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--card-bg)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {dateStr}
              {isToday && (
                <span className="ml-2 text-xs bg-[var(--primary)] text-white px-2 py-0.5 rounded-full font-semibold">
                  Today
                </span>
              )}
            </h2>
            {!isLoading && entries.length > 0 && (
              <DaySummaryBar entries={entries} />
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenTemplates && (
              <button
                onClick={onOpenTemplates}
                className="p-2 rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors flex items-center gap-1 text-xs font-semibold"
                title="Activity Templates"
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="hidden sm:inline">Templates</span>
              </button>
            )}
            <button
              onClick={onSearch}
              className="p-2 rounded-lg hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => onAdd()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--primary-dark)] transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>

        {/* Quick add buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { type: "note", icon: StickyNote, label: "Note" },
            { type: "reminder", icon: Bell, label: "Reminder" },
            { type: "task", icon: CheckSquare, label: "Task" },
            { type: "event", icon: Calendar, label: "Event" },
            { type: "journal", icon: BookOpen, label: "Journal" },
          ].map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => onAdd(type)}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
            >
              <Icon className="h-3 w-3" />
              + {label}
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-px">
          {typeFilters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={cn(
                "shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors",
                filterType === key
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
              )}
            >
              {label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-[var(--text-faint)]">Sort:</span>
            {["time", "priority", "type"].map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s as any)}
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded capitalize",
                  sortBy === s ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              <span className="text-sm text-[var(--text-muted)]">Loading activities...</span>
            </div>
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Failed to load activities</p>
            <button
              onClick={onRefetch}
              className="mt-3 text-xs text-[var(--primary)] underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && sortedEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary-light)] flex items-center justify-center mb-4">
              <LayoutList className="h-8 w-8 text-[var(--primary)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {filterType === "all" ? "Nothing scheduled" : `No ${filterType}s`} for this day
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[180px]">
              Click <strong>+ Add</strong> to create your first activity for {format(selectedDate, "d MMM")}.
            </p>
            <button
              onClick={() => onAdd()}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-semibold hover:bg-[var(--primary-dark)] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Activity
            </button>
          </div>
        )}

        {!isLoading && !isError && filterType === "all" ? (
          <div className="space-y-5">
            <EntryGroup
              label="Events & Meetings"
              icon={Calendar}
              iconColor="text-indigo-500"
              entries={grouped.event}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
            <EntryGroup
              label="Reminders"
              icon={Bell}
              iconColor="text-amber-500"
              entries={grouped.reminder}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
            <EntryGroup
              label="Tasks"
              icon={CheckSquare}
              iconColor="text-blue-500"
              entries={grouped.task}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
            <EntryGroup
              label="Notes"
              icon={StickyNote}
              iconColor="text-purple-500"
              entries={grouped.note}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
            <EntryGroup
              label="Journal"
              icon={BookOpen}
              iconColor="text-teal-500"
              entries={grouped.journal}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          </div>
        ) : (
          !isLoading && !isError && sortedEntries.length > 0 && (
            <div className="space-y-2">
              {sortedEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
