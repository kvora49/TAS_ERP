"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Users,
  Package,
  Layers,
  Factory,
  Bell,
  CreditCard,
  BarChart3,
  QrCode,
  Settings,
  PlusCircle,
  SunMoon,
  ArrowRight,
  Sparkles,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useThemeStore } from "@/store/theme";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Quick Actions" | "System";
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  // Global shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            triggerHaptic("selection");
          }
          return !prev;
        });
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => [
    // Quick Actions
    {
      id: "action-new-bill",
      title: "New Sales Bill",
      category: "Quick Actions",
      icon: <PlusCircle size={16} className="text-emerald-500" />,
      action: () => router.push("/sales/bills/new"),
    },
    {
      id: "action-new-purchase",
      title: "New Purchase Bill",
      category: "Quick Actions",
      icon: <PlusCircle size={16} className="text-blue-500" />,
      action: () => router.push("/purchases/new"),
    },
    {
      id: "action-new-lot",
      title: "Start Production Lot",
      category: "Quick Actions",
      icon: <Layers size={16} className="text-amber-500" />,
      action: () => router.push("/production/lots/new"),
    },
    {
      id: "action-scan",
      title: "Scan Barcode / QR Code",
      category: "Quick Actions",
      icon: <QrCode size={16} className="text-purple-500" />,
      shortcut: "S",
      action: () => router.push("/scan"),
    },
    {
      id: "action-new-party",
      title: "Add New Party / Customer / Supplier",
      category: "Quick Actions",
      icon: <Users size={16} className="text-indigo-500" />,
      action: () => router.push("/parties/new"),
    },
    // Navigation
    {
      id: "nav-dashboard",
      title: "Dashboard Overview",
      category: "Navigation",
      icon: <LayoutDashboard size={16} />,
      action: () => router.push("/"),
    },
    {
      id: "nav-sales-bills",
      title: "Sales Bills & Invoices",
      category: "Navigation",
      icon: <FileText size={16} />,
      action: () => router.push("/sales/bills"),
    },
    {
      id: "nav-sales-orders",
      title: "Sales Orders & Bookings",
      category: "Navigation",
      icon: <ShoppingCart size={16} />,
      action: () => router.push("/sales/orders"),
    },
    {
      id: "nav-parties",
      title: "Parties & Ledger Directory",
      category: "Navigation",
      icon: <Users size={16} />,
      action: () => router.push("/parties"),
    },
    {
      id: "nav-purchases",
      title: "Purchases & Inward Register",
      category: "Navigation",
      icon: <Package size={16} />,
      action: () => router.push("/purchases"),
    },
    {
      id: "nav-production-lots",
      title: "Production Lots & Floor Tracking",
      category: "Navigation",
      icon: <Factory size={16} />,
      action: () => router.push("/production/lots"),
    },
    {
      id: "nav-finished-stock",
      title: "Finished Goods Stock & Inventory",
      category: "Navigation",
      icon: <Layers size={16} />,
      action: () => router.push("/finished-stock"),
    },
    {
      id: "nav-raw-materials",
      title: "Raw Material Fabric & Accessories",
      category: "Navigation",
      icon: <Package size={16} />,
      action: () => router.push("/stock/raw-materials"),
    },
    {
      id: "nav-reminders",
      title: "Reminders & WhatsApp Hub",
      category: "Navigation",
      icon: <Bell size={16} />,
      action: () => router.push("/reminders"),
    },
    {
      id: "nav-expenses",
      title: "Expenses & Petty Cash Register",
      category: "Navigation",
      icon: <DollarSign size={16} />,
      action: () => router.push("/expenses"),
    },
    {
      id: "nav-cheques",
      title: "Cheques & PDC Register",
      category: "Navigation",
      icon: <CreditCard size={16} />,
      action: () => router.push("/finance/cheques"),
    },
    {
      id: "nav-reports-sales",
      title: "Sales Reports & Analytics",
      category: "Navigation",
      icon: <BarChart3 size={16} />,
      action: () => router.push("/reports/sales"),
    },
    {
      id: "nav-reports-financial",
      title: "Financial & Ledger Statements",
      category: "Navigation",
      icon: <BarChart3 size={16} />,
      action: () => router.push("/reports/party-reports"),
    },
    {
      id: "nav-audit-logs",
      title: "System Audit Logs & Security Trail",
      category: "Navigation",
      icon: <ShieldCheck size={16} />,
      action: () => router.push("/settings/audit-logs"),
    },
    {
      id: "nav-settings",
      title: "Company Profile & ERP Settings",
      category: "Navigation",
      icon: <Settings size={16} />,
      action: () => router.push("/settings/company-profile"),
    },
    // System
    {
      id: "sys-toggle-theme",
      title: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      category: "System",
      icon: <SunMoon size={16} className="text-amber-500" />,
      action: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
  ], [router, theme, setTheme]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase().trim();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const handleSelect = (item: CommandItem) => {
    triggerHaptic("impactLight");
    setIsOpen(false);
    item.action();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      triggerHaptic("selection");
      setSelectedIndex((prev) => (prev + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      triggerHaptic("selection");
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4 animate-in fade-in duration-150"
      style={{ background: "var(--modal-backdrop)" }}
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-xl bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--modal-shadow)] overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--card-bg)]">
          <Search className="h-5 w-5 text-[var(--text-faint)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search screens..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-0 text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm font-medium focus:outline-none focus:ring-0"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold text-[var(--text-muted)] bg-[var(--page-bg)] border border-[var(--border)] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] sm:max-h-[360px] overflow-y-auto p-2 divide-y divide-[var(--border-light)]">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No matching commands or destinations found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-xs font-medium",
                    isSelected
                      ? "bg-[var(--primary)] text-white shadow-xs"
                      : "text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                      )}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{item.title}</p>
                      <p
                        className={cn(
                          "text-[10px] uppercase tracking-wider font-semibold",
                          isSelected ? "text-white/80" : "text-[var(--text-faint)]"
                        )}
                      >
                        {item.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd
                        className={cn(
                          "px-1.5 py-0.5 text-[10px] font-mono font-bold rounded",
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)]"
                        )}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight
                      size={13}
                      className={cn(
                        "transition-transform",
                        isSelected ? "translate-x-0.5 text-white" : "opacity-0"
                      )}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[var(--page-bg)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              Use <kbd className="font-mono font-bold text-[var(--text-primary)]">↑</kbd>{" "}
              <kbd className="font-mono font-bold text-[var(--text-primary)]">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono font-bold text-[var(--text-primary)]">↵</kbd> to select
            </span>
          </div>
          <span className="font-semibold text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            TAS ERP
          </span>
        </div>
      </div>
    </div>
  );
}
