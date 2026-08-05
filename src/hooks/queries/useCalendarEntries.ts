import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface CalendarTask {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
  parent_task_id: string | null;
  completed_at?: string;
}

export interface CalendarReminder {
  id: string;
  remind_at: string;
  notify_before_minutes: number;
  repeat_type: string;
  is_fired: boolean;
  is_acknowledged: boolean;
}

export interface CalendarAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  public_url?: string;
  storage_path: string;
  created_at: string;
}

export interface CalendarEntry {
  id: string;
  business_id: string;
  entry_type: "note" | "reminder" | "task" | "journal" | "event";
  title: string;
  content?: string;
  entry_date: string;
  entry_time?: string;
  end_date?: string;
  end_time?: string;
  is_all_day: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled" | "overdue";
  category: string;
  color_code?: string;
  tags: string[];
  is_pinned: boolean;
  erp_module?: string;
  erp_entity_id?: string;
  erp_entity_type?: string;
  erp_entity_label?: string;
  person_responsible?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  tasks?: CalendarTask[];
  reminders?: CalendarReminder[];
  attachments?: CalendarAttachment[];
  responsible_user?: any;
  creator?: any;
  updater?: any;
}

export interface DaySummary {
  notes: number;
  reminders: number;
  tasks: number;
  events: number;
  journals: number;
  completed: number;
  overdue: number;
  pending: number;
  total: number;
}

export interface MonthSummary {
  [date: string]: DaySummary;
}

export interface CalendarTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: "note" | "task" | "reminder" | "event";
  content?: string;
  task_items: { title: string; sort_order: number }[];
  category: string;
  priority: string;
  is_system: boolean;
  color_code?: string;
}

// ─── Query Keys ────────────────────────────────────────────────────────────────
export const calendarKeys = {
  all: ["calendar"] as const,
  entries: (filters: Record<string, any>) => ["calendar", "entries", filters] as const,
  entry: (id: string) => ["calendar", "entry", id] as const,
  monthSummary: (year: number, month: number) => ["calendar", "month-summary", year, month] as const,
  search: (params: Record<string, any>) => ["calendar", "search", params] as const,
  templates: (type?: string) => ["calendar", "templates", type] as const,
};

// ─── Entries List Hook ─────────────────────────────────────────────────────────
export function useCalendarEntries(filters: {
  date?: string;
  date_from?: string;
  date_to?: string;
  type?: string;
  category?: string;
  priority?: string;
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: calendarKeys.entries(filters),
    queryFn: async (): Promise<{ data: CalendarEntry[]; meta: { total: number } }> => {
      const params = new URLSearchParams();
      if (filters.date) params.set("date", filters.date);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);
      if (filters.type && filters.type !== "all") params.set("type", filters.type);
      if (filters.category && filters.category !== "all") params.set("category", filters.category);
      if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority);
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      if (filters.limit) params.set("limit", String(filters.limit));

      const res = await fetch(`/api/calendar/entries?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load calendar entries");
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!(filters.date || filters.date_from),
  });
}

// ─── Single Entry Hook ─────────────────────────────────────────────────────────
export function useCalendarEntry(id: string | null) {
  return useQuery({
    queryKey: calendarKeys.entry(id!),
    queryFn: async (): Promise<{ data: CalendarEntry }> => {
      const res = await fetch(`/api/calendar/entries/${id}`);
      if (!res.ok) throw new Error("Failed to load entry");
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!id,
  });
}

// ─── Month Summary Hook ────────────────────────────────────────────────────────
export function useCalendarMonthSummary(year: number, month: number) {
  return useQuery({
    queryKey: calendarKeys.monthSummary(year, month),
    queryFn: async (): Promise<{ summary: MonthSummary; year: number; month: number }> => {
      const res = await fetch(`/api/calendar/month-summary?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to load month summary");
      return res.json();
    },
    staleTime: 60_000,
    enabled: !!year && !!month,
  });
}

// ─── Search Hook ───────────────────────────────────────────────────────────────
export function useCalendarSearch(params: {
  q?: string;
  type?: string;
  category?: string;
  priority?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  tag?: string;
}) {
  const hasSearch = !!(params.q || params.type || params.category || params.priority ||
    params.status || params.date_from || params.date_to || params.tag);

  return useQuery({
    queryKey: calendarKeys.search(params),
    queryFn: async (): Promise<{ data: CalendarEntry[]; grouped: Record<string, CalendarEntry[]>; meta: { total: number } }> => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set("q", params.q);
      if (params.type) searchParams.set("type", params.type);
      if (params.category) searchParams.set("category", params.category);
      if (params.priority) searchParams.set("priority", params.priority);
      if (params.status) searchParams.set("status", params.status);
      if (params.date_from) searchParams.set("date_from", params.date_from);
      if (params.date_to) searchParams.set("date_to", params.date_to);
      if (params.tag) searchParams.set("tag", params.tag);

      const res = await fetch(`/api/calendar/search?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    staleTime: 15_000,
    enabled: hasSearch,
  });
}

// ─── Templates Hook ────────────────────────────────────────────────────────────
export function useCalendarTemplates(type?: string) {
  return useQuery({
    queryKey: calendarKeys.templates(type),
    queryFn: async (): Promise<{ data: CalendarTemplate[] }> => {
      const url = type ? `/api/calendar/templates?type=${type}` : "/api/calendar/templates";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    staleTime: 120_000, // templates change rarely
  });
}

// ─── Create Entry Mutation ─────────────────────────────────────────────────────
export function useCreateCalendarEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<CalendarEntry> & {
      task_items?: { title: string; sort_order: number }[];
      reminder_notify_before_minutes?: number;
      reminder_repeat_type?: string;
      reminder_repeat_interval?: number;
      template_id?: string;
    }) => {
      const res = await fetch("/api/calendar/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create entry");
      return json.data as CalendarEntry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

// ─── Update Entry Mutation ─────────────────────────────────────────────────────
export function useUpdateCalendarEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CalendarEntry> & { id: string }) => {
      const res = await fetch(`/api/calendar/entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update entry");
      return json.data as CalendarEntry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.entry(entry.id) });
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

// ─── Delete Entry Mutation ─────────────────────────────────────────────────────
export function useDeleteCalendarEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/calendar/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

// ─── Toggle Task Mutation ──────────────────────────────────────────────────────
export function useToggleCalendarTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, isCompleted, entryId }: { taskId: string; isCompleted: boolean; entryId: string }) => {
      const res = await fetch("/api/calendar/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_complete", task_id: taskId, is_completed: isCompleted }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to toggle task");
      return json.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.entry(vars.entryId) });
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}

// ─── Add Task Item Mutation ────────────────────────────────────────────────────
export function useAddCalendarTaskItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, title }: { entryId: string; title: string }) => {
      const res = await fetch("/api/calendar/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_item", entry_id: entryId, title }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add task item");
      return json.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.entry(vars.entryId) });
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
    },
  });
}
