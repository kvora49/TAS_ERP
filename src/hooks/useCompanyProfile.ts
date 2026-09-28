import { useQuery } from "@tanstack/react-query";

export interface CompanyProfileResponse {
  business: {
    id: string;
    name: string;
    gstin: string;
    pan: string | null;
    address: string;
    phone: string;
    email: string;
    website: string | null;
    logo_url: string | null;
    financial_year_start: string;
    currency: string;
    updated_at: string;
    einvoice_applicability?: "mandatory" | "voluntary_enabled" | "not_enabled";
    aato_bracket?: "below_5cr" | "5cr_to_10cr" | "10cr_and_above";
    irp_client_id?: string | null;
    irp_onboarding_status?: string | null;
    irp_token_expiry?: string | null;
  } | null;
  brand?: any;
  brandConfig?: any;
  einvoiceAdapter?: {
    providerName: string;
    isLive: boolean;
  };
}

export function useCompanyProfile() {
  const query = useQuery<CompanyProfileResponse>({
    queryKey: ["settings", "company-profile"],
    queryFn: async () => {
      const res = await fetch("/api/settings/company-profile");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load company profile");
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const business = query.data?.business;
  const brand = query.data?.brand;
  const brandConfig = query.data?.brandConfig;

  /**
   * Universal logo resolution hierarchy (User Preference):
   * Company Profile Logo -> Brand Logo -> System Logo (null)
   */
  const getEffectiveLogo = (brandLogoUrl?: string | null): string | null => {
    if (business?.logo_url && business.logo_url.trim().length > 0) {
      return business.logo_url;
    }
    if (brandLogoUrl && brandLogoUrl.trim().length > 0) {
      return brandLogoUrl;
    }
    if (brand?.logo_url && brand.logo_url.trim().length > 0) {
      return brand.logo_url;
    }
    return null;
  };

  const getSanitizedWebsite = (): string | null => {
    if (!business?.website) return null;
    const url = business.website.trim();
    if (!url) return null;
    return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  };

  return {
    ...query,
    business,
    brand,
    brandConfig,
    companyName: business?.name || "Company",
    gstin: business?.gstin || "",
    pan: business?.pan || "",
    address: business?.address || "",
    phone: business?.phone || "",
    email: business?.email || "",
    website: business?.website || "",
    logoUrl: getEffectiveLogo(),
    fiscalYear: business?.financial_year_start || "1 April – 31 March",
    currency: business?.currency || "INR (₹)",
    // Helpers
    getEffectiveLogo,
    getSanitizedWebsite,
  };
}
