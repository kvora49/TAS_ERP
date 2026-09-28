import { SupabaseClient } from "@supabase/supabase-js";
import { GSTEInvoiceConfig } from "./types";

/**
 * Default Regulatory Thresholds as per GSTN Mandates
 */
export const DEFAULT_EINVOICE_CONFIG: GSTEInvoiceConfig = {
  aato_mandatory_threshold: 50_000_000, // ₹5 Crore
  aato_30day_window_threshold: 100_000_000, // ₹10 Crore
  reporting_window_days: 30, // 30 Days
  eway_threshold: 50_000, // ₹50,000 Consignment value
  hsn_min_digits_low_aato: 4, // 4-digit HSN for <= 5Cr
  hsn_min_digits_high_aato: 6, // 6-digit HSN for > 5Cr
  max_invoice_line_items: 1000,
  rounding_tolerance: 1.0, // ₹1.00 allowed roundoff diff
};

let cachedConfig: GSTEInvoiceConfig | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Fetches dynamic GST e-invoice configuration from DB or returns defaults
 */
export async function getGSTEInvoiceConfig(supabase?: SupabaseClient | null): Promise<GSTEInvoiceConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  if (!supabase) {
    return DEFAULT_EINVOICE_CONFIG;
  }

  try {
    const { data, error } = await supabase
      .from("gst_einvoice_config")
      .select("key, value");

    if (error || !data || data.length === 0) {
      return DEFAULT_EINVOICE_CONFIG;
    }

    const config: GSTEInvoiceConfig = { ...DEFAULT_EINVOICE_CONFIG };

    for (const row of data) {
      const val = row.value;
      if (!val) continue;

      switch (row.key) {
        case "aato_mandatory_threshold":
          if (typeof val.amount === "number") config.aato_mandatory_threshold = val.amount;
          break;
        case "aato_30day_window_threshold":
          if (typeof val.amount === "number") config.aato_30day_window_threshold = val.amount;
          break;
        case "reporting_window_days":
          if (typeof val.days === "number") config.reporting_window_days = val.days;
          break;
        case "eway_threshold":
          if (typeof val.amount === "number") config.eway_threshold = val.amount;
          break;
        case "hsn_min_digits_low_aato":
          if (typeof val.digits === "number") config.hsn_min_digits_low_aato = val.digits;
          break;
        case "hsn_min_digits_high_aato":
          if (typeof val.digits === "number") config.hsn_min_digits_high_aato = val.digits;
          break;
        case "max_invoice_line_items":
          if (typeof val.limit === "number") config.max_invoice_line_items = val.limit;
          break;
        case "rounding_tolerance":
          if (typeof val.amount === "number") config.rounding_tolerance = val.amount;
          break;
      }
    }

    cachedConfig = config;
    lastCacheTime = now;
    return config;
  } catch (err) {
    console.error("Failed to load GST e-invoice config, falling back to defaults:", err);
    return DEFAULT_EINVOICE_CONFIG;
  }
}
