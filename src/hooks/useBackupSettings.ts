import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface BackupRecord {
  id: string;
  backup_type: "manual" | "automatic";
  file_key: string;
  file_url: string;
  file_size_bytes: number;
  status: "in_progress" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  users?: {
    full_name: string;
  };
}

export interface BackupScheduleSettings {
  auto_backup_enabled?: boolean;
  backup_frequency?: string;
  backup_time?: string;
  backup_retention_days?: number;
}

export function useBackupSettings() {
  const queryClient = useQueryClient();

  const scheduleQuery = useQuery<{ settings: BackupScheduleSettings | null }>({
    queryKey: ["settings", "backup"],
    queryFn: async () => {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) throw new Error("Failed to load backup settings");
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const historyQuery = useQuery<{ history: BackupRecord[] }>({
    queryKey: ["settings", "backup-history"],
    queryFn: async () => {
      const res = await fetch("/api/settings/backup-history");
      if (!res.ok) throw new Error("Failed to load backup history");
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (payload: BackupScheduleSettings) => {
      const res = await fetch("/api/settings/backup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save backup settings");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "backup"] });
      toast.success("Backup schedule settings updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error saving backup settings");
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backup failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "backup-history"] });
      toast.success("Database backup created successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Backup execution failed");
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/backup-history/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deletion failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "backup-history"] });
      toast.success("Backup deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error deleting backup");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/backup/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(data.message || `Successfully synced ${data.syncedCount || 0} backup file(s) to secondary bucket.`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Backup replication sync failed");
    },
  });

  return {
    schedule: scheduleQuery.data?.settings,
    history: historyQuery.data?.history || [],
    isLoading: scheduleQuery.isLoading || historyQuery.isLoading,
    isError: scheduleQuery.isError || historyQuery.isError,
    error: scheduleQuery.error || historyQuery.error,
    refetch: async () => {
      await Promise.all([scheduleQuery.refetch(), historyQuery.refetch()]);
    },
    updateSchedule: updateScheduleMutation.mutateAsync,
    isSavingSchedule: updateScheduleMutation.isPending,
    createBackup: createBackupMutation.mutateAsync,
    isCreatingBackup: createBackupMutation.isPending,
    deleteBackup: deleteBackupMutation.mutateAsync,
    isDeletingBackup: deleteBackupMutation.isPending,
    syncBackups: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
  };
}
