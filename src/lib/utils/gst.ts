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

export interface ResolvedGstResult {
  gstPercent: number;
  matchedRate?: GstRate;
  isAutoTier: boolean;
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

/**
 * Resolves the applicable GST percentage for an HSN/SAC code against a list of GST rates.
 * If found, evaluates auto-tier rules against the unit rate.
 * If not found, returns fallbackGst (or undefined if no fallback provided).
 */
export function resolveGstForHsn(
  hsnCode: string | null | undefined,
  ratePerPiece: number = 0,
  gstRates: GstRate[] = [],
  fallbackGst?: number
): ResolvedGstResult | null {
  if (!hsnCode || !hsnCode.trim()) {
    return fallbackGst !== undefined
      ? { gstPercent: fallbackGst, isAutoTier: false }
      : null;
  }

  const cleanHsn = hsnCode.trim().toLowerCase();
  const matched = gstRates.find(
    (g) => g.is_active !== false && g.hsn_code?.trim().toLowerCase() === cleanHsn
  );

  if (!matched) {
    return fallbackGst !== undefined
      ? { gstPercent: fallbackGst, isAutoTier: false }
      : null;
  }

  const gstPercent = calculateGST(ratePerPiece, matched);
  return {
    gstPercent,
    matchedRate: matched,
    isAutoTier: !!matched.auto_tier,
  };
}
