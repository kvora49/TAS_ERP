import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppStore } from "@/store";

function useCompanyQueryKey(key: string, suffix?: unknown) {
  const businessId = useAppStore((state) => state.user?.businessId || state.selectedBusinessId);
  return ["master-data", businessId || "unresolved-company", key, suffix] as const;
}

// --- BRANDS ---
export function useBrandsList() {
  const queryKey = useCompanyQueryKey("brands");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/brands");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch brands");
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

// --- GODOWNS ---
export function useGodownsList() {
  const queryKey = useCompanyQueryKey("godowns");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch godowns");
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

// --- UNITS ---
export function useUnitsList() {
  const queryKey = useCompanyQueryKey("units");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/units");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch units");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

// --- SIZE SETS ---
export function useSizeSetsList() {
  const queryKey = useCompanyQueryKey("size-sets");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/size-sets");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch size sets");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

// --- GST RATES ---
export function useGstRatesList() {
  const queryKey = useCompanyQueryKey("gst-rates");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/gst-rates");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch GST rates");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

// --- RAW MATERIALS ---
export function useRawMaterialsList(filters?: Record<string, string>) {
  const queryKey = useCompanyQueryKey("raw-materials", filters);
  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/master-data/raw-materials${params ? `?${params}` : ""}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch raw materials");
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

// --- GARMENT TYPES ---
export function useGarmentTypesList() {
  const queryKey = useCompanyQueryKey("garment-types");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/garment-types");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch garment types");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

// --- EXPENSE TYPES ---
export function useExpenseTypesList() {
  const queryKey = useCompanyQueryKey("expense-types");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/expense-types");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch expense types");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

// --- BANKS / UPI ---
export function useBanksList() {
  const queryKey = useCompanyQueryKey("banks-upi");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/banks-upi");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch banks & UPI");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

// --- PRODUCTION STAGES ---
export function useProductionStagesList() {
  const queryKey = useCompanyQueryKey("production-stages");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-stages");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch production stages");
      }
      return res.json();
    },
    staleTime: 60_000,
  });
}

// --- WORKERS ---
export function useWorkersList() {
  const queryKey = useCompanyQueryKey("workers");
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/master-data/workers");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch workers");
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

