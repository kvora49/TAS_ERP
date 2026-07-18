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
  Users,
  Truck,
  ClipboardList,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useLogout } from "@/hooks/useLogout";

interface NavSubSubItem {
  name: string;
  href: string;
}

interface NavSubItem {
  name: string;
  href?: string;
  subItems?: NavSubSubItem[];
}

interface NavItem {
  name: string;
  href?: string;
  icon?: React.ComponentType<any>;
  subItems?: NavSubItem[];
  isSectionHeader?: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);

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
    // Auto-expand menus based on active route
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
      pathname.startsWith("/reminders") ||
      pathname.startsWith("/reports/balance-sheet") ||
      pathname.startsWith("/reports/profit-loss") ||
      pathname.startsWith("/reports/gst-summary") ||
      pathname.startsWith("/reports/cash-flow") ||
      pathname.startsWith("/reports/stock-valuation") ||
      pathname.startsWith("/reports/party-statement")
    ) {
      setExpandedMenus((prev) => ({ ...prev, "Payments & Finance": true }));
      if (pathname.startsWith("/payments/")) {
        setExpandedMenus((prev) => ({ ...prev, Payments: true }));
      }
      if (pathname.startsWith("/reports/")) {
        setExpandedMenus((prev) => ({ ...prev, Reports: true }));
      }
    }
  }, [pathname, setNavigatingTo]);

  const toggleSubMenu = (menuName: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  const { logout: handleLogout } = useLogout();

  const IMPLEMENTED_ROUTES = [
    "/",
    "/master-data/brands",
    "/master-data/godowns",
    "/master-data/production-stages/templates",
    "/master-data/size-sets",
    "/master-data/designs",
    "/master-data/expense-types",
    "/master-data/gst-rates",
    "/master-data/banks-upi",
    "/master-data/raw-materials",
    "/master-data/workers",
    "/master-data/units",
    "/master-data/garment-types",
    "/parties",
    "/raw-materials/purchases",
    "/raw-materials/purchase-returns",
    "/raw-materials/stock",
    "/production/lots",
    "/production/stage-entries",
    "/production/job-work/list",
    "/production/job-work/record-payment",
    "/payments/supplier",
    "/finished-stock",
    "/finished-stock/designs",
    "/finished-stock/adjustments",
    "/finished-stock/adjustments/new",
    "/finished-stock/transfers",
    "/finished-stock/transfers/new",
    "/finished-stock/challans",
    "/finished-stock/challans/new",
  ];

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
    if (!href) return;

    // Prevent double clicking on the active route
    if (pathname === href) {
      e.preventDefault();
      return;
    }

    const isWhitelisted =
      IMPLEMENTED_ROUTES.includes(href) ||
      href.startsWith("/production/job-work/ledger") ||
      href === "/settings/general" ||
      href === "/settings/company-profile" ||
      href === "/settings/users-roles" ||
      href === "/settings/financial" ||
      href === "/settings/inventory" ||
      href === "/settings/production" ||
      href === "/settings/integrations" ||
      href === "/settings/notifications" ||
      href === "/settings/backup-restore" ||
      href === "/settings/audit-logs" ||
      href === "/settings/communication" ||
      href.startsWith("/master-data/workers/") ||
      href.startsWith("/master-data/production-stages/templates/") ||
      href.startsWith("/production/lots/") ||
      href.startsWith("/production/stage-entries/") ||
      href.startsWith("/finished-stock/designs/") ||
      href.startsWith("/finished-stock/adjustments/") ||
      href.startsWith("/finished-stock/transfers/") ||
      href.startsWith("/finished-stock/challans/") ||
      href.startsWith("/parties") ||
      href.startsWith("/sales") ||
      href.startsWith("/purchases") ||
      href.startsWith("/finance") ||
      href.startsWith("/payments") ||
      href.startsWith("/expenses") ||
      href.startsWith("/misc-income") ||
      href.startsWith("/salary") ||
      href.startsWith("/reports") ||
      href.startsWith("/reminders");

    if (!isWhitelisted) {
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

  const handlePrefetch = (href?: string) => {
    if (!href) return;
    if (href === "/raw-materials/purchases") {
      queryClient.prefetchQuery({
        queryKey: ["purchases"],
        queryFn: async () => {
          const res = await fetch("/api/raw-materials/purchases");
          return (await res.json()).purchases || [];
        }
      });
    } else if (href === "/raw-materials/stock") {
      queryClient.prefetchQuery({
        queryKey: ["stock", "summary", ""],
        queryFn: async () => {
          const res = await fetch("/api/raw-materials/stock?view=summary&godown_id=");
          return (await res.json()).stock || [];
        }
      });
    } else if (href === "/parties") {
      queryClient.prefetchQuery({
        queryKey: ["parties"],
        queryFn: async () => {
          const res = await fetch("/api/parties");
          return (await res.json()).parties || [];
        }
      });
    } else if (href === "/finance/cheques") {
      queryClient.prefetchQuery({
        queryKey: ["cheques", "received", "", "", 1],
        queryFn: async () => {
          const res = await fetch("/api/finance/cheques?direction=received&page=1&limit=10");
          return res.json();
        }
      });
    } else if (href === "/production/lots") {
      queryClient.prefetchQuery({
        queryKey: ["lots-list", "all", "all", "all", "", "", "", 1],
        queryFn: async () => {
          const res = await fetch("/api/production/lots?page=1&limit=10");
          return res.json();
        }
      });
    } else if (href === "/master-data/brands") {
      queryClient.prefetchQuery({
        queryKey: ["brands-list"],
        queryFn: async () => {
          const res = await fetch("/api/master-data/brands");
          return res.json();
        }
      });
    } else if (href === "/master-data/designs") {
      queryClient.prefetchQuery({
        queryKey: ["designs-list"],
        queryFn: async () => {
          const res = await fetch("/api/master-data/designs");
          return res.json();
        }
      });
    } else if (href === "/sales/bills") {
      queryClient.prefetchQuery({
        queryKey: ["sales-bills", 1],
        queryFn: async () => {
          const res = await fetch("/api/sales/bills?page=1&limit=10");
          return res.json();
        }
      });
    }
  };

  const navItems: NavItem[] = [
    { name: "Dashboard", href: "/", icon: Home },
    {
      name: "Master Data",
      icon: Settings2,
      subItems: [
        { name: "Brands", href: "/master-data/brands" },
        { name: "Godowns", href: "/master-data/godowns" },
        { name: "Production Stages", href: "/master-data/production-stages/templates" },
        { name: "Size Sets", href: "/master-data/size-sets" },
        { name: "Designs", href: "/master-data/designs" },
        { name: "Expense Types", href: "/master-data/expense-types" },
        { name: "GST Rates", href: "/master-data/gst-rates" },
        { name: "Banks & UPI", href: "/master-data/banks-upi" },
        { name: "Units", href: "/master-data/units" },
        { name: "Garment Types", href: "/master-data/garment-types" },
      ],
    },
    { name: "Parties", href: "/parties", icon: Users },
    {
      name: "Raw Materials",
      icon: Package,
      subItems: [
        { name: "Material Types", href: "/master-data/raw-materials" },
        { name: "Purchases", href: "/raw-materials/purchases" },
        { name: "Purchase Returns", href: "/raw-materials/purchase-returns" },
        { name: "Purchase Stock", href: "/raw-materials/stock" },
      ],
    },
    {
      name: "Production",
      icon: Factory,
      subItems: [
        { name: "Production Lots", href: "/production/lots" },
        { name: "Stage Entries", href: "/production/stage-entries" },
        {
          name: "Job Work",
          subItems: [
            { name: "Job Work List", href: "/production/job-work/list" },
            { name: "Job Worker Ledger", href: "/production/job-work/ledger" },
            { name: "Record Payment", href: "/production/job-work/record-payment" },
          ]
        }
      ],
    },
    {
      name: "Finished Stock",
      icon: Boxes,
      subItems: [
        { name: "Overview", href: "/finished-stock" },
        { name: "Design Stock", href: "/finished-stock/designs" },
        { name: "Adjustments", href: "/finished-stock/adjustments" },
        { name: "Transfers", href: "/finished-stock/transfers" },
        { name: "Challans", href: "/finished-stock/challans" },
        { name: "Barcode / QR", href: "/finished-stock/barcode-qr" },
      ],
    },
    { name: "Scan (PWA)", href: "/scan", icon: QrCode },
    {
      name: "Sales & Billing",
      icon: Receipt,
      subItems: [
        { name: "Sales Bills", href: "/sales/bills" },
        { name: "Purchase Bills", href: "/purchases/bills" },
        { name: "Orders", href: "/sales/orders" },
        { name: "Sales Returns", href: "/sales/returns" },
        { name: "Credit Notes", href: "/sales/credit-notes" },
        { name: "Debit Notes", href: "/sales/debit-notes" },
        { name: "Cheques / PDC", href: "/finance/cheques" },
      ],
    },
    {
      name: "Payments & Finance",
      icon: Wallet,
      subItems: [
        { name: "Party Ledger", href: "/parties" },
        {
          name: "Payments",
          subItems: [
            { name: "Receive Payment", href: "/payments/receive" },
            { name: "Make Payment", href: "/payments/make" },
            { name: "Advance Payments", href: "/payments/advances" },
            { name: "Direct Payment Linking", href: "/payments/direct-link" },
          ],
        },
        { name: "Write-offs", href: "/payments/write-offs" },
        { name: "Expenses", href: "/expenses" },
        { name: "Misc Income", href: "/misc-income" },
        { name: "Salary", href: "/salary" },
        {
          name: "Reports",
          subItems: [
            { name: "Balance Sheet", href: "/reports/balance-sheet" },
            { name: "Profit & Loss", href: "/reports/profit-loss" },
            { name: "GST Summary", href: "/reports/gst-summary" },
            { name: "Cash Flow", href: "/reports/cash-flow" },
            { name: "Stock Valuation", href: "/reports/stock-valuation" },
            { name: "Party Statement", href: "/reports/party-statement" },
          ],
        },
        { name: "Reminders & WhatsApp", href: "/reminders" },
      ],
    },
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
          if (item.isSectionHeader) {
            return (
              <div
                key={idx}
                className="px-5 pt-4 pb-1 text-[10px] font-bold tracking-widest text-[#94A3B8]/50 uppercase"
              >
                {item.name}
              </div>
            );
          }

          const Icon = item.icon;
          const isExpandable = !!item.subItems;
          const isMenuOpen = expandedMenus[item.name];
          
          const isItemActive = item.href
            ? pathname === item.href || navigatingTo === item.href
            : item.subItems?.some(
                (s) =>
                  pathname === s.href ||
                  navigatingTo === s.href ||
                  s.subItems?.some((ss) => pathname === ss.href || navigatingTo === ss.href)
              );

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
                    {Icon && <Icon className="h-[18px] w-[18px]" />}
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
                  onMouseEnter={() => handlePrefetch(item.href)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                    pathname === item.href || navigatingTo === item.href
                      ? "bg-[#312E81] text-white"
                      : "text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white"
                  )}
                >
                  {Icon && <Icon className="h-[18px] w-[18px]" />}
                  <span>
                    {item.name}
                    {item.href && (item.href === "/dispatch-soon" || item.href === "/stock-soon") && " (Soon)"}
                    {navigatingTo === item.href ? " (Loading...)" : ""}
                  </span>
                </Link>
              )}

              {/* Subitems container */}
              {isExpandable && isMenuOpen && (
                <div className={cn(item.name === "Settings" ? "space-y-1 mt-1" : "pl-9 space-y-1.5 pr-2")}>
                  {item.subItems?.map((sub, sIdx) => {
                    const hasSubSub = !!sub.subItems;
                    const isSubSubOpen = expandedMenus[sub.name];
                    const isSubActive = sub.href
                      ? pathname === sub.href || navigatingTo === sub.href
                      : sub.subItems?.some((ss) => pathname === ss.href || navigatingTo === ss.href);

                    if (hasSubSub) {
                      return (
                        <div key={sIdx} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleSubMenu(sub.name)}
                            className={cn(
                              "w-full flex items-center justify-between py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer text-left",
                              isSubActive
                                ? "text-white bg-[#1E1B4B]"
                                : "text-[#94A3B8] hover:text-white hover:bg-[#1E1B4B]/55"
                            )}
                          >
                            <span>{sub.name}</span>
                            {isSubSubOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>

                          {isSubSubOpen && (
                            <div className="pl-3 space-y-1 mt-1">
                              {sub.subItems?.map((subSub, ssIdx) => {
                                const isSubSubActive = pathname === subSub.href || navigatingTo === subSub.href;
                                return (
                                  <Link
                                    key={ssIdx}
                                    href={subSub.href}
                                    onClick={(e) => handleNavigation(e, subSub.href)}
                                    onMouseEnter={() => handlePrefetch(subSub.href)}
                                    className={cn(
                                      "block py-1.5 pl-6 pr-3 rounded-md text-[11px] font-semibold tracking-wide transition-all cursor-pointer",
                                      isSubSubActive
                                        ? "text-white bg-[#312E81]"
                                        : "text-[#94A3B8]/80 hover:text-white hover:bg-[#1E1B4B]/40"
                                    )}
                                  >
                                    {subSub.name}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (item.name === "Settings") {
                      return (
                        <Link
                          key={sIdx}
                          href={sub.href || "#"}
                          onClick={(e) => handleNavigation(e, sub.href)}
                          onMouseEnter={() => handlePrefetch(sub.href)}
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
                        href={sub.href || "#"}
                        onClick={(e) => handleNavigation(e, sub.href)}
                        onMouseEnter={() => handlePrefetch(sub.href)}
                        className={cn(
                          "block py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer",
                          isSubActive
                            ? "text-white bg-[#312E81]"
                            : "text-[#94A3B8] hover:text-white hover:bg-[#1E1B4B]/55"
                        )}
                      >
                        {sub.name}
                        {navigatingTo === sub.href ? " (Loading...)" : ""}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Quick Stats */}
      {sidebarOpen && (
        <div className="bg-white border-t border-[#E5E7EB] p-3 shrink-0">
          <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">
            Quick Stats
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-[#374151] font-medium">
              <ShoppingBag className="h-4 w-4 text-[#6366F1]" />
              <span>{quickStats.totalDesigns} Total Designs</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] font-medium">
              <Package className="h-4 w-4 text-[#6366F1]" />
              <span>{quickStats.totalStock.toLocaleString()} Total Stock (Pcs)</span>
            </div>
          </div>
        </div>
      )}

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
