"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Sliders,
  Scissors,
  DollarSign,
  Users,
  BarChart3,
  Settings,
  QrCode,
  PlusCircle,
  FolderOpen,
  Search,
  Receipt,
  Building2,
  Calendar,
  X,
  ChevronDown,
  Tag,
  Palette,
  Warehouse,
  Shirt,
  Percent,
  Ruler,
  Scale,
  Hammer,
  CreditCard,
  Banknote,
  Barcode,
  Package,
  ClipboardList,
  FileText,
  TrendingUp,
  ShoppingBag,
  Truck,
  IndianRupee,
  Shield,
  Bell,
  Upload,
  Database,
  ArrowLeftRight,
  Layers,
  Star,
  UserCheck,
  BookOpen,
  PieChart,
  Wallet,
  LinkIcon,
  ArrowDownLeft,
  AlertCircle,
  HardDrive,
  MessageSquare,
  LucideIcon,
} from "lucide-react";
import { MobileBottomSheet } from "@/components/shared/MobileBottomSheet";
import { usePermissions } from "@/hooks/usePermissions";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavChild {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavCategory {
  label: string;
  icon: LucideIcon;
  /** Main href — tapping the category label navigates here */
  href: string;
  /** Module key for permission checks */
  module: string;
  children: NavChild[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    label: "Sales",
    icon: ShoppingBag,
    href: "/sales/bills",
    module: "Sales & Billing",
    children: [
      { label: "Bills & Invoices", href: "/sales/bills", icon: FileText },
      { label: "Orders / Bookings", href: "/sales/orders", icon: ClipboardList },
      { label: "Sales Returns", href: "/sales/returns", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Finished Stock",
    icon: Boxes,
    href: "/finished-stock",
    module: "Stock",
    children: [
      { label: "Overview", href: "/finished-stock", icon: Boxes },
      { label: "Stock Adjustments", href: "/finished-stock/adjustments", icon: Scale },
      { label: "Transfers", href: "/finished-stock/transfers", icon: ArrowLeftRight },
      { label: "Delivery Challans", href: "/finished-stock/challans", icon: Truck },
      { label: "B-Grade & Aatri", href: "/finished-stock/b-grade", icon: Star },
      { label: "Barcode / QR", href: "/finished-stock/barcode-qr", icon: Barcode },
      { label: "Operations", href: "/finished-stock/operations", icon: Hammer },
    ],
  },
  {
    label: "Raw Materials",
    icon: FolderOpen,
    href: "/stock/raw-materials",
    module: "Stock",
    children: [
      { label: "RM Stock", href: "/stock/raw-materials", icon: Package },
      { label: "RM Purchases", href: "/purchases", icon: Receipt },
      { label: "RM Purchase Returns", href: "/purchases?tab=returns", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Production",
    icon: Scissors,
    href: "/production",
    module: "Production",
    children: [
      { label: "Lots", href: "/production/lots", icon: Layers },
      { label: "Stage Entries", href: "/production/stage-entries", icon: ClipboardList },
      { label: "Job Work", href: "/production/job-work", icon: Hammer },
    ],
  },
  {
    label: "Purchases",
    icon: Receipt,
    href: "/purchases",
    module: "Payments & Finance",
    children: [
      { label: "Purchase Log", href: "/purchases", icon: Receipt },
      { label: "New Purchase", href: "/purchases/new", icon: PlusCircle },
      { label: "Purchase Returns", href: "/purchases/returns", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Parties",
    icon: Users,
    href: "/parties",
    module: "Parties",
    children: [
      { label: "All Parties", href: "/parties", icon: Users },
      { label: "Add New Party", href: "/parties/new", icon: PlusCircle },
    ],
  },
  {
    label: "Payments",
    icon: CreditCard,
    href: "/payments",
    module: "Payments & Finance",
    children: [
      { label: "Payment History", href: "/payments", icon: CreditCard },
      { label: "Make Payment", href: "/payments/make", icon: ArrowLeftRight },
      { label: "Receive Payment", href: "/payments/receive", icon: ArrowDownLeft },
      { label: "Supplier Payments", href: "/payments/supplier", icon: Truck },
      { label: "Advances", href: "/payments/advances", icon: Wallet },
      { label: "Direct Linking", href: "/payments/direct-link", icon: LinkIcon },
      { label: "Write-offs", href: "/payments/write-offs", icon: AlertCircle },
    ],
  },
  {
    label: "Expenses & Reminders",
    icon: DollarSign,
    href: "/expenses",
    module: "Payments & Finance",
    children: [
      { label: "Expenses Hub", href: "/expenses", icon: DollarSign },
      { label: "Reminders", href: "/reminders", icon: Calendar },
    ],
  },
  {
    label: "Salary & Payroll",
    icon: UserCheck,
    href: "/salary/process",
    module: "Payments & Finance",
    children: [
      { label: "Bulk Payroll", href: "/salary/process", icon: ClipboardList },
      { label: "Employee Advances", href: "/salary/advances", icon: Wallet },
      { label: "Salary Records", href: "/expenses?tab=salary", icon: CreditCard },
    ],
  },
  {
    label: "Master Data",
    icon: Sliders,
    href: "/master-data",
    module: "Master Data",
    children: [
      { label: "Brands", href: "/master-data/brands", icon: Tag },
      { label: "Designs", href: "/master-data/designs", icon: Palette },
      { label: "Godowns", href: "/master-data/godowns", icon: Warehouse },
      { label: "Garment Types", href: "/master-data/garment-types", icon: Shirt },
      { label: "GST Rates", href: "/master-data/gst-rates", icon: Percent },
      { label: "Size Sets", href: "/master-data/size-sets", icon: Ruler },
      { label: "Units", href: "/master-data/units", icon: Scale },
      { label: "Workers", href: "/master-data/workers", icon: UserCheck },
      { label: "Production Stages", href: "/master-data/production-stages", icon: ClipboardList },
      { label: "Expense Types", href: "/master-data/expense-types", icon: Receipt },
      { label: "Raw Materials", href: "/master-data/raw-materials", icon: Package },
      { label: "Banks & UPI", href: "/master-data/banks-upi", icon: Banknote },
      { label: "Barcode / QR", href: "/master-data/barcode-qr", icon: Barcode },
      { label: "Parties", href: "/master-data/parties", icon: Users },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    href: "/reports",
    module: "Reports",
    children: [
      { label: "Financial", href: "/reports/financial", icon: TrendingUp },
      { label: "Sales", href: "/reports/sales", icon: ShoppingBag },
      { label: "Purchases", href: "/reports/purchases", icon: Receipt },
      { label: "Inventory", href: "/reports/inventory", icon: Boxes },
      { label: "Payments", href: "/reports/payments", icon: CreditCard },
      { label: "Production", href: "/reports/production", icon: Scissors },
      { label: "Party Reports", href: "/reports/party-reports", icon: Users },
      { label: "Party Ledger", href: "/reports/party-statement", icon: BookOpen },
      { label: "Profit & Loss", href: "/reports/profit-loss", icon: TrendingUp },
      { label: "Balance Sheet", href: "/reports/balance-sheet", icon: Scale },
      { label: "Cash Flow", href: "/reports/cash-flow", icon: Wallet },
      { label: "GST Summary", href: "/reports/gst-summary", icon: Percent },
      { label: "Stock Valuation", href: "/reports/stock-valuation", icon: IndianRupee },
      { label: "Analysis", href: "/reports/analysis", icon: PieChart },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
    module: "Settings",
    children: [
      { label: "General", href: "/settings/general", icon: Settings },
      { label: "Financial", href: "/settings/financial", icon: IndianRupee },
      { label: "Inventory", href: "/settings/inventory", icon: Boxes },
      { label: "Production", href: "/settings/production", icon: Scissors },
      { label: "Company Profile", href: "/settings/company-profile", icon: Building2 },
      { label: "Companies", href: "/settings/companies", icon: Building2 },
      { label: "Users & Roles", href: "/settings/users-roles", icon: Shield },
      { label: "Communication", href: "/settings/communication", icon: MessageSquare },
      { label: "Notifications", href: "/settings/notifications", icon: Bell },
      { label: "Bill Builder", href: "/settings/bill-builder", icon: FileText },
      { label: "Import", href: "/settings/import", icon: Upload },
      { label: "Backup & Restore", href: "/settings/backup-restore", icon: HardDrive },
      { label: "Audit Logs", href: "/settings/audit-logs", icon: Database },
    ],
  },
];

const QUICK_ACTIONS: NavChild[] = [
  { label: "Scan Code", href: "/scan", icon: QrCode },
  { label: "New Bill", href: "/sales/bills/new", icon: PlusCircle },
  { label: "New Order", href: "/sales/orders/new", icon: ClipboardList },
];

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const pathname = usePathname();
  const { canView } = usePermissions();
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const searchLower = search.trim().toLowerCase();
  const isSearching = searchLower.length > 0;

  // Filter categories and their children by search and permission
  const filteredCategories = NAV_CATEGORIES
    .filter((cat) => canView(cat.module))
    .map((cat) => {
      if (!isSearching) return cat;
      const matchingChildren = cat.children.filter((child) =>
        child.label.toLowerCase().includes(searchLower)
      );
      const categoryMatches = cat.label.toLowerCase().includes(searchLower);
      if (categoryMatches) return cat; // show all children
      if (matchingChildren.length > 0) return { ...cat, children: matchingChildren };
      return null;
    })
    .filter(Boolean) as NavCategory[];

  const filteredQuickActions = QUICK_ACTIONS.filter(
    (qa) => !isSearching || qa.label.toLowerCase().includes(searchLower)
  );

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="TAS ERP Navigation"
      description="Quick access to all modules & screens"
      maxHeight="max-h-[88dvh]"
    >
      <div className="space-y-3 pb-6">
        {/* Instant Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Find any screen or feature..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 h-10 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick Actions Row */}
        {filteredQuickActions.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider mb-2 px-0.5">
              Quick Actions
            </h3>
            <div className="flex gap-2">
              {filteredQuickActions.map((qa) => {
                const Icon = qa.icon;
                return (
                  <Link
                    key={qa.href}
                    href={qa.href}
                    onClick={() => {
                      triggerHaptic("selection");
                      onOpenChange(false);
                    }}
                    className="flex-1 flex flex-col items-center justify-center p-2.5 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-light)] text-[var(--primary)] gap-1 active:scale-95 transition-all"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold">{qa.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Sections */}
        <div className="space-y-2">
          {filteredCategories.map((cat) => {
            const Icon = cat.icon;
            const isExpanded = expandedCategories.has(cat.label) || isSearching;
            const isActiveModule =
              pathname?.startsWith(cat.href) ||
              cat.children.some((c) => pathname?.startsWith(c.href));

            return (
              <div
                key={cat.label}
                className={cn(
                  "rounded-xl border transition-all overflow-hidden",
                  isActiveModule
                    ? "border-[var(--primary)]/40 bg-[var(--card-bg)] shadow-[var(--shadow-sm)]"
                    : "border-[var(--border)] bg-[var(--card-bg)]"
                )}
              >
                {/* Category Header — Whole row toggles accordion */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    toggleCategory(cat.label);
                  }}
                  className="w-full flex items-center justify-between px-3 h-12 active:bg-[var(--table-row-hover)] cursor-pointer text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        isActiveModule
                          ? "bg-[var(--primary)] text-white shadow-xs"
                          : "bg-[var(--page-bg)] text-[var(--primary)]"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-bold truncate",
                        isActiveModule
                          ? "text-[var(--primary)]"
                          : "text-[var(--text-primary)]"
                      )}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border-light)]">
                      {cat.children.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-[var(--text-muted)]">
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {/* Expanded Children — 2-Column Mobile App Tile Grid */}
                {isExpanded && cat.children.length > 0 && (
                  <div className="border-t border-[var(--border-light)] p-2.5 bg-[var(--page-bg)]/50 space-y-2">
                    {/* Optional Hub link banner */}
                    <Link
                      href={cat.href}
                      onClick={() => {
                        triggerHaptic("selection");
                        onOpenChange(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary-light)] active:scale-[0.99] transition-all"
                    >
                      <span>Open {cat.label} Overview Hub</span>
                      <span className="text-sm">→</span>
                    </Link>

                    {/* Sub-screens buttons grid */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = pathname === child.href || pathname?.startsWith(child.href + "/");

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => {
                              triggerHaptic("selection");
                              onOpenChange(false);
                            }}
                            className={cn(
                              "flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.96]",
                              isChildActive
                                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs"
                                : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            <ChildIcon className={cn("w-4 h-4 shrink-0", isChildActive ? "text-white" : "text-[var(--primary)]")} />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* No results */}
        {filteredCategories.length === 0 && filteredQuickActions.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
            No screen found matching &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
}
