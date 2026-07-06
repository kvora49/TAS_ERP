export interface GstRate {
  id?: string;
  hsn_code: string;
  description?: string | null;
  gst_percent: number;
  auto_tier: boolean;
  tier_threshold: number | null;
  tier_low_gst: number | null;
  tier_high_gst: number | null;
  is_active?: boolean;
}

/**
 * Calculates the applicable GST percentage based on the rate per piece
 * and whether auto-tier (e.g. rate <= 1000 => 5%, rate > 1000 => 12%) is enabled.
 */
export function calculateGST(ratePerPiece: number, gstRate: GstRate): number {
  if (!gstRate.auto_tier) return gstRate.gst_percent;
  
  const threshold = gstRate.tier_threshold ?? 1000;
  const lowGst = gstRate.tier_low_gst ?? 5;
  const highGst = gstRate.tier_high_gst ?? 12;

  return ratePerPiece <= threshold ? lowGst : highGst;
}
