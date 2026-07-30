"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

import { navItems } from "./Sidebar/navigation.config";
import { SidebarItem } from "./Sidebar/SidebarItem";
import { SidebarFooter } from "./Sidebar/SidebarFooter";
import { SidebarUser } from "./Sidebar/SidebarUser";

export default function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const user = useAppStore((state) => state.user);

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "Master Data": false,
    "Raw Materials": false,
    Production: false,
    "Job Work": false,
    "Sales & Billing": false,
    "Payments & Finance": false,
    Payments: false,
    Reports: false,
    Settings: false,
  });

  const navigatingTo = useAppStore((state) => state.navigatingTo);
  const setNavigatingTo = useAppStore((state) => state.setNavigatingTo);

  const [quickStats, setQuickStats] = useState({ totalDesigns: 56, totalStock: 178450 });

  useEffect(() => {
    if (!user) return;
    fetch("/api/finished-stock")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.stats) {
          setQuickStats({
            totalDesigns: data.stats.total_designs || 0,
            totalStock: data.stats.total_stock || 0,
          });
        }
      })
      .catch((err) => console.error("Error loading sidebar quick stats:", err));
  }, [user]);

  useEffect(() => {
    setNavigatingTo(null);
    if (pathname.startsWith("/settings")) {
      setExpandedMenus((prev) => ({ ...prev, Settings: true }));
    }
    if (pathname.startsWith("/master-data")) {
      setExpandedMenus((prev) => ({ ...prev, "Master Data": true }));
    }
    if (pathname.startsWith("/raw-materials")) {
      setExpandedMenus((prev) => ({ ...prev, "Raw Materials": true }));
    }
    if (pathname.startsWith("/production/job-work")) {
      setExpandedMenus((prev) => ({ ...prev, Production: true, "Job Work": true }));
    } else if (pathname.startsWith("/production")) {
      setExpandedMenus((prev) => ({ ...prev, Production: true }));
    }
    if (pathname.startsWith("/sales-billing") || pathname.startsWith("/sales") || pathname.startsWith("/purchases") || pathname.startsWith("/finance")) {
      setExpandedMenus((prev) => ({ ...prev, "Sales & Billing": true }));
    }
    if (
      pathname.startsWith("/payments") ||
      pathname.startsWith("/expenses") ||
      pathname.startsWith("/misc-income") ||
      pathname.startsWith("/salary") ||
      pathname.startsWith("/reminders")
    ) {
      setExpandedMenus((prev) => ({ ...prev, "Payments & Finance": true }));
      if (pathname.startsWith("/payments/")) {
        setExpandedMenus((prev) => ({ ...prev, Payments: true }));
      }
    }
    if (pathname.startsWith("/reports")) {
      setExpandedMenus((prev) => ({ ...prev, Reports: true }));
    }
  }, [pathname, setNavigatingTo]);

  const toggleSubMenu = (menuName: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[#0F1629] w-[232px] fixed left-0 top-0 bottom-0 z-40 border-r border-[#1E293B] transition-transform duration-200 select-none print:hidden",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#1E293B]">
        <div className="w-8 h-8 rounded-lg bg-[#6366F1] flex items-center justify-center shadow-lg shadow-[#6366F1]/20">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 11.51l3.17 3.17a1 1 0 001.42 0L20 8M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 16H3a1 1 0 01-1-1v-2.5a1 1 0 011-1h1M21 16h1a1 1 0 001-1v-2.5a1 1 0 00-1-1h-1M4 16h16M4 12V8a4 4 0 018 0v4M12 2v2" />
          </svg>
        </div>
        <div>
          <span className="font-bold text-white tracking-wider text-base">TAS ERP</span>
          <p className="text-[10px] text-[#94A3B8] font-semibold tracking-wide uppercase leading-none mt-0.5">
            Garment Intelligence
          </p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-sidebar-active scrollbar-track-transparent">
        {navItems.map((item, idx) => (
          <SidebarItem
            key={idx}
            item={item}
            navigatingTo={navigatingTo}
            setNavigatingTo={setNavigatingTo}
            expandedMenus={expandedMenus}
            toggleSubMenu={toggleSubMenu}
            queryClient={queryClient}
            toast={toast}
          />
        ))}
      </nav>

      {/* Quick Stats */}
      <SidebarFooter sidebarOpen={sidebarOpen} quickStats={quickStats} />

      {/* User Card */}
      <SidebarUser user={user} />
    </div>
  );
}
