"use client";

import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Search, X, Loader2, Calendar, StickyNote, Bell, CheckSquare, BookOpen, Building2, Filter } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { useCalendarSearch, type CalendarEntry } from "@/hooks/queries/useCalendarEntries";
import { ENTRY_TYPE_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG } from "./EntryCard";
import { cn } from "@/lib/utils";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  onEditEntry: (entry: CalendarEntry) => void;
}

export function SearchModal({ open, onClose, onSelectDate, onEditEntry }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, isFetching } = useCalendarSearch({
    q: debouncedQuery,
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const results = data?.data || [];

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Search Activities"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, tasks, events, reminders..."
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors",
              showFilters
                ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]"
            )}
          >
            <Filter className="h-3 w-3" />
            Filters
          </button>

          {/* Type quick filters */}
          {["note", "reminder", "task", "event", "journal"].map((t) => {
            const cfg = ENTRY_TYPE_CONFIG[t as keyof typeof ENTRY_TYPE_CONFIG];
            const Icon = cfg.icon;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors capitalize",
                  typeFilter === t
                    ? cn("border-[var(--primary)] bg-[var(--primary-light)]", cfg.textColor)
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]"
                )}
              >
                <Icon className="h-3 w-3" />
                {t}
              </button>
            );
          })}
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[var(--page-bg)] border border-[var(--border)]">
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-8 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs px-2 focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] transition-colors"
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-8 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs px-2 focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-8 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-xs px-2 focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] transition-colors"
              />
            </div>
          </div>
        )}

        {/* Results */}
        <div className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-2">
          {(isLoading || isFetching) && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            </div>
          )}

          {!isLoading && !isFetching && query.length === 0 && !typeFilter && !statusFilter && !dateFrom && !dateTo && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="h-10 w-10 text-[var(--text-faint)] mb-3" />
              <p className="text-sm text-[var(--text-muted)]">Start typing to search your activities</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Searches titles, content, and task items</p>
            </div>
          )}

          {!isLoading && !isFetching && results.length === 0 && (query || typeFilter || statusFilter) && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-[var(--text-muted)]">No results found</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">Try different keywords or remove filters</p>
            </div>
          )}

          {!isLoading && results.map((entry) => {
            const typeConfig = ENTRY_TYPE_CONFIG[entry.entry_type];
            const TypeIcon = typeConfig.icon;
            const statusCfg = STATUS_CONFIG[entry.status];

            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--primary)] cursor-pointer transition-colors group"
                onClick={() => {
                  onSelectDate(parseISO(entry.entry_date));
                  onClose();
                }}
              >
                <div className={cn("shrink-0 p-1.5 rounded-lg mt-0.5", typeConfig.bgColor)}>
                  <TypeIcon className={cn("h-3.5 w-3.5", typeConfig.textColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{entry.title}</h4>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditEntry(entry); onClose(); }}
                      className="text-[10px] text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(entry.entry_date), "d MMM yyyy")}
                    </span>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", statusCfg.bgClass, statusCfg.textClass)}>
                      {statusCfg.label}
                    </span>
                    {entry.erp_entity_label && (
                      <span className="text-[10px] bg-[var(--primary-light)] text-[var(--primary)] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Building2 className="h-2.5 w-2.5" />
                        {entry.erp_entity_label}
                      </span>
                    )}
                  </div>
                  {entry.content && (
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-1"
                      dangerouslySetInnerHTML={{
                        __html: entry.content.replace(/<[^>]+>/g, " ").substring(0, 100)
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {data?.meta && data.meta.total > 0 && (
          <p className="text-xs text-[var(--text-faint)] text-right">
            {data.meta.total} result{data.meta.total !== 1 ? "s" : ""} found
          </p>
        )}
      </div>
    </Modal>
  );
}
