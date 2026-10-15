"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import type { DeliveryDocument, DeliveryChallanInput } from "@/lib/delivery-challan";
import { readApiJson } from "@/lib/user-friendly-error";

export interface DeliveryChallanResponse { document: DeliveryDocument; sourceUpdatedAt: string | null; saved: boolean; cancelled: boolean; canCreate: boolean; canExport: boolean }
export function useDeliveryChallan(id: string) {
  const company = useAppStore(state => state.selectedBusinessId || state.user?.businessId);
  const user = useAppStore(state => state.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ["delivery-challan", company, user, id];
  const endpoint = `/api/sales/bills/${encodeURIComponent(id)}/delivery-challan`;
  const query = useQuery<DeliveryChallanResponse>({ queryKey, enabled: !!id && !!company, staleTime: 30_000, queryFn: async () => {
    const response = await fetch(endpoint);
    return readApiJson<DeliveryChallanResponse>(response, "Unable to load delivery challan.");
  } });
  const create = useMutation({ mutationFn: async (input: DeliveryChallanInput) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return readApiJson<DeliveryChallanResponse>(response, "Unable to create delivery challan.");
  }, onSuccess: async (result) => {
    queryClient.setQueryData(queryKey, (previous: DeliveryChallanResponse | undefined) => previous ? { ...previous, ...result } : previous);
    await queryClient.invalidateQueries({ queryKey });
  } });
  return { ...query, create };
}
