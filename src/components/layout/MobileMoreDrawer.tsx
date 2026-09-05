"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Search,
  X,
  PlusCircle,
  QrCode,
  ClipboardList,
  LucideIcon,
  Tag,
  Warehouse,
  FolderOpen,
  Layers,
  Ruler,
  Palette,
  FileText,
  Percent,
  Landmark,
  Scale,
  Shirt,
  Barcode,
  Factory,
  Hammer,
  Boxes,
  Package,
  Receipt,
  ShoppingBag,
  CreditCard,
  DollarSign,
  Building,
  TrendingUp,
  ShieldCheck,
  Users,
  Bell,
  HardDrive,
  Sliders,
  SlidersHorizontal,
} from "lucide-react";
import { MobileBottomSheet } from "@/components/shared/MobileBottomSheet";
import { usePermissions } from "@/hooks/usePermissions";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { navItems, NavItem } from "./Sidebar/navigation.config";

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Map subItem names to icons for visual richness
const SUB_ITEM_ICONS: Record<string, LucideIcon> = {
  // Master Data
  "Brands": Tag,
  "Godowns": Warehouse,
  "Material Types": FolderOpen,
  "Production Stages": Layers,
  "Size Sets": Ruler,
  "Designs": Palette,
  "Expense Types": FileText,
  "GST Rates": Percent,
  "Banks & UPI": Landmark,
  "Units": Scale,
  "Garment Types": Shirt,
  "Barcode Management": Barcode,
  // Production
  "Production Lots": Layers,
  "Stage Entries": ClipboardList,
  "Job Work": Hammer,
  // Stock
  "Finished Stock": Boxes,
  "Raw Material Stock": Package,
  "Stock Operations": Hammer,
  // Sales & Billing
  "Sales": Receipt,
  "Orders": ShoppingBag,
  // Payments & Finance
  "Payments": CreditCard,
  "Expenses & Adjustments": DollarSign,
  "Cheques / PDC": Building,
  // Reports
  "Financial Reports": Landmark,
  "Sales Reports": Receipt,
  "Purchase Reports": Package,
  "Payment Reports": CreditCard,
  "Inventory & Stock": Boxes,
  "Production & Workers": Factory,
  "Party Reports": Users,
  "Analysis": TrendingUp,
  // Settings
  "General": Sliders,
  "Companies": Building,
  "Company Profile": SlidersHorizontal,
  "Users & Roles": Users,
  "Financial": Landmark,
  "Inventory": Boxes,
  "Production": Factory,
  "Notifications": Bell,
  "Backup & Restore": HardDrive,
  "Bill Builder": FileText,
  "Audit Logs": ShieldCheck,
};

const QUICK_ACTIONS = [
  { label: "Scan Code", href: "/scan", icon: QrCode },
  { label: "New Bill", href: "/sales/bills/new", icon: PlusCircle },
  { label: "New Order", href: "/sales/orders/new", icon: ClipboardList },
];

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { canView } = usePermissions();
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const searchLower = search.trim().toLowerCase();
  const isSearching = searchLower.length > 0;

  // Filter navigation items by permission and search query
  const filteredNavItems = navItems
    .filter((item) => canView(item.name))
    .map((item) => {
      if (!isSearching) return item;
      const categoryMatches = item.name.toLowerCase().includes(searchLower);
      if (categoryMatches) return item;

      if (item.subItems) {
        const matchingSubItems = item.subItems.filter((sub) =>
          sub.name.toLowerCase().includes(searchLower)
        );
        if (matchingSubItems.length > 0) {
          return { ...item, subItems: matchingSubItems };
        }
      }
      return null;
    })
    .filter(Boolean) as NavItem[];

  const filteredQuickActions = QUICK_ACTIONS.filter(
    (qa) => !isSearching || qa.label.toLowerCase().includes(searchLower)
  );

  const handleNavigate = (href: string) => {
    triggerHaptic("selection");
    onOpenChange(false);
    router.push(href);
  };

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
            placeholder="Find any module or screen..."
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
              Quick Shortcuts
            </h3>
            <div className="flex gap-2">
              {filteredQuickActions.map((qa) => {
                const Icon = qa.icon;
                return (
                  <button
                    key={qa.href}
                    type="button"
                    onClick={() => handleNavigate(qa.href)}
                    className="flex-1 flex flex-col items-center justify-center p-2.5 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-light)] text-[var(--primary)] gap-1 active:scale-95 transition-all cursor-pointer"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold">{qa.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories / Modules List (1:1 with Desktop Sidebar) */}
        <div className="space-y-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon || Boxes;
            const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
            const isExpanded = expandedCategories.has(item.name) || isSearching;

            const isDirectActive = item.href ? (item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)) : false;
            const isSubActive = Boolean(
              item.subItems?.some((sub) => sub.href && pathname?.startsWith(sub.href))
            );
            const isActiveModule = isDirectActive || isSubActive;

            // Direct link module (e.g. Dashboard, Parties, Purchases, Scan, Reminders)
            if (!hasSubItems && item.href) {
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleNavigate(item.href!)}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 h-12 rounded-xl border transition-all active:scale-[0.98] cursor-pointer text-left",
                    isDirectActive
                      ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] shadow-[var(--shadow-sm)] font-bold"
                      : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        isDirectActive
                          ? "bg-[var(--primary)] text-white"
                          : "bg-[var(--page-bg)] text-[var(--primary)]"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold truncate">{item.name}</span>
                  </div>
                  <span className="text-xs text-[var(--text-faint)] font-bold">→</span>
                </button>
              );
            }

            // Accordion category with sub-items (e.g. Master Data, Production, Stock, Sales & Billing, etc.)
            return (
              <div
                key={item.name}
                className={cn(
                  "rounded-xl border transition-all overflow-hidden",
                  isActiveModule
                    ? "border-[var(--primary)]/40 bg-[var(--card-bg)] shadow-[var(--shadow-sm)]"
                    : "border-[var(--border)] bg-[var(--card-bg)]"
                )}
              >
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("selection");
                    toggleCategory(item.name);
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
                      {item.name}
                    </span>
                    {item.subItems && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border-light)]">
                        {item.subItems.length}
                      </span>
                    )}
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

                {/* Sub-screens buttons grid */}
                {isExpanded && item.subItems && item.subItems.length > 0 && (
                  <div className="border-t border-[var(--border-light)] p-2.5 bg-[var(--page-bg)]/50">
                    <div className="grid grid-cols-2 gap-1.5">
                      {item.subItems.map((sub) => {
                        const SubIcon = SUB_ITEM_ICONS[sub.name] || Boxes;
                        const isSubItemActive = sub.href
                          ? pathname === sub.href || pathname?.startsWith(sub.href + "/")
                          : false;

                        return (
                          <button
                            key={sub.name}
                            type="button"
                            onClick={() => sub.href && handleNavigate(sub.href)}
                            className={cn(
                              "flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.96] text-left cursor-pointer",
                              isSubItemActive
                                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs"
                                : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            <SubIcon
                              className={cn(
                                "w-4 h-4 shrink-0",
                                isSubItemActive ? "text-white" : "text-[var(--primary)]"
                              )}
                            />
                            <span className="truncate">{sub.name}</span>
                          </button>
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
        {filteredNavItems.length === 0 && filteredQuickActions.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
            No module or screen found matching &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
}

export default MobileMoreDrawer;
