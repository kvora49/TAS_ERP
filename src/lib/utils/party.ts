import { QueryClient } from "@tanstack/react-query";
import { getPartyPhone } from "./whatsapp";

export { getPartyPhone };

/**
 * Invalidates all TanStack Query caches linked to party information across all ERP modules
 * (Parties, Reminders, Sales Bills, Purchases, Payments, Cheques, Party Details).
 */
export function invalidatePartyRelatedQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["master-data", "parties"] });
  queryClient.invalidateQueries({ queryKey: ["parties"] });
  queryClient.invalidateQueries({ queryKey: ["reminders"] });
  queryClient.invalidateQueries({ queryKey: ["sale_bills"] });
  queryClient.invalidateQueries({ queryKey: ["sales-bills"] });
  queryClient.invalidateQueries({ queryKey: ["purchases"] });
  queryClient.invalidateQueries({ queryKey: ["payments"] });
  queryClient.invalidateQueries({ queryKey: ["cheques"] });
  queryClient.invalidateQueries({ queryKey: ["party-detail"] });
  queryClient.invalidateQueries({ queryKey: ["communication-parties"] });
}
