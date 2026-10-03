"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onSuccess: () => {
            // Refresh mounted reports after writes; inactive results become stale.
            void queryClient.invalidateQueries({ predicate: query => query.queryKey.includes("report-company") });
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 300_000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
          },
          mutations: {
            retry: 1,
            onError: (err) => {
              const msg = err instanceof Error ? err.message : "An error occurred";
              import("sonner").then(({ toast }) => toast.error(msg));
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
