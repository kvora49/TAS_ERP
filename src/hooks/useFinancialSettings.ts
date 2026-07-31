import { useQuery } from "@tanstack/react-query";
import {
  TDS_SECTIONS,
  calculateTDS,
  applyRoundOff,
  DeducteeType,
} from "@/lib/utils/financialCalculations";

export interface BrandSetting {
  id: string;
  name: string;
  bill_prefix_pakka: string | null;
  bill_prefix_kacha: string | null;
  design_prefix: string | null;
  design_separator: string;
  design_digits: number;
}

export interface FinancialSettingsResponse {
  settings: {
    default_credit_days?: number;
    default_payment_terms?: string;
    default_tds_type?: string;
    round_off_method?: "two_decimals" | "nearest_rupee";
    enable_cash_rounding?: boolean;
    [key: string]: any;
  } | null;
  brands: BrandSetting[];
}

export function useFinancialSettings() {
  const query = useQuery<FinancialSettingsResponse>({
    queryKey: ["settings", "financial"],
    queryFn: async () => {
      const res = await fetch("/api/settings/financial");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load financial settings");
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const settings = query.data?.settings;
  const brands = query.data?.brands || [];

  const defaultCreditDays = settings?.default_credit_days ?? 0;
  const defaultPaymentTerms = settings?.default_payment_terms || "30_days";
  const defaultTdsType = settings?.default_tds_type || "194C";
  const roundOffMethod = settings?.round_off_method || "two_decimals";
  const enableCashRounding = settings?.enable_cash_rounding ?? true;

  /**
   * Resolves context-aware default TDS section:
   * 1. If Party master has a default_tds_section, use it.
   * 2. Else use module context defaults (job_work = 194C, purchase = 194Q, etc.)
   */
  const getContextTdsSection = (
    context: "job_work" | "purchase" | "professional" | "rent" | "commission" | "general",
    partyTdsSection?: string | null
  ): string => {
    if (partyTdsSection && TDS_SECTIONS[partyTdsSection]) {
      return partyTdsSection;
    }

    switch (context) {
      case "job_work":
        return "194C";
      case "purchase":
        return "194Q";
      case "professional":
        return "194J_PROF";
      case "rent":
        return "194I_BUILDING";
      case "commission":
        return "194H";
      default:
        return defaultTdsType || "194C";
    }
  };

  return {
    ...query,
    settings,
    brands,
    defaultCreditDays,
    defaultPaymentTerms,
    defaultTdsType,
    roundOffMethod,
    enableCashRounding,
    getContextTdsSection,
    computeTDS: (
      amount: number,
      sectionCode?: string,
      deducteeType?: DeducteeType,
      hasPan?: boolean,
      customRate?: number
    ) => calculateTDS(amount, sectionCode || defaultTdsType, deducteeType, hasPan, customRate),
    computeRoundOff: (amount: number) => applyRoundOff(amount, roundOffMethod),
  };
}
