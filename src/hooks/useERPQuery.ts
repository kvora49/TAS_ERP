import { useQuery, useMutation, useQueryClient, QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import React from "react";
import { TableSkeleton } from "@/components/tables/TableSkeleton";
import { CardSkeleton, DashboardSkeleton, FormSkeleton } from "@/components/ui/skeletons";

type SkeletonType = "table" | "card" | "dashboard" | "form" | boolean;

interface ERPQueryOptions<TQueryFnData = unknown, TError = unknown, TData = TQueryFnData>
  extends Omit<UseQueryOptions<TQueryFnData, TError, TData>, "queryKey" | "queryFn"> {
  skeleton?: SkeletonType;
}

export function useERPQuery<TQueryFnData = unknown, TError = unknown, TData = TQueryFnData>(
  key: QueryKey,
  fetcher: () => Promise<TQueryFnData>,
  options?: ERPQueryOptions<TQueryFnData, TError, TData>
) {
  const queryClient = useQueryClient();
  const queryResult = useQuery({
    queryKey: key,
    queryFn: fetcher,
    staleTime: 30_000,
    gcTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
    ...options,
  });

  let SkeletonElement: React.ReactNode = null;
  if (queryResult.isPending && options?.skeleton) {
    const sType = options.skeleton;
    if (sType === "table" || sType === true) {
      SkeletonElement = React.createElement(TableSkeleton, { columnsCount: 5, rowCount: 5 });
    } else if (sType === "card") {
      SkeletonElement = React.createElement(CardSkeleton, { count: 3 });
    } else if (sType === "dashboard") {
      SkeletonElement = React.createElement(DashboardSkeleton);
    } else if (sType === "form") {
      SkeletonElement = React.createElement(FormSkeleton);
    }
  }

  return {
    ...queryResult,
    Skeleton: SkeletonElement,
  };
}

interface ERPMutationOptions<TData = unknown, TError = unknown, TVariables = void> {
  successMessage?: string;
  invalidates?: QueryKey[];
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
}

export function useERPMutation<TData = unknown, TError = Error, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: ERPMutationOptions<TData, TError, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      if (options?.successMessage) {
        toast.success(options.successMessage);
      }
      if (options?.invalidates) {
        await Promise.all(
          options.invalidates.map((key) =>
            queryClient.invalidateQueries({ queryKey: key })
          )
        );
      }
      if (options?.onSuccess) {
        await options.onSuccess(data, variables);
      }
    },
    onError: async (error: TError, variables: TVariables) => {
      const msg = (error instanceof Error) ? error.message : String(error);
      toast.error(msg);
      if (options?.onError) {
        await options.onError(error, variables);
      }
    },
  });
}
