import { SupabaseClient } from "@supabase/supabase-js";

export interface BusinessServerSettings {
  business_id: string;
  enable_gst: boolean;
  enable_batch_tracking: boolean;
  allow_negative_stock: boolean;
  low_stock_alerts: boolean;
  low_stock_threshold: number;
  stock_valuation_method: string;
  default_godown_id: string | null;
  default_work_center_id: string | null;
  enable_kacha_billing: boolean;
  enable_serial_numbers: boolean;
  job_work_default_bill_type: string;
  auto_complete_lot: boolean;
  allow_back_date_production: boolean;
  lock_completed_lots: boolean;
  auto_backup_enabled: boolean;
  backup_frequency: string;
  backup_time: string;
  backup_retention_days: number;
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
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const bus: any = busRes.data || {};
  const set: any = setRes.data || {};

  const enableKachaBilling = set.job_work_default_bill_type !== "kacha_disabled";

  return {
    business_id: businessId,
    enable_gst: bus.enable_gst ?? true,
    enable_batch_tracking: set.enable_batch_tracking ?? bus.enable_batch_tracking ?? true,
    allow_negative_stock: set.allow_negative_stock ?? bus.allow_negative_stock ?? false,
    low_stock_alerts: bus.low_stock_alerts ?? true,
    low_stock_threshold: Number(set.low_stock_threshold || 10),
    stock_valuation_method: set.stock_valuation_method || "fifo",
    default_godown_id: set.default_godown_id || null,
    default_work_center_id: set.default_work_center_id || null,
    enable_kacha_billing: enableKachaBilling,
    enable_serial_numbers: set.enable_serial_numbers ?? false,
    job_work_default_bill_type: set.job_work_default_bill_type || "Job Work In",
    auto_complete_lot: set.auto_complete_lot ?? true,
    allow_back_date_production: set.allow_back_date_production ?? false,
    lock_completed_lots: set.lock_completed_lots ?? true,
    auto_backup_enabled: set.auto_backup_enabled ?? true,
    backup_frequency: set.backup_frequency || "daily",
    backup_time: set.backup_time || "23:45",
    backup_retention_days: Number(set.backup_retention_days || 30),
    currency: bus.currency || "INR (₹) - Indian Rupee",
    date_format: bus.date_format || "DD MMM YYYY (31 May 2024)",
  };
}

