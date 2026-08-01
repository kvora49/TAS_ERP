"use client";

import React from "react";
import { Clock, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DueDateBadgeProps {
  dueDate?: string | null;
  isCompleted?: boolean;
  type?: "bill" | "purchase" | "order" | "job_work";
  className?: string;
}

export function DueDateBadge({
  dueDate,
  isCompleted = false,
  type = "bill",
  className = "",
}: DueDateBadgeProps) {
  if (isCompleted) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
          className
        )}
      >
        <CheckCircle2 size={11} className="text-emerald-600" />
        <span>{type === "order" ? "Fulfilled" : type === "job_work" ? "Received" : "Paid"}</span>
      </span>
    );
  }

  if (!dueDate) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
          className
        )}
      >
        <span>No Due Date</span>
      </span>
    );
  }

  // Parse YYYY-MM-DD or ISO string safely
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (isNaN(due.getTime())) {
    return null;
  }

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-sm animate-pulse",
          className
        )}
        title={`Overdue by ${overdueDays} day(s)`}
      >
        <AlertTriangle size={11} className="text-rose-600 dark:text-rose-400" />
        <span>Overdue by {overdueDays}d</span>
      </span>
    );
  }

  if (diffDays === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm",
          className
        )}
      >
        <Clock size={11} className="text-amber-600 dark:text-amber-400" />
        <span>Due Today</span>
      </span>
    );
  }

  // Future due date
  const labelPrefix =
    type === "order"
      ? "Delivery in"
      : type === "job_work"
      ? "Return in"
      : "Due in";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
        className
      )}
    >
      <Calendar size={11} className="text-indigo-600 dark:text-indigo-400" />
      <span>
        {labelPrefix} {diffDays}d
      </span>
    </span>
  );
}
