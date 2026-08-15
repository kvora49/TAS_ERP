"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

import { useNotifications } from "@/hooks/useNotifications";

interface AuthContextType {
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const setUser = useAppStore((state) => state.setUser);
  const setSelectedBusinessId = useAppStore((state) => state.setSelectedBusinessId);
  const [loading, setLoading] = useState(true);

  useNotifications();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const syncUser = async () => {
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Auth timeout")), 10_000)
          ),
        ]);

        if (cancelled) return;

        if (!sessionResult) {
          routerRef.current.replace("/login");
          return;
        }

        const { data: { session } } = sessionResult as Awaited<ReturnType<typeof supabase.auth.getSession>>;

        if (!session?.user) {
          routerRef.current.replace("/login");
          return;
        }

        const user = session.user;

        // 1. Fetch user base profile
        const { data: profile, error } = await supabase
          .from("users")
          .select("id, email, full_name, role, business_id")
          .eq("id", user.id)
          .is("deleted_at", null)
          .maybeSingle();

        if (cancelled) return;

        if (error || !profile) {
          await supabase.auth.signOut();
          routerRef.current.replace("/login");
          return;
        }

        // 2. Fetch active membership if available
        let cookieBizId: string | null = null;
        if (typeof document !== "undefined") {
          const match = document.cookie.match(/(?:^|;\s*)(?:active_company_id|sb-business-id)=([^;]+)/);
          cookieBizId = match ? decodeURIComponent(match[1]) : null;
        }

        let activeBizId = cookieBizId || profile.business_id;
        let activeRole = profile.role;

        const { data: memberships } = await supabase
          .from("company_members")
          .select("company_id, role")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: true });

        if (memberships && memberships.length > 0) {
          const matched =
            (cookieBizId && memberships.find((m) => m.company_id === cookieBizId)) ||
            memberships.find((m) => m.company_id === profile.business_id) ||
            memberships[0];
          activeBizId = matched.company_id;
          activeRole = matched.role;
        }

        setUser({
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          role: (activeRole || "staff") as any,
          businessId: activeBizId,
        });
        setSelectedBusinessId(activeBizId);
      } catch (err) {
        console.error("Error syncing user session:", err);
        if (!cancelled) {
          // On timeout or unexpected error, redirect to login
          routerRef.current.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    syncUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        routerRef.current.replace("/login");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // Empty deps: run once on mount only — router is accessed via routerRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUser, setSelectedBusinessId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-body)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-[var(--primary)] animate-spin" />
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Syncing ERP Workspace...
        </span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
