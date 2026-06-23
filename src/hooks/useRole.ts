import { useAppStore } from "@/store";

export function useRole() {
  const user = useAppStore((state) => state.user);
  return user?.role ?? null;
}
