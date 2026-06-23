"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const setSelectedBusinessId = useAppStore((state) => state.setSelectedBusinessId);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const navigatingTo = useAppStore((state) => state.navigatingTo);

  const [checkingAuth, setCheckingAuth] = useState(true);

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

        // Fetch custom user profile linked to businesses
        const { data: profile, error } = await supabase
          .from("users")
          .select("id, email, full_name, role, business_id")
          .eq("id", session.user.id)
          .is("deleted_at", null)
          .single();

        if (error || !profile) {
          // If profile fetch fails, sign out and redirect to login
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
        setCheckingAuth(false);
      }
    };

    syncUser();

    // Register FCM Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((reg) => {
          console.log("FCM Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.error("FCM Service Worker registration failed:", err);
        });
    }
  }, [router, setUser, setSelectedBusinessId]);

  if (checkingAuth) {
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
    <div className="flex h-screen overflow-hidden bg-[#F1F5F9]">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Layout Area */}
      <div className="flex flex-col flex-1 overflow-hidden ml-0 md:ml-[232px]">
        {/* Navigation Header */}
        <Header />

        {/* Content View */}
        <main className="flex-1 overflow-y-auto bg-[#F1F5F9] px-6 lg:px-8 pt-24 pb-24 md:pb-8 relative">
          {navigatingTo && (
            <div className="absolute inset-0 bg-[#F1F5F9]/60 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center select-none pointer-events-none transition-all duration-300">
              <div className="bg-white/80 dark:bg-[#111827]/85 border border-slate-200/50 dark:border-slate-800/80 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-[#6366F1] animate-spin" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Loading Workspace View...
                </span>
              </div>
            </div>
          )}
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  );
}
