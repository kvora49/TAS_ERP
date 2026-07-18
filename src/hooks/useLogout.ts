import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useLogout() {
  const router = useRouter();
  const setUser = useAppStore((state) => state.setUser);
  const setSelectedBusinessId = useAppStore((state) => state.setSelectedBusinessId);
  const queryClient = useQueryClient();

  const logout = async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSelectedBusinessId(null);
      queryClient.clear();
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Error signing out:", err);
      toast.error("Logout failed. Please try again.");
    }
  };

  return { logout };
}
