"use client";

import React, { createContext, useContext, useEffect, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { switchCompany as switchCompanyServerAction } from "@/app/actions/switch-company";
import { toast } from "sonner";

export interface CompanyItem {
  id: string;
  name: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  role: string;
  status: string;
  membershipId: string;
  isActive: boolean;
}

interface CompanyContextType {
  activeCompany: CompanyItem | null;
  activeCompanyId: string | null;
  activeRole: string;
  companies: CompanyItem[];
  isLoading: boolean;
  isMultiCompany: boolean;
  isSwitching: boolean;
  switchCompany: (companyId: string) => Promise<void>;
  refetchCompanies: () => void;
}

const CompanyContext = createContext<CompanyContextType>({
  activeCompany: null,
  activeCompanyId: null,
  activeRole: "staff",
  companies: [],
  isLoading: true,
  isMultiCompany: false,
  isSwitching: false,
  switchCompany: async () => {},
  refetchCompanies: () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const setSelectedBusinessId = useAppStore((state) => state.setSelectedBusinessId);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);

  const { data, isLoading, refetch } = useQuery<{
    companies: CompanyItem[];
    activeCompanyId: string;
  }>({
    queryKey: ["companies", "list"],
    queryFn: async () => {
      const res = await fetch("/api/companies", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load companies");
      }
      return res.json();
    },
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const companies = data?.companies || [];
  const activeCompanyId = data?.activeCompanyId || null;
  const activeCompany = companies.find((c) => c.isActive || c.id === activeCompanyId) || companies[0] || null;
  const activeRole = activeCompany?.role || user?.role || "staff";
  const isMultiCompany = companies.length >= 2;

  // Sync selected business and role with zustand store
  useEffect(() => {
    if (activeCompany) {
      setSelectedBusinessId(activeCompany.id);
      if (user && (user.businessId !== activeCompany.id || user.role !== activeCompany.role)) {
        setUser({
          ...user,
          businessId: activeCompany.id,
          role: activeCompany.role as any,
        });
      }
    }
  }, [activeCompany, setSelectedBusinessId, setUser, user]);

  const handleSwitchCompany = async (companyId: string) => {
    if (!companyId || companyId === activeCompanyId) return;

    try {
      const targetCompany = companies.find((c) => c.id === companyId);
      const companyName = targetCompany?.name || "Company";
      toast.loading(`Switching to ${companyName}...`, { id: "switch-company" });

      startTransition(async () => {
        try {
          await switchCompanyServerAction(companyId);
          queryClient.clear();
          toast.success(`Switched to ${companyName}`, { id: "switch-company" });
          window.location.href = "/";
        } catch (err: any) {
          toast.error(err.message || "Failed to switch company", { id: "switch-company" });
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to switch company", { id: "switch-company" });
    }
  };

  return (
    <CompanyContext.Provider
      value={{
        activeCompany,
        activeCompanyId: activeCompany?.id || activeCompanyId,
        activeRole,
        companies,
        isLoading,
        isMultiCompany,
        isSwitching: isPending,
        switchCompany: handleSwitchCompany,
        refetchCompanies: refetch,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
