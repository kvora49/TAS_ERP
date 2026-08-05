"use client";

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ModuleGuard } from "@/components/shared/ModuleGuard";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-body)] print:h-auto print:overflow-visible">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Layout Area */}
        <div className={cn(
          "flex flex-col flex-1 overflow-hidden transition-all duration-200 ml-0 print:ml-0 print:block print:overflow-visible",
          sidebarOpen ? "md:ml-[240px]" : "md:ml-[68px]"
        )}>
          {/* Navigation Header */}
          <Header />

          {/* Content View */}
          <main className="flex-1 overflow-y-auto bg-[var(--page-bg)] text-[var(--text-body)] px-3 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-24 md:pb-8 relative print:p-0 print:m-0 print:bg-white print:overflow-visible">
            <div className="max-w-[1800px] mx-auto w-full">
              <ModuleGuard>{children}</ModuleGuard>
            </div>
          </main>

          {/* Mobile Bottom Navigation */}
          <BottomNav />
        </div>
      </div>
    </AuthProvider>
  );
}
