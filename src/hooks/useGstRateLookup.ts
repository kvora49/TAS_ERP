import { useMemo, useCallback } from "react";
import { useGstRatesList } from "@/hooks/queries/useMasterData";
import { GstRate, resolveGstForHsn, ResolvedGstResult } from "@/lib/utils/gst";

export interface HsnOption {
  hsn_code: string;
  label: string;
  description: string;
  gst_percent: number;
  auto_tier: boolean;
}

export function useGstRateLookup() {
  const { data, isLoading, error, refetch } = useGstRatesList();
  const gstRates: GstRate[] = useMemo(() => data?.gstRates || [], [data]);

  const lookupGst = useCallback(
    (hsnCode: string | null | undefined, ratePerPiece: number = 0, fallbackGst?: number): ResolvedGstResult | null => {
      return resolveGstForHsn(hsnCode, ratePerPiece, gstRates, fallbackGst);
    },
    [gstRates]
  );

  const hsnOptions: HsnOption[] = useMemo(() => {
    return gstRates
      .filter((r) => r.is_active !== false)
      .map((r) => {
        let label = r.hsn_code;
        if (r.auto_tier) {
          label += ` (${r.tier_low_gst || 5}% / ${r.tier_high_gst || 12}% Auto-Tier)`;
        } else {
          label += ` (${r.gst_percent}%)`;
        }
        if (r.description) {
          label += ` - ${r.description}`;
        }
        return {
          hsn_code: r.hsn_code,
          label,
          description: r.description || "",
          gst_percent: r.gst_percent,
          auto_tier: r.auto_tier,
        };
      });
  }, [gstRates]);

  return {
    gstRates,
    isLoading,
    error,
    refetch,
    lookupGst,
    hsnOptions,
  };
}
