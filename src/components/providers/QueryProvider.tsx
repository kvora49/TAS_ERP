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
            // Most ERP data is invalidated after writes. Keep it in memory longer so
            // navigation between screens does not repeatedly invoke the Worker.
            staleTime: 120_000,
            gcTime: 600_000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: true,
          },
          mutations: {
            // Retrying a mutation can duplicate financial and inventory operations.
            retry: false,
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
