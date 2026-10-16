"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store";
import { useQueryClient } from "@tanstack/react-query";

export function useLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const setUser = useAppStore((state) => state.setUser);
  const setSelectedBusinessId = useAppStore((state) => state.setSelectedBusinessId);
  const queryClient = useQueryClient();

  const logout = async () => {
    setIsLoggingOut(true);
    const supabase = createClient();
    try {
      // 1. Immediately clear Zustand app store
      setUser(null);
      setSelectedBusinessId(null);
      // 2. Clear all TanStack query caches to avoid leaking data or stale queries
      queryClient.clear();
      // 3. Clear auth/company cookies
      if (typeof document !== "undefined") {
        document.cookie = "active_company_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "sb-business-id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      // 4. Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Local state is intentionally cleared even when the network prevents
        // remote revocation; protected server routes still require a valid JWT.
        console.warn("Remote sign-out could not be confirmed:", error.message);
      }
    } catch (err) {
      console.error("Error signing out:", err);
    } finally {
      // 5. Hard replace to /login to instantly unmount dashboard tree and prevent ghost renders
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  };

  return { logout, isLoggingOut };
}
