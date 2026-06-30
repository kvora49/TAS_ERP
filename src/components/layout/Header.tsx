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

interface BrandItem {
  id: string;
  name: string;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);

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
    <header className="fixed top-0 right-0 left-0 md:left-[232px] h-16 bg-white border-b border-[#E5E7EB] z-30 flex items-center justify-between px-6 lg:px-8 select-none">
      {/* Left: Hamburger + Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] md:hidden cursor-pointer"
        >
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-[#64748B]">
          {getBreadcrumbs().map((part, idx, arr) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span
                className={idx === arr.length - 1 ? "text-[#0F172A]" : ""}
              >
                {part}
              </span>
              {idx < arr.length - 1 && <span className="text-[#94A3B8]">/</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Filters & Quick Actions */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Brand Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-9 px-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-xs font-semibold text-[#374151] flex items-center gap-2 transition-colors cursor-pointer outline-none">
            <Sliders size={13} className="text-[#64748B]" />
            <span>
              {filters.brandId === "all"
                ? "All Brands"
                : brands.find((b) => b.id === filters.brandId)?.name || "Select Brand"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white border border-[#E5E7EB] rounded-lg shadow-md mt-1">
            <DropdownMenuLabel className="text-xs text-[#64748B] font-bold uppercase tracking-wider p-2">
              Filter by Brand
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#E5E7EB]" />
            <DropdownMenuItem
              onClick={() => setFilters({ brandId: "all" })}
              className="text-xs font-medium cursor-pointer p-2 hover:bg-[#F1F5F9]"
            >
              All Brands
            </DropdownMenuItem>
            {brands.map((brand) => (
              <DropdownMenuItem
                key={brand.id}
                onClick={() => setFilters({ brandId: brand.id })}
                className="text-xs font-medium cursor-pointer p-2 hover:bg-[#F1F5F9]"
              >
                {brand.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-9 px-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F1F5F9] text-xs font-semibold text-[#374151] flex items-center gap-2 transition-colors cursor-pointer outline-none">
            <Calendar size={13} className="text-[#64748B]" />
            <span className="capitalize">
              {filters.dateRange.replace("_", " ")}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-white border border-[#E5E7EB] rounded-lg shadow-md mt-1">
            <DropdownMenuLabel className="text-xs text-[#64748B] font-bold uppercase tracking-wider p-2">
              Select Period
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#E5E7EB]" />
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
                className="text-xs font-medium cursor-pointer p-2 hover:bg-[#F1F5F9]"
              >
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider */}
        <div className="h-5 w-px bg-[#E5E7EB]" />

        {/* Notification Bell */}
        <button
          type="button"
          onClick={() => setNotificationCount(0)}
          className="relative w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#374151] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* User profile dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-[#6366F1] text-white text-xs font-bold flex items-center justify-center border border-[#E5E7EB] hover:scale-105 transition-all select-none">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border border-[#E5E7EB] rounded-lg shadow-md mt-1">
              <DropdownMenuLabel className="p-3">
                <p className="text-sm font-bold text-[#0F172A] truncate">
                  {user.fullName}
                </p>
                <p className="text-xs text-[#64748B] truncate mt-0.5 font-medium">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#E5E7EB]" />
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="text-xs font-medium cursor-pointer p-2.5 hover:bg-[#F1F5F9] flex items-center gap-2"
              >
                <User size={14} className="text-[#64748B]" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-xs font-medium text-[#DC2626] cursor-pointer p-2.5 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut size={14} className="text-[#DC2626]" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
