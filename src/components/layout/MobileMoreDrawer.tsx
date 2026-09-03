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
} from "lucide-react";
import { MobileBottomSheet } from "@/components/shared/MobileBottomSheet";
import { usePermissions } from "@/hooks/usePermissions";
import { triggerHaptic } from "@/lib/haptics";

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const pathname = usePathname();
  const { canView } = usePermissions();
  const [search, setSearch] = useState("");

  const launcherItems = [
    { label: "Scan Code", href: "/scan", module: "Scan (PWA)", icon: QrCode, category: "Quick" },
    { label: "New Bill", href: "/sales/bills/new", module: "Sales & Billing", icon: PlusCircle, category: "Quick" },
    { label: "Finished Stock", href: "/finished-stock", module: "Stock", icon: Boxes, category: "Inventory" },
    { label: "Raw Materials", href: "/raw-materials/stock", module: "Stock", icon: FolderOpen, category: "Inventory" },
    { label: "Production", href: "/production", module: "Production", icon: Scissors, category: "Operations" },
    { label: "Parties", href: "/parties", module: "Parties", icon: Users, category: "Parties & Finance" },
    { label: "Expenses", href: "/expenses", module: "Payments & Finance", icon: DollarSign, category: "Parties & Finance" },
    { label: "Payments", href: "/payments", module: "Payments & Finance", icon: Receipt, category: "Parties & Finance" },
    { label: "Reminders", href: "/reminders", module: "Payments & Finance", icon: Calendar, category: "Parties & Finance" },
    { label: "Master Data", href: "/master-data/brands", module: "Master Data", icon: Sliders, category: "Operations" },
    { label: "Reports", href: "/reports", module: "Reports", icon: BarChart3, category: "System" },
    { label: "Company Profile", href: "/settings/company-profile", module: "Settings", icon: Building2, category: "System" },
    { label: "Settings", href: "/settings", module: "Settings", icon: Settings, category: "System" },
  ];

  const visibleItems = launcherItems
    .filter((item) => canView(item.module))
    .filter((item) => !search.trim() || item.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <MobileBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="TAS ERP Navigation"
      description="Quick access to all modules and actions"
      maxHeight="max-h-[85dvh]"
    >
      <div className="space-y-4">
        {/* Instant Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Find any module..."
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

        {/* Modules Grid */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {visibleItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={idx}
                href={item.href}
                onClick={() => {
                  triggerHaptic("selection");
                  onOpenChange(false);
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center group cursor-pointer touch-ripple active:scale-95 ${
                  isActive
                    ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)] shadow-sm"
                    : "border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)]"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
                    isActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--page-bg)] text-[var(--primary)]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold leading-tight truncate w-full px-0.5">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {visibleItems.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
            No module found matching &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
}
