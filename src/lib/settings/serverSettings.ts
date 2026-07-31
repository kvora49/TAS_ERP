import { SupabaseClient } from "@supabase/supabase-js";

export interface BusinessServerSettings {
  business_id: string;
  enable_gst: boolean;
  enable_batch_tracking: boolean;
  allow_negative_stock: boolean;
  low_stock_alerts: boolean;
  enable_kacha_billing: boolean;
  enable_serial_numbers: boolean;
  currency: string;
  date_format: string;
}

/**
 * Fetches server-side business settings for permission/rule checks.
 */
export async function getBusinessServerSettings(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessServerSettings> {
  const [busRes, setRes] = await Promise.all([
    supabase
      .from("businesses")
      .select("enable_gst, enable_batch_tracking, allow_negative_stock, low_stock_alerts, currency, date_format")
      .eq("id", businessId)
      .single(),
    supabase
      .from("business_settings")
      .select("job_work_default_bill_type, enable_serial_numbers")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const bus: any = busRes.data || {};
  const set: any = setRes.data || {};

  const enableKachaBilling = set.job_work_default_bill_type !== "kacha_disabled";

  return {
    business_id: businessId,
    enable_gst: bus.enable_gst ?? true,
    enable_batch_tracking: bus.enable_batch_tracking ?? true,
    allow_negative_stock: bus.allow_negative_stock ?? false,
    low_stock_alerts: bus.low_stock_alerts ?? true,
    enable_kacha_billing: enableKachaBilling,
    enable_serial_numbers: set.enable_serial_numbers ?? false,
    currency: bus.currency || "INR (₹) - Indian Rupee",
    date_format: bus.date_format || "DD MMM YYYY (31 May 2024)",
  };
}
