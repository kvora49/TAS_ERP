"use client";

import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { useEffect, useState } from "react";

/** Report results are reusable within a company and filter set for five minutes. */
export function useReportQuery<T = any>(options: UseQueryOptions<T, Error, T, QueryKey>) {
  const businessId = useAppStore(s => s.selectedBusinessId || s.user?.businessId);
  const userId = useAppStore(s => s.user?.id);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return useQuery({
    ...options,
    queryKey: [...options.queryKey, "report-company", businessId, userId],
    enabled: ready && !!businessId && !!userId && options.enabled !== false,
    staleTime: 300_000,
    gcTime: 1_800_000,
    refetchOnWindowFocus: false,
  });
}
