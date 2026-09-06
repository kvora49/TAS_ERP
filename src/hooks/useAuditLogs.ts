"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface AuditLogFilters {
  fromDate?: string;
  toDate?: string;
  selectedModule?: string;
  selectedUser?: string;
  selectedAction?: string;
}

export interface AuditLogUser {
  id: string;
  full_name: string;
}

export interface AuditLogItem {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  table_name: string;
  action: string;
  record_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  users?: {
    full_name: string;
    email: string;
  };
}

export function useAuditUsers() {
  return useQuery({
    queryKey: ["settings", "audit-users"],
    queryFn: async (): Promise<AuditLogUser[]> => {
      const res = await fetch("/api/settings/users");
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || [];
    },
    staleTime: 60_000,
  });
}

export function useAuditLogs(filters: AuditLogFilters, page: number, limit: number) {
  return useQuery({
    queryKey: ["settings", "audit-logs", filters, page, limit],
    queryFn: async (): Promise<{ logs: AuditLogItem[]; count: number }> => {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (filters.fromDate) query.append("fromDate", filters.fromDate);
      if (filters.toDate) query.append("toDate", filters.toDate);
      if (filters.selectedModule && filters.selectedModule !== "All Modules") {
        query.append("module", filters.selectedModule);
      }
      if (filters.selectedUser && filters.selectedUser !== "All Users") {
        query.append("userId", filters.selectedUser);
      }
      if (filters.selectedAction && filters.selectedAction !== "All Actions") {
        query.append("action", filters.selectedAction);
      }

      const res = await fetch(`/api/settings/audit-logs?${query.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch audit logs");
      }
      const data = await res.json();
      return {
        logs: data.logs || [],
        count: data.count || 0,
      };
    },
    staleTime: 15_000,
  });
}

export function useStockIntegritySync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cron/stock-integrity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run stock integrity sync");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "audit-logs"] });
    },
  });
}
