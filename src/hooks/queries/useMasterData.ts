import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// --- BRANDS ---
export function useBrandsList() {
  return useQuery({
    queryKey: ["master-data", "brands"],
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
  return useQuery({
    queryKey: ["master-data", "godowns"],
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
  return useQuery({
    queryKey: ["master-data", "units"],
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
  return useQuery({
    queryKey: ["master-data", "size-sets"],
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
  return useQuery({
    queryKey: ["master-data", "gst-rates"],
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
  return useQuery({
    queryKey: ["master-data", "raw-materials", filters],
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
  return useQuery({
    queryKey: ["master-data", "garment-types"],
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
  return useQuery({
    queryKey: ["master-data", "expense-types"],
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
  return useQuery({
    queryKey: ["master-data", "banks-upi"],
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
  return useQuery({
    queryKey: ["master-data", "production-stages"],
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
  return useQuery({
    queryKey: ["master-data", "workers"],
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

