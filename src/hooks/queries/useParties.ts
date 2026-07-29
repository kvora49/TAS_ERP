import { useQuery } from "@tanstack/react-query";

export function usePartiesList(type?: string, search?: string) {
  return useQuery({
    queryKey: ["master-data", "parties", type, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.append("type", type);
      if (search) params.append("search", search);
      const queryString = params.toString();
      const url = `/api/parties${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch parties");
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}
