import type { QueryClient } from "@tanstack/react-query";

export function invalidateReports(client: QueryClient) {
  return client.invalidateQueries({ predicate: query =>
    query.queryKey.includes("report-company") || query.queryKey.some(key => typeof key === "string" && /ledger/.test(key))
  });
}
