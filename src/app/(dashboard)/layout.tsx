"use client";

import React from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-[#F1F5F9]">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Layout Area */}
        <div className="flex flex-col flex-1 overflow-hidden ml-0 md:ml-[232px]">
          {/* Navigation Header */}
          <Header />

          {/* Content View */}
          <main className="flex-1 overflow-y-auto bg-[#F1F5F9] px-6 lg:px-8 pt-24 pb-24 md:pb-8 relative">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <BottomNav />
        </div>
      </div>
    </AuthProvider>
  );
}
