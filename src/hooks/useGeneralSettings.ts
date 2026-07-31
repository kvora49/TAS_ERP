import { useQuery } from "@tanstack/react-query";
import { formatDate, formatCurrency } from "@/lib/utils";

export interface GeneralSettingsResponse {
  business: {
    id: string;
    name: string;
    currency: string;
    date_format: string;
    timezone: string;
    items_per_page: number;
    enable_gst: boolean;
    enable_batch_tracking: boolean;
    allow_negative_stock: boolean;
    low_stock_alerts: boolean;
    updated_at: string;
  } | null;
  settings: {
    enable_serial_numbers?: boolean;
    enable_kacha_billing?: boolean;
    motion_profile?: "ultraFast" | "balanced" | "premium";
    low_stock_threshold?: number;
    [key: string]: any;
  } | null;
}

export function useGeneralSettings() {
  const query = useQuery<GeneralSettingsResponse>({
    queryKey: ["settings", "general"],
    queryFn: async () => {
      const res = await fetch("/api/settings/general");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load general settings");
      }
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  const business = query.data?.business;
  const settings = query.data?.settings;

  // Formatters with fallback to settings
  const formatAppDate = (dateVal: string | Date | null | undefined) => {
    return formatDate(dateVal, business?.date_format);
  };

  const formatAppCurrency = (val: number) => {
    return formatCurrency(val, business?.currency);
  };

  return {
    ...query,
    business,
    settings,
    // System preferences & feature flags
    businessName: business?.name || "TAS ERP",
    itemsPerPage: business?.items_per_page || 10,
    dateFormat: business?.date_format || "DD MMM YYYY (31 May 2024)",
    currency: business?.currency || "INR (₹) - Indian Rupee",
    timezone: business?.timezone || "(GMT+05:30) Asia/Kolkata",
    enableGst: business?.enable_gst ?? true,
    enableBatchTracking: business?.enable_batch_tracking ?? true,
    enableKachaBilling: settings?.enable_kacha_billing ?? true,
    allowNegativeStock: business?.allow_negative_stock ?? false,
    lowStockAlerts: business?.low_stock_alerts ?? true,
    motionProfile: settings?.motion_profile || "balanced",
    // Helper formatters
    formatAppDate,
    formatAppCurrency,
  };
}
