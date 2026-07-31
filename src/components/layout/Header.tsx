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
import ThemeToggle from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

// Header component with collapsible sidebar support

interface BrandItem {
  id: string;
  name: string;
}

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
      if (!user) return;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null);

      if (!error && data) {
        setBrands(data);
      }
    };
    fetchBrands();
  }, [user]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    toast.success("Logged out");
    window.location.href = "/login";
  };

  const getBreadcrumbs = () => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return ["Dashboard"];
    return parts.map((part) =>
      part
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );
  };

  return (
    <header className="fixed top-0 right-0 left-0 h-16 bg-[var(--card-bg)] border-b border-[var(--border)] z-30 flex items-center justify-between px-4 select-none transition-all duration-200 print:hidden">
      {/* Left: Logo block + Hamburger + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">

        {/* Branding block — always visible in header */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Hamburger toggle */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer shrink-0"
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <Menu size={18} />
          </button>

          {/* Logo */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName || "Company Logo"}
              className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 shadow-md shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#6366F1] flex items-center justify-center shadow-lg shadow-[#6366F1]/30 shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 11.51l3.17 3.17a1 1 0 001.42 0L20 8M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M4 16H3a1 1 0 01-1-1v-2.5a1 1 0 011-1h1M21 16h1a1 1 0 001-1v-2.5a1 1 0 00-1-1h-1M4 16h16M4 12V8a4 4 0 018 0v4M12 2v2" />
              </svg>
            </div>
          )}

          {/* App title + company name */}
          <div className="flex flex-col justify-center leading-tight">
            <span className="font-extrabold text-[var(--text-primary)] tracking-wide text-sm leading-none">
              TAS ERP
            </span>
            {companyName && (
              <span className="text-[10px] font-bold text-[var(--primary)] tracking-wider uppercase leading-tight mt-0.5 whitespace-nowrap">
                {companyName}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-[var(--border)] hidden md:block" />

        {/* Breadcrumb */}
        <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
          {getBreadcrumbs().map((part, idx, arr) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span
                className={idx === arr.length - 1 ? "text-[var(--text-primary)] font-bold" : ""}
              >
                {part}
              </span>
              {idx < arr.length - 1 && <span className="text-[var(--text-faint)]">/</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Filters & Quick Actions */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Brand Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-colors cursor-pointer outline-none">
            <Sliders size={13} className="text-[var(--text-muted)]" />
            <span>
              {filters.brandId === "all"
                ? "All Brands"
                : brands.find((b) => b.id === filters.brandId)?.name || "Select Brand"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-md mt-1">
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

        {/* Date Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-colors cursor-pointer outline-none">
            <Calendar size={13} className="text-[var(--text-muted)]" />
            <span className="capitalize">
              {filters.dateRange.replace("_", " ")}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-md mt-1">
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

        {/* Divider */}
        <div className="h-5 w-px bg-[var(--border)]" />

        {/* Notification Bell */}
        <button
          type="button"
          onClick={() => setNotificationCount(0)}
          className="relative w-9 h-9 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--page-bg)] transition-colors cursor-pointer"
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User profile dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center border border-[var(--border)] hover:scale-105 transition-all select-none">
                {user.fullName.charAt(0).toUpperCase()}
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
