"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Settings2,
  Package,
  Factory,
  Boxes,
  Receipt,
  CreditCard,
  BarChart3,
  Wallet,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LogOut,
  User as UserIcon,
  Menu,
} from "lucide-react";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<any>;
  subItems?: { name: string; href: string }[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "Master Data": false,
    Production: false,
    "Sales & Billing": false,
    Reports: false,
    Settings: false,
  });

  const navigatingTo = useAppStore((state) => state.navigatingTo);
  const setNavigatingTo = useAppStore((state) => state.setNavigatingTo);

  useEffect(() => {
    setNavigatingTo(null);
    if (pathname.startsWith("/settings")) {
      setExpandedMenus((prev) => ({ ...prev, Settings: true }));
    }
  }, [pathname, setNavigatingTo]);

  const toggleSubMenu = (menuName: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    toast.success("Logged out successfully");
    router.push("/login");
    router.refresh();
  };

  const IMPLEMENTED_ROUTES = [
    "/",
    "/master-data/brands",
    "/master-data/godowns",
    "/master-data/production-stages",
    "/master-data/size-sets",
    "/master-data/designs",
    "/master-data/expense-types",
    "/master-data/gst-rates",
    "/master-data/banks-upi",
    "/master-data/raw-materials",
  ];

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
    if (!href) return;
    
    // Prevent double clicking on the active route
    if (pathname === href) {
      e.preventDefault();
      return;
    }

    if (!IMPLEMENTED_ROUTES.includes(href) && !href.startsWith("/settings")) {
      e.preventDefault();
      toast.info("This feature is coming soon!");
      return;
    }

    // Prevent duplicate navigation clicks while transition is active
    if (navigatingTo) {
      e.preventDefault();
      return;
    }

    setNavigatingTo(href);
  };

  const navItems: NavItem[] = [
    { name: "Dashboard", href: "/", icon: Home },
    {
      name: "Master Data",
      icon: Settings2,
      subItems: [
        { name: "Brands", href: "/master-data/brands" },
        { name: "Godowns", href: "/master-data/godowns" },
        { name: "Production Stages", href: "/master-data/production-stages" },
        { name: "Size Sets", href: "/master-data/size-sets" },
        { name: "Designs", href: "/master-data/designs" },
        { name: "Expense Types", href: "/master-data/expense-types" },
        { name: "GST Rates", href: "/master-data/gst-rates" },
        { name: "Banks & UPI", href: "/master-data/banks-upi" },
        { name: "Raw Materials", href: "/master-data/raw-materials" },
      ],
    },
    { name: "Raw Materials", href: "/raw-materials", icon: Package },
    {
      name: "Production",
      icon: Factory,
      subItems: [
        { name: "Job Orders", href: "/production/job-orders" },
        { name: "Production Plan", href: "/production/plan" },
        { name: "Batches", href: "/production/batches" },
        { name: "Finished Stock", href: "/finished-stock" },
      ],
    },
    { name: "Finished Stock", href: "/finished-stock", icon: Boxes },
    {
      name: "Sales & Billing",
      icon: Receipt,
      subItems: [
        { name: "Quotations", href: "/sales/quotations" },
        { name: "Sales Orders", href: "/sales/orders" },
        { name: "Invoices", href: "/sales/invoices" },
        { name: "Payments", href: "/payments" },
      ],
    },
    { name: "Payments", href: "/payments", icon: CreditCard },
    {
      name: "Reports",
      icon: BarChart3,
      subItems: [
        { name: "Production", href: "/reports/production" },
        { name: "Stock", href: "/reports/stock" },
        { name: "Sales", href: "/reports/sales" },
        { name: "Financial", href: "/reports/financial" },
      ],
    },
    { name: "Expenses", href: "/expenses", icon: Wallet },
    {
      name: "Settings",
      icon: Settings,
      subItems: [
        { name: "General", href: "/settings/general" },
        { name: "Company Profile", href: "/settings/company-profile" },
        { name: "Users & Roles", href: "/settings/users-roles" },
        { name: "Financial", href: "/settings/financial" },
        { name: "Inventory", href: "/settings/inventory" },
        { name: "Production", href: "/settings/production" },
        { name: "Notifications", href: "/settings/notifications" },
        { name: "Backup & Restore", href: "/settings/backup-restore" },
        { name: "Audit Logs", href: "/settings/audit-logs" },
        { name: "Communication", href: "/settings/communication" },
      ],
    },
  ];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[#0F1629] w-[232px] fixed left-0 top-0 bottom-0 z-40 border-r border-[#1E293B] transition-transform duration-200 select-none",
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
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isExpandable = !!item.subItems;
          const isMenuOpen = expandedMenus[item.name];
          const isItemActive = item.href 
            ? (pathname === item.href || navigatingTo === item.href)
            : (item.subItems?.some(s => pathname === s.href || navigatingTo === s.href));

          return (
            <div key={idx} className="space-y-1">
              {isExpandable ? (
                <button
                  type="button"
                  onClick={() => toggleSubMenu(item.name)}
                  className={cn(
                    "w-[calc(100%-16px)] flex items-center justify-between px-3 py-2.5 rounded-lg mx-2 text-sm font-medium transition-all duration-200 cursor-pointer text-left",
                    isItemActive
                      ? item.name === "Settings"
                        ? "text-white bg-[#312E81]"
                        : "text-white bg-[#1E1B4B]"
                      : "text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-[18px] w-[18px]" />
                    <span>{item.name}</span>
                  </div>
                  {item.name === "Settings" ? (
                    isMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  ) : (
                    isMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href || "#"}
                  onClick={(e) => handleNavigation(e, item.href)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                    (pathname === item.href || navigatingTo === item.href)
                      ? "bg-[#312E81] text-white"
                      : "text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span>{item.name}{navigatingTo === item.href ? " (Loading...)" : ""}</span>
                </Link>
              )}

              {/* Subitems container */}
              {isExpandable && isMenuOpen && (
                <div className={cn(item.name === "Settings" ? "space-y-1 mt-1" : "pl-9 space-y-1.5 pr-2")}>
                  {item.subItems?.map((sub, sIdx) => {
                    const isSubActive = pathname === sub.href || navigatingTo === sub.href;
                    
                    if (item.name === "Settings") {
                      return (
                        <Link
                          key={sIdx}
                          href={sub.href}
                          onClick={(e) => handleNavigation(e, sub.href)}
                          className={cn(
                            "flex items-center gap-2.5 pl-9 pr-3 py-2 rounded-lg mx-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                            isSubActive
                              ? "bg-[#312E81] text-white"
                              : "text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white"
                          )}
                        >
                          <span>{sub.name}</span>
                        </Link>
                      );
                    }

                    return (
                      <Link
                        key={sIdx}
                        href={sub.href}
                        onClick={(e) => handleNavigation(e, sub.href)}
                        className={cn(
                          "block py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer",
                          isSubActive
                            ? "text-white bg-[#312E81]"
                            : "text-[#94A3B8] hover:text-white hover:bg-[#1E1B4B]/55"
                        )}
                      >
                        {sub.name}{navigatingTo === sub.href ? " (Loading...)" : ""}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Card */}
      {user && (
        <div className="mt-auto border-t border-[#1E293B] p-3 flex items-center justify-between gap-2 relative group">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-[#6366F1] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-lg shadow-[#6366F1]/10">
              {getInitials(user.fullName)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate leading-none mb-0.5">
                {user.fullName}
              </p>
              <p className="text-[10px] text-[#94A3B8] truncate leading-none font-semibold uppercase">
                {user.role}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E1B4B] transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
