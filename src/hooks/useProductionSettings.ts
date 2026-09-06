import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface ProductionStageItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

export interface ProductionGodownItem {
  id: string;
  name: string;
}

export interface ProductionTemplateItem {
  id: string;
  name: string;
  is_default?: boolean;
  stages?: ProductionStageItem[];
}

export interface ProductionSettingsData {
  settings: {
    job_work_default_bill_type?: string;
    auto_complete_lot?: boolean;
    allow_back_date_production?: boolean;
    lock_completed_lots?: boolean;
    default_work_center_id?: string;
    default_template_id?: string;
    [key: string]: any;
  } | null;
  templates: ProductionTemplateItem[];
  defaultTemplate?: ProductionTemplateItem | null;
  stages: ProductionStageItem[];
  godowns: ProductionGodownItem[];
}

export interface ProductionSettingsPayload {
  job_work_default_bill_type: string;
  auto_complete_lot: boolean;
  allow_back_date_production: boolean;
  lock_completed_lots: boolean;
  default_work_center_id: string;
  default_template_id: string | null;
  stages: Array<{ id: string; sort_order: number }>;
}

export function useProductionSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<ProductionSettingsData>({
    queryKey: ["settings", "production"],
    queryFn: async () => {
      const res = await fetch("/api/settings/production");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load production settings");
      }
      return data;
    },
    staleTime: 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: ProductionSettingsPayload) => {
      const res = await fetch("/api/settings/production", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update production settings");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "production"] });
      toast.success("Production settings saved successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error saving production settings");
    },
  });

  return {
    ...query,
    updateSettings: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
}
