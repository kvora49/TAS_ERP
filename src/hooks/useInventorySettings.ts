import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface GodownItem {
  id: string;
  name: string;
}

export interface InventorySettingsPayload {
  default_godown_id: string;
  low_stock_threshold: number;
  allow_negative_stock: boolean;
  enable_batch_tracking: boolean;
  enable_serial_numbers: boolean;
  stock_valuation_method: string;
}

export interface InventorySettingsData {
  settings: {
    default_godown_id?: string;
    low_stock_threshold?: number;
    allow_negative_stock?: boolean;
    enable_batch_tracking?: boolean;
    enable_serial_numbers?: boolean;
    stock_valuation_method?: string;
    [key: string]: any;
  } | null;
  godowns: GodownItem[];
}

export function useInventorySettings() {
  const queryClient = useQueryClient();

  const query = useQuery<InventorySettingsData>({
    queryKey: ["settings", "inventory"],
    queryFn: async () => {
      const res = await fetch("/api/settings/inventory");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load inventory settings");
      }
      return data;
    },
    staleTime: 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: InventorySettingsPayload) => {
      const res = await fetch("/api/settings/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update inventory settings");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "inventory"] });
      toast.success("Inventory settings updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error saving inventory settings");
    },
  });

  return {
    ...query,
    updateSettings: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
}
