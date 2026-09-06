import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface NotificationRule {
  id: string;
  type: string;
  is_enabled: boolean;
  days_before: number;
  target_roles: string[];
  enable_email: boolean;
  enable_sms: boolean;
  enable_in_app: boolean;
}

export interface NotificationSettingsData {
  settings: {
    notif_email_sender_name?: string;
    notif_email_reply_to?: string;
    notif_weekend?: boolean;
    notif_holiday?: boolean;
    [key: string]: any;
  } | null;
  rules: NotificationRule[];
}

export function useNotificationSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<NotificationSettingsData>({
    queryKey: ["settings", "notifications"],
    queryFn: async () => {
      const res = await fetch("/api/settings/notifications");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to load notification settings`);
      }
      return data;
    },
    staleTime: 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      notif_email_sender_name: string;
      notif_email_reply_to: string;
      notif_weekend: boolean;
      notif_holiday: boolean;
      rules: NotificationRule[];
    }) => {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update notification settings");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "notifications"] });
      toast.success("Notification preferences saved successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error saving notification settings");
    },
  });

  return {
    ...query,
    updateSettings: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
}
