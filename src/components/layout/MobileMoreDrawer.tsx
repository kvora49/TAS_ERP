"use client";

import React from "react";
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
} from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { usePermissions } from "@/hooks/usePermissions";

interface MobileMoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMoreDrawer({ open, onOpenChange }: MobileMoreDrawerProps) {
  const pathname = usePathname();
  const { canView } = usePermissions();

  const launcherItems = [
    { label: "Scan Code", href: "/scan", module: "Scan (PWA)", icon: QrCode, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { label: "New Bill", href: "/sales/bills/new", module: "Sales & Billing", icon: PlusCircle, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
    { label: "Stock Items", href: "/finished-stock", module: "Stock", icon: Boxes, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { label: "Raw Materials", href: "/raw-materials/stock", module: "Stock", icon: FolderOpen, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { label: "Production", href: "/production", module: "Production", icon: Scissors, color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    { label: "Parties", href: "/parties", module: "Parties", icon: Users, color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
    { label: "Master Data", href: "/master-data/brands", module: "Master Data", icon: Sliders, color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
    { label: "Expenses", href: "/expenses", module: "Payments & Finance", icon: DollarSign, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { label: "Reports", href: "/reports", module: "Reports", icon: BarChart3, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { label: "Settings", href: "/settings", module: "Settings", icon: Settings, color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  ];

  const visibleItems = launcherItems.filter((item) => canView(item.module));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="TAS ERP Launcher" maxWidth="max-w-md">
      <div className="space-y-4 pt-1">
        <p className="text-xs text-[var(--text-muted)] font-medium">
          Select a module or quick action to navigate
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
          {visibleItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={idx}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center group cursor-pointer ${
                  isActive
                    ? "border-[var(--primary)] bg-[var(--primary-light)] shadow-xs"
                    : "border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)]"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-[var(--text-primary)] leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
