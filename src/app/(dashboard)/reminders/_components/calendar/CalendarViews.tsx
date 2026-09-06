"use client";

import React from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths,
  addWeeks, subWeeks, addYears, subYears, getWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCalendarMonthSummary, DaySummary } from "@/hooks/queries/useCalendarEntries";

// ─── Dot Indicator ────────────────────────────────────────────────────────────
function DayDots({ summary }: { summary?: DaySummary }) {
  if (!summary || summary.total === 0) return null;
  const dots = [];
  if (summary.overdue > 0) dots.push(<span key="o" className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />);
  if (summary.reminders > 0) dots.push(<span key="r" className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />);
  if (summary.events > 0) dots.push(<span key="e" className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />);
  if (summary.notes > 0) dots.push(<span key="n" className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />);
  if (summary.completed > 0 && summary.overdue === 0) dots.push(<span key="c" className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />);
  return <div className="flex items-center justify-center gap-0.5 mt-0.5">{dots.slice(0, 3)}</div>;
}

// ─── Month View ────────────────────────────────────────────────────────────────
interface MonthViewProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  summary?: Record<string, DaySummary>;
}

export function MonthView({ currentDate, selectedDate, onSelectDate, summary = {} }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="select-none">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--text-faint)] py-1 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-[var(--border)]">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const daySummary = summary[dateKey];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex flex-col items-center justify-start py-1.5 bg-[var(--card-bg)] transition-colors relative cursor-pointer min-h-[52px]",
                !isCurrentMonth && "opacity-30",
                isSelected && "bg-[var(--primary)] !text-white",
                !isSelected && isTodayDate && "bg-[var(--primary-light)]",
                !isSelected && "hover:bg-[var(--table-row-hover)]",
              )}
            >
              <span className={cn(
                "text-sm leading-none font-medium",
                isSelected ? "text-white" : isTodayDate ? "text-[var(--primary)]" : "text-[var(--text-body)]",
              )}>
                {format(day, "d")}
              </span>
              {!isSelected && <DayDots summary={daySummary} />}
              {isSelected && daySummary && daySummary.total > 0 && (
                <span className="absolute bottom-0.5 right-1 text-[9px] text-white/80">{daySummary.total}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ─────────────────────────────────────────────────────────────────
interface WeekViewProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  summary?: Record<string, DaySummary>;
}

export function WeekView({ currentDate, selectedDate, onSelectDate, summary = {} }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="select-none">
      <div className="text-[10px] text-[var(--text-faint)] text-center mb-2 uppercase tracking-wider">
        Week {getWeek(currentDate, { weekStartsOn: 1 })} — {format(weekStart, "d MMM")} to {format(weekEnd, "d MMM, yyyy")}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const daySummary = summary[dateKey];
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all cursor-pointer",
                isSelected
                  ? "bg-[var(--primary)] border-[var(--primary)] shadow-md"
                  : isTodayDate
                  ? "bg-[var(--primary-light)] border-[var(--primary)] border-opacity-50"
                  : "bg-[var(--card-bg)] border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"
              )}
            >
              <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                isSelected ? "text-white/80" : "text-[var(--text-muted)]"
              )}>
                {format(day, "EEE")}
              </span>
              <span className={cn(
                "text-lg font-bold leading-none",
                isSelected ? "text-white" : isTodayDate ? "text-[var(--primary)]" : "text-[var(--text-primary)]"
              )}>
                {format(day, "d")}
              </span>
              {daySummary && daySummary.total > 0 && (
                <div className="flex flex-col items-center gap-0.5">
                  <DayDots summary={daySummary} />
                  <span className={cn(
                    "text-[9px] font-medium hidden sm:inline",
                    isSelected ? "text-white/70" : "text-[var(--text-faint)]"
                  )}>
                    {daySummary.total} item{daySummary.total !== 1 ? "s" : ""}
                  </span>
                  <span className={cn(
                    "text-[9px] font-black sm:hidden px-1 rounded-full leading-tight",
                    isSelected ? "bg-black/20 text-white" : "bg-[var(--page-bg)] text-[var(--text-muted)]"
                  )}>
                    {daySummary.total}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day View ──────────────────────────────────────────────────────────────────
interface DayViewProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function DayView({ currentDate, selectedDate, onSelectDate }: DayViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="select-none">
      <div className="text-center mb-3">
        <div className={cn(
          "inline-flex flex-col items-center px-5 py-2 rounded-xl",
          isToday(selectedDate) ? "bg-[var(--primary)] text-white" : "bg-[var(--card-bg)] border border-[var(--border)]"
        )}>
          <span className={cn("text-xs uppercase tracking-widest font-semibold",
            isToday(selectedDate) ? "text-white/80" : "text-[var(--text-muted)]"
          )}>
            {format(selectedDate, "EEEE")}
          </span>
          <span className={cn("text-3xl font-bold",
            isToday(selectedDate) ? "text-white" : "text-[var(--text-primary)]"
          )}>
            {format(selectedDate, "d")}
          </span>
          <span className={cn("text-xs font-medium",
            isToday(selectedDate) ? "text-white/80" : "text-[var(--text-muted)]"
          )}>
            {format(selectedDate, "MMMM yyyy")}
          </span>
        </div>
      </div>
      {/* Hour slots — just visual guide, entries shown in right panel */}
      <div className="space-y-px max-h-[240px] overflow-y-auto scrollbar-thin">
        {hours.map((h) => (
          <div key={h} className="flex items-center gap-2 py-1 px-1 text-[10px] text-[var(--text-faint)] hover:bg-[var(--table-row-hover)] rounded cursor-default">
            <span className="w-10 text-right shrink-0">{h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}</span>
            <div className="flex-1 h-px bg-[var(--border-light)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Year View ─────────────────────────────────────────────────────────────────
interface YearViewProps {
  currentDate: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSelectMonth?: (date: Date) => void;
}

export function YearView({ currentDate, selectedDate, onSelectDate, onSelectMonth }: YearViewProps) {
  const year = currentDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  return (
    <div className="grid grid-cols-3 gap-2 select-none">
      {months.map((monthDate) => {
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: calStart, end: monthEnd });

        return (
          <div
            key={monthDate.toISOString()}
            className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] p-2 cursor-pointer hover:border-[var(--primary)] transition-colors"
            onClick={() => onSelectMonth?.(monthDate)}
          >
            <div className="text-[10px] font-bold text-[var(--text-primary)] text-center mb-1">
              {format(monthDate, "MMM")}
            </div>
            <div className="grid grid-cols-7 gap-px">
              {["M","T","W","T","F","S","S"].map((d, i) => (
                <span key={i} className="text-center text-[7px] text-[var(--text-faint)]">{d}</span>
              ))}
              {days.slice(0, 35).map((day) => {
                const isCurrentMon = isSameMonth(day, monthDate);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={(e) => { e.stopPropagation(); onSelectDate(day); }}
                    className={cn(
                      "text-[7px] text-center rounded-sm leading-4 transition-colors",
                      !isCurrentMon && "opacity-20 pointer-events-none",
                      isSelected && "bg-[var(--primary)] text-white rounded-full",
                      !isSelected && isTodayDate && "bg-[var(--primary-light)] text-[var(--primary)] rounded-full font-bold",
                      !isSelected && isCurrentMon && !isTodayDate && "text-[var(--text-body)] hover:bg-[var(--table-row-hover)]",
                    )}
                  >
                    {isCurrentMon ? format(day, "d") : ""}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar View Header ──────────────────────────────────────────────────────
type CalendarView = "month" | "week" | "day" | "year";

interface CalendarViewHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onToday: () => void;
}

export function CalendarViewHeader({
  currentDate,
  view,
  onViewChange,
  onNavigate,
  onToday,
}: CalendarViewHeaderProps) {
  const getTitle = () => {
    if (view === "month") return format(currentDate, "MMMM yyyy");
    if (view === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (ws.getMonth() === we.getMonth()) return format(ws, "MMMM yyyy");
      return `${format(ws, "MMM")} – ${format(we, "MMM yyyy")}`;
    }
    if (view === "day") return format(currentDate, "d MMMM yyyy");
    return String(currentDate.getFullYear());
  };

  const views: { key: CalendarView; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "day", label: "Day" },
    { key: "year", label: "Year" },
  ];

  return (
    <div className="space-y-3">
      {/* Title + Nav */}
      <div className="flex items-center justify-between gap-1">
        <button
          onClick={onToday}
          className="text-xs font-bold px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--primary)] transition-colors shrink-0"
        >
          Today
        </button>
        <div className="flex items-center gap-1 flex-1 justify-center min-w-0">
          <button
            onClick={() => onNavigate("prev")}
            className="p-1 rounded-md hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] text-center truncate">
            {getTitle()}
          </span>
          <button
            onClick={() => onNavigate("next")}
            className="p-1 rounded-md hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex rounded-lg bg-[var(--page-bg)] p-0.5 gap-0.5">
        {views.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            className={cn(
              "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
              view === key
                ? "bg-[var(--card-bg)] text-[var(--primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
