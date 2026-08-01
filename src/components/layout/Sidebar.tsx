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
import { usePermissions } from "@/hooks/usePermissions";


export default function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const user = useAppStore((state) => state.user);
  const { canView } = usePermissions();

  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "Master Data": false,
    Production: false,
    "Job Work": false,
    Stock: false,
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
    // Auto-close sidebar on mobile when navigating
    if (typeof window !== "undefined" && window.innerWidth < 768 && sidebarOpen) {
      setSidebarOpen(false);
    }
    if (pathname.startsWith("/settings")) {
      setExpandedMenus((prev) => ({ ...prev, Settings: true }));
    }
    if (pathname.startsWith("/master-data")) {
      setExpandedMenus((prev) => ({ ...prev, "Master Data": true }));
    }
    if (pathname.startsWith("/finished-stock") || pathname.startsWith("/raw-materials/stock") || pathname.startsWith("/stock")) {
      setExpandedMenus((prev) => ({ ...prev, Stock: true }));
    }
    if (pathname.startsWith("/production/job-work")) {
      setExpandedMenus((prev) => ({ ...prev, Production: true, "Job Work": true }));
    } else if (pathname.startsWith("/production")) {
      setExpandedMenus((prev) => ({ ...prev, Production: true }));
    }
    if (pathname.startsWith("/sales-billing") || pathname.startsWith("/sales")) {
      setExpandedMenus((prev) => ({ ...prev, "Sales & Billing": true }));
    }
    if (
      pathname.startsWith("/payments") ||
      pathname.startsWith("/expenses") ||
      pathname.startsWith("/finance") ||
      pathname.startsWith("/misc-income") ||
      pathname.startsWith("/salary")
    ) {
      setExpandedMenus((prev) => ({ ...prev, "Payments & Finance": true }));
      if (pathname.startsWith("/payments/")) {
        setExpandedMenus((prev) => ({ ...prev, Payments: true }));
      }
    }
    if (pathname.startsWith("/reports")) {
      setExpandedMenus((prev) => ({ ...prev, Reports: true }));
    }
  }, [pathname, setNavigatingTo, setSidebarOpen]);

  const toggleSubMenu = (menuName: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 md:hidden transition-opacity"
        />
      )}

      <div
        className={cn(
          "flex flex-col bg-[#0F1629] fixed left-0 top-16 bottom-0 z-40 border-r border-[#1E293B] transition-all duration-200 select-none print:hidden overflow-x-hidden",
          sidebarOpen ? "w-[240px] translate-x-0" : "-translate-x-full md:translate-x-0 md:w-[68px]"
        )}
      >

      {/* Nav List */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-sidebar-active scrollbar-track-transparent">
        {navItems
          .filter((item) => canView(item.name))
          .map((item, idx) => (
            <SidebarItem
              key={idx}
              item={item}
              navigatingTo={navigatingTo}
              setNavigatingTo={setNavigatingTo}
              expandedMenus={expandedMenus}
              toggleSubMenu={toggleSubMenu}
              queryClient={queryClient}
              toast={toast}
              sidebarOpen={sidebarOpen}
            />
          ))}
      </nav>

      {/* Quick Stats */}
      <SidebarFooter sidebarOpen={sidebarOpen} quickStats={quickStats} />

      {/* User Card */}
      <SidebarUser user={user} sidebarOpen={sidebarOpen} />
    </div>
    </>
  );
}
