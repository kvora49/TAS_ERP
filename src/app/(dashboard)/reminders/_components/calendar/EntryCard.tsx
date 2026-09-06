"use client";

import React, { useState, useRef } from "react";
import { format, parseISO } from "date-fns";
import {
  StickyNote, Bell, CheckSquare, BookOpen, Calendar as CalendarIcon,
  ChevronDown, Star, Building2, ShoppingCart, ShoppingBag, Factory,
  CreditCard, Package, Users, User, Wrench, Truck, MessageSquare,
  Trash2, Edit2, Pin, Copy, ExternalLink, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentManager } from "./AttachmentManager";
import type { CalendarEntry } from "@/hooks/queries/useCalendarEntries";

// ─── Type Configurations ───────────────────────────────────────────────────────
export const ENTRY_TYPE_CONFIG = {
  note: {
    icon: StickyNote,
    label: "Note",
    dotColor: "bg-purple-500",
    ringColor: "ring-purple-500/20",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-600 dark:text-purple-400",
    borderColor: "border-l-purple-500",
  },
  reminder: {
    icon: Bell,
    label: "Reminder",
    dotColor: "bg-amber-400",
    ringColor: "ring-amber-400/20",
    bgColor: "bg-amber-400/10",
    textColor: "text-amber-600 dark:text-amber-400",
    borderColor: "border-l-amber-400",
  },
  task: {
    icon: CheckSquare,
    label: "Task",
    dotColor: "bg-blue-500",
    ringColor: "ring-blue-500/20",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-600 dark:text-blue-400",
    borderColor: "border-l-blue-500",
  },
  journal: {
    icon: BookOpen,
    label: "Journal",
    dotColor: "bg-teal-500",
    ringColor: "ring-teal-500/20",
    bgColor: "bg-teal-500/10",
    textColor: "text-teal-600 dark:text-teal-400",
    borderColor: "border-l-teal-500",
  },
  event: {
    icon: CalendarIcon,
    label: "Event",
    dotColor: "bg-indigo-500",
    ringColor: "ring-indigo-500/20",
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-600 dark:text-indigo-400",
    borderColor: "border-l-indigo-500",
  },
} as const;

export const PRIORITY_CONFIG = {
  low: { label: "Low", color: "text-slate-500", dot: "bg-slate-400" },
  medium: { label: "Medium", color: "text-blue-500", dot: "bg-blue-400" },
  high: { label: "High", color: "text-amber-500", dot: "bg-amber-400" },
  urgent: { label: "Urgent", color: "text-red-500", dot: "bg-red-500" },
};

export const STATUS_CONFIG = {
  pending: { label: "Pending", bgClass: "bg-slate-100 dark:bg-slate-800", textClass: "text-slate-600 dark:text-slate-400" },
  in_progress: { label: "In Progress", bgClass: "bg-blue-100 dark:bg-blue-900/30", textClass: "text-blue-600 dark:text-blue-400" },
  completed: { label: "Completed", bgClass: "bg-green-100 dark:bg-green-900/30", textClass: "text-green-600 dark:text-green-400" },
  cancelled: { label: "Cancelled", bgClass: "bg-slate-100 dark:bg-slate-800", textClass: "text-slate-500 dark:text-slate-400" },
  overdue: { label: "Overdue", bgClass: "bg-red-100 dark:bg-red-900/30", textClass: "text-red-600 dark:text-red-400" },
};

export const CATEGORY_CONFIG: Record<string, { icon: any; label: string }> = {
  production: { icon: Factory, label: "Production" },
  purchase: { icon: ShoppingBag, label: "Purchase" },
  sales: { icon: ShoppingCart, label: "Sales" },
  accounts: { icon: CreditCard, label: "Accounts" },
  payments: { icon: CreditCard, label: "Payments" },
  stock: { icon: Package, label: "Stock" },
  hr: { icon: Users, label: "HR" },
  personal: { icon: User, label: "Personal" },
  factory: { icon: Factory, label: "Factory" },
  meeting: { icon: MessageSquare, label: "Meeting" },
  maintenance: { icon: Wrench, label: "Maintenance" },
  transport: { icon: Truck, label: "Transport" },
  general: { icon: Star, label: "General" },
};

// ─── Entry Card Component ──────────────────────────────────────────────────────
interface EntryCardProps {
  entry: CalendarEntry;
  onEdit?: (entry: CalendarEntry) => void;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  compact?: boolean;
}

