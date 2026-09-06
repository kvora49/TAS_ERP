"use client";

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CompanyProvider } from "@/components/providers/CompanyProvider";
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
      <CompanyProvider>
        <div className="flex h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-body)] print:h-auto print:overflow-visible">
        {/* Skip to Main Content Link for A11y */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--primary)] focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary)] text-sm font-semibold transition-transform"
        >
          Skip to main content
        </a>

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
          <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--page-bg)] text-[var(--text-body)] px-2.5 sm:px-6 lg:px-8 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:pt-24 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-8 relative print:p-0 print:m-0 print:bg-white print:overflow-visible overscroll-y-contain">
            <div className="max-w-[1800px] mx-auto w-full">
              <ModuleGuard>{children}</ModuleGuard>
            </div>
          </main>

          {/* Mobile Bottom Navigation */}
          <BottomNav />
        </div>
      </div>
      </CompanyProvider>
    </AuthProvider>
  );
}
