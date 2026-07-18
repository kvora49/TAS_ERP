"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
  const setUser = useAppStore((state) => state.setUser);
  const setSelectedBusinessId = useAppStore((state) => state.setSelectedBusinessId);
  const [loading, setLoading] = useState(true);

  useNotifications();

  useEffect(() => {
    const syncUser = async () => {
      const supabase = createClient();
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("users")
          .select("id, email, full_name, role, business_id")
          .eq("id", session.user.id)
          .is("deleted_at", null)
          .single();

        if (error || !profile) {
          await supabase.auth.signOut();
          router.push("/login");
          return;
        }

        setUser({
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          role: profile.role as any,
          businessId: profile.business_id,
        });
        setSelectedBusinessId(profile.business_id);
      } catch (err) {
        console.error("Error syncing user session:", err);
      } finally {
        setLoading(false);
      }
    };

    syncUser();
  }, [router, setUser, setSelectedBusinessId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-[#6366F1] animate-spin" />
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
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
