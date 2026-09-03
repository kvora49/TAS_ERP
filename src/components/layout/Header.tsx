"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, User, Calendar, LogOut, Sliders } from "lucide-react";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { NotificationPopover } from "@/components/notifications/NotificationPopover";
import ThemeToggle from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";
import { MobileFilterSheet, MobileFilterField } from "@/components/shared/MobileFilterSheet";


import { CompanySwitcher } from "./CompanySwitcher";

// Header component with collapsible sidebar support

interface BrandItem {
  id: string;
  name: string;
}

const ROUTE_LABELS: Record<string, string> = {
  reports: "Reports",
  financial: "Financial Reports",
  inventory: "Inventory & Stock",
  sales: "Sales Reports",
  purchases: "Purchase Reports",
  payments: "Payment & Finance",
  production: "Production & Workers",
  "party-statement": "Party Ledger",
  analysis: "Executive Analysis",
  "master-data": "Master Data",
  stock: "Stock",
  "raw-materials": "Raw Materials",
  new: "New Entry / Adjustment",
  "backup-restore": "Backup & Restore",
  "finished-stock": "Finished Stock",
  "b-grade": "B-Grade & Aatri Stock",
  companies: "Companies",
  "company-profile": "Company Profile",
  "barcode-qr": "Barcode Management",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const { logoUrl, companyName } = useCompanyProfile();

  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [notificationCount, setNotificationCount] = useState(3); // placeholder

  useEffect(() => {
    const fetchBrands = async () => {
      if (!user || !user.businessId) return;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("business_id", user.businessId)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (!error && data) {
        setBrands(data);
        const currentBrandId = useAppStore.getState().filters?.brandId;
        if (currentBrandId && currentBrandId !== "all" && !data.some((b) => b.id === currentBrandId)) {
          setFilters({ brandId: "all" });
        }
      }
    };
    fetchBrands();
  }, [user, user?.businessId]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    toast.success("Logged out");
    window.location.href = "/login";
  };

  const getBreadcrumbs = () => {
    if (!pathname) return ["Dashboard"];
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return ["Dashboard"];
    return parts.map((part) =>
      ROUTE_LABELS[part] ??
      (part || "")
        .split("-")
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
        .join(" ")
    );
  };

  return (
    <header className="fixed top-0 right-0 left-0 h-[calc(3rem+env(safe-area-inset-top,0px))] sm:h-16 pt-[env(safe-area-inset-top,0px)] bg-[var(--card-bg)]/95 backdrop-blur-md border-b border-[var(--border)] z-30 flex items-center justify-between px-3 sm:px-4 select-none transition-all duration-200 print:hidden overflow-hidden">
      {/* Left: Logo block + Hamburger + Breadcrumb / Mobile Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">

        {/* Branding & Company Switcher block */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {/* Hamburger toggle (desktop/tablet only - mobile uses bottom nav) */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden sm:flex w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] items-center justify-center transition-all cursor-pointer shrink-0"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Menu size={18} />
          </button>

          {/* Company Switcher */}
          <CompanySwitcher />
        </div>

        {/* Mobile Page Title (< sm) */}
        <div className="sm:hidden flex items-center min-w-0 pl-1">
          <span className="text-xs font-black text-[var(--text-primary)] truncate max-w-[130px]">
            {getBreadcrumbs().slice(-1)[0] || "Dashboard"}
          </span>
        </div>

        {/* Divider (desktop) */}
        <div className="h-5 w-px bg-[var(--border)] hidden lg:block" />

        {/* Breadcrumb (desktop) */}
        <div className="hidden lg:flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] truncate">
          {getBreadcrumbs().map((part, idx, arr) => (
            <div key={idx} className="flex items-center gap-1.5 truncate">
              <span
                className={idx === arr.length - 1 ? "text-[var(--text-primary)] font-bold truncate" : "truncate"}
              >
                {part}
              </span>
              {idx < arr.length - 1 && <span className="text-[var(--text-faint)]">/</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Filters & Quick Actions */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
        {/* Mobile Filter Sheet Trigger (< sm) */}
        <div className="sm:hidden">
          <MobileFilterSheet
            activeCount={
              (filters?.brandId && filters.brandId !== "all" ? 1 : 0) +
              (filters?.dateRange && filters.dateRange !== "today" ? 1 : 0)
            }
            triggerLabel="Filters"
            onClearAll={() => setFilters({ brandId: "all", dateRange: "today" })}
          >
            <MobileFilterField label="Brand">
              <select
                value={filters?.brandId || "all"}
                onChange={(e) => setFilters({ brandId: e.target.value })}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="all">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </MobileFilterField>
            <MobileFilterField label="Period">
              <select
                value={filters?.dateRange || "today"}
                onChange={(e) => setFilters({ dateRange: e.target.value })}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Fiscal Year</option>
              </select>
            </MobileFilterField>
          </MobileFilterSheet>
        </div>

        {/* Brand Filter (Desktop/Tablet) */}
        <div className="hidden sm:block">
          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer outline-none">
              <Sliders size={13} className="text-[var(--text-muted)] shrink-0" />
              <span className="hidden md:inline truncate max-w-[90px]">
                {filters?.brandId === "all" || !filters?.brandId
                  ? "All Brands"
                  : brands.find((b) => b.id === filters?.brandId)?.name || "All Brands"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-md mt-1 z-50">
              <DropdownMenuLabel className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider p-2">
                Filter by Brand
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--border)]" />
              <DropdownMenuItem
                onClick={() => setFilters({ brandId: "all" })}
                className="text-xs font-medium cursor-pointer p-2 hover:bg-[var(--page-bg)] text-[var(--text-primary)]"
              >
                All Brands
              </DropdownMenuItem>
              {brands.map((brand) => (
                <DropdownMenuItem
                  key={brand.id}
                  onClick={() => setFilters({ brandId: brand.id })}
                  className="text-xs font-medium cursor-pointer p-2 hover:bg-[var(--page-bg)] text-[var(--text-primary)]"
                >
                  {brand.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Date Filter (Desktop/Tablet) */}
        <div className="hidden sm:block">
          <DropdownMenu>
            <DropdownMenuTrigger className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer outline-none">
              <Calendar size={13} className="text-[var(--text-muted)] shrink-0" />
              <span className="capitalize hidden md:inline truncate max-w-[100px]">
                {(filters?.dateRange || "today").replace("_", " ")}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-md mt-1 z-50">
              <DropdownMenuLabel className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider p-2">
                Select Period
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--border)]" />
              {[
                { label: "Today", value: "today" },
                { label: "This Week", value: "this_week" },
                { label: "This Month", value: "this_month" },
                { label: "Last Month", value: "last_month" },
                { label: "This Fiscal Year", value: "this_year" },
              ].map((p) => (
                <DropdownMenuItem
                  key={p.value}
                  onClick={() => setFilters({ dateRange: p.value })}
                  className="text-xs font-medium cursor-pointer p-2 hover:bg-[var(--page-bg)] text-[var(--text-primary)]"
                >
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>


        {/* Divider */}
        <div className="h-5 w-px bg-[var(--border)] hidden md:block" />

        {/* Notification Bell Popover */}
        <NotificationPopover />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User profile dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center border border-[var(--border)] hover:scale-105 transition-all select-none shrink-0">
                {(user.fullName || user.email || "U").charAt(0).toUpperCase()}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-md mt-1">
              <DropdownMenuLabel className="p-3">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {user.fullName}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 font-medium">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--border)]" />
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="text-xs font-medium cursor-pointer p-2.5 hover:bg-[var(--page-bg)] text-[var(--text-primary)] flex items-center gap-2"
              >
                <User size={14} className="text-[var(--text-muted)]" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-xs font-medium text-red-500 cursor-pointer p-2.5 hover:bg-red-500/10 flex items-center gap-2"
              >
                <LogOut size={14} className="text-red-500" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
