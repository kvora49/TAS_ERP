import { useAppStore } from "@/store";

export function useBusinessId() {
  const user = useAppStore((state) => state.user);
  const selectedBusinessId = useAppStore((state) => state.selectedBusinessId);
  return user?.businessId ?? selectedBusinessId;
}