export function EntryCard({ entry, onEdit, onDelete, onStatusChange, compact = false }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const typeConfig = ENTRY_TYPE_CONFIG[entry.entry_type];
  const TypeIcon = typeConfig.icon;
  const priorityCfg = PRIORITY_CONFIG[entry.priority];
  const statusCfg = STATUS_CONFIG[entry.status];
  const isCompleted = entry.status === "completed";
  const isOverdue = entry.status === "overdue";

  const tasksTotal = entry.tasks?.length || 0;
  const tasksCompleted = entry.tasks?.filter((t) => t.is_completed).length || 0;

  const timeStr = entry.entry_time
    ? format(parseISO(`${entry.entry_date}T${entry.entry_time}`), "h:mm a")
    : entry.is_all_day ? "All day" : "";

  return (
    <div
      className={cn(
        "relative rounded-xl border-l-4 border border-[var(--border)] bg-[var(--card-bg)] transition-all duration-200",
        "hover:shadow-[var(--shadow-md)] hover:-translate-y-px",
        typeConfig.borderColor,
        isCompleted && "opacity-70",
        isOverdue && "ring-1 ring-red-500/30",
        compact ? "px-3 py-2" : "px-4 py-3"
      )}
    >
      {/* Pin indicator */}
      {entry.is_pinned && (
        <Pin className="absolute top-2 right-2 h-3 w-3 text-[var(--primary)] fill-current" />
      )}

      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={cn("shrink-0 p-1.5 rounded-lg mt-0.5", typeConfig.bgColor)}>
          <TypeIcon className={cn("h-3.5 w-3.5", typeConfig.textColor)} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4
                className={cn(
                  "text-sm font-semibold text-[var(--text-primary)] leading-snug truncate",
                  isCompleted && "line-through text-[var(--text-muted)]"
                )}
              >
                {entry.title}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {timeStr && (
                  <span className="text-[11px] text-[var(--text-muted)]">{timeStr}</span>
                )}
                {/* Priority dot */}
                <span className="flex items-center gap-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityCfg.dot)} />
                  <span className={cn("text-[10px] font-medium", priorityCfg.color)}>{priorityCfg.label}</span>
                </span>
                {/* Status badge */}
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", statusCfg.bgClass, statusCfg.textClass)}>
                  {statusCfg.label}
                </span>
                {/* ERP badge */}
                {entry.erp_entity_label && (
                  <span className="flex items-center gap-1 text-[10px] bg-[var(--primary-light)] text-[var(--primary)] px-1.5 py-0.5 rounded-full font-medium">
                    <Building2 className="h-2.5 w-2.5" />
                    {entry.erp_entity_label}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Expand */}
              {(entry.content || tasksTotal > 0 || entry.tags.length > 0 || (entry.attachments && entry.attachments.length > 0)) && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-1 rounded-md hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] transition-colors"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
                </button>
              )}
              {/* Edit */}
              {onEdit && (
                <button
                  onClick={() => onEdit(entry)}
                  className="p-1 rounded-md hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              )}
              {/* Delete */}
              {onDelete && (
                <button
                  onClick={() => onDelete(entry.id)}
                  className="p-1 rounded-md hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Task progress bar */}
          {entry.entry_type === "task" && tasksTotal > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
                <span>{tasksCompleted}/{tasksTotal} completed</span>
                <span>{Math.round((tasksCompleted / tasksTotal) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                  style={{ width: `${(tasksCompleted / tasksTotal) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Expanded content */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {/* Rich text content */}
              {entry.content && (
                <div
                  className={cn(
                    "text-xs text-[var(--text-body)] leading-relaxed prose prose-sm max-w-none",
                    "[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4",
                    "[&_a]:text-[var(--primary)] [&_a]:underline",
                    "[&_strong]:text-[var(--text-primary)]",
                    "[&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-1.5",
                  )}
                  dangerouslySetInnerHTML={{ __html: entry.content }}
                />
              )}

              {/* Checklist tasks */}
              {entry.tasks && entry.tasks.length > 0 && (
                <div className="space-y-1">
                  {entry.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                        task.is_completed
                          ? "bg-green-500 border-green-500"
                          : "border-[var(--input-border)] bg-[var(--input-bg)]"
                      )}>
                        {task.is_completed && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10">
                            <path d="M1.5 5L4 7.5L8.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                          </svg>
                        )}
                      </div>
                      <span className={cn(
                        "text-xs",
                        task.is_completed ? "line-through text-[var(--text-faint)]" : "text-[var(--text-body)]"
                      )}>
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)]">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Attachments */}
              {entry.attachments && entry.attachments.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] block mb-1">Attachments:</span>
                  <AttachmentManager attachments={entry.attachments} readOnly />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Entry Type Selector ───────────────────────────────────────────────────────
interface EntryTypeSelectorProps {
  selected: CalendarEntry["entry_type"];
  onChange: (type: CalendarEntry["entry_type"]) => void;
}

export function EntryTypeSelector({ selected, onChange }: EntryTypeSelectorProps) {
  const types: CalendarEntry["entry_type"][] = ["note", "reminder", "task", "journal", "event"];

  return (
    <div className="flex rounded-xl bg-[var(--page-bg)] p-1 gap-0.5">
      {types.map((type) => {
        const cfg = ENTRY_TYPE_CONFIG[type];
        const Icon = cfg.icon;
        const isSelected = selected === type;

        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg transition-all text-xs font-medium",
              isSelected
                ? cn("bg-[var(--card-bg)] shadow-[var(--shadow-sm)]", cfg.textColor)
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:block">{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
