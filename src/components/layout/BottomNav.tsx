"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingBag, Boxes, Grid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { MobileMoreDrawer } from "./MobileMoreDrawer";

// ─── Context-aware FAB action map ─────────────────────────────────────────────
const FAB_ROUTES: Array<{ prefix: string; exact?: boolean; href: string; label: string }> = [
  // Sales
  { prefix: "/sales/bills",              href: "/sales/bills/new",              label: "New Invoice"     },
  { prefix: "/sales/returns",            href: "/sales/returns/new",            label: "New Return"      },
  { prefix: "/sales/orders",             href: "/sales/orders/new",             label: "New Order"       },
  // Purchases
  { prefix: "/purchases",                href: "/purchases/new",                label: "New Purchase"    },
  // Parties
  { prefix: "/parties",                  href: "/parties/new",                  label: "New Party"       },
  // Production
  { prefix: "/production/stage-entries", href: "/production/stage-entries/new", label: "New Entry"      },
  { prefix: "/production/job-work",      href: "/production/job-work/list/new", label: "New Job Work"   },
  { prefix: "/production/lots",          href: "/production/lots/new",          label: "New Lot"         },
  // Stock & Raw Materials
  { prefix: "/raw-materials/purchases",  href: "/raw-materials/purchases/new",  label: "New RM Purchase" },
  { prefix: "/finished-stock",           href: "/finished-stock/designs",       label: "View Designs"    },
  // Finance
  { prefix: "/payments",                 href: "/payments/make",                label: "Make Payment"    },
  { prefix: "/expenses",                 href: "/expenses",                     label: "Add Expense"     },
  { prefix: "/salary",                   href: "/salary/process",               label: "Process Salary"  },
  // Default (dashboard or anything else)
  { prefix: "/",                         href: "/sales/bills/new",              label: "New Invoice"     },
];

function getFabAction(pathname: string): { href: string; label: string } {
  for (const route of FAB_ROUTES) {
    if (pathname.startsWith(route.prefix)) {
      return { href: route.href, label: route.label };
    }
  }
  return { href: "/sales/bills/new", label: "New Invoice" };
}

export default function BottomNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabTooltipVisible, setFabTooltipVisible] = useState(false);

  const fabAction = getFabAction(pathname);

  const isHome = pathname === "/";
  const isSales = pathname.startsWith("/sales");
  const isStock =
    pathname.startsWith("/finished-stock") ||
    pathname.startsWith("/raw-materials") ||
    pathname.startsWith("/stock");

  // Automatically hide bottom navigation on full-screen form pages so virtual keyboards and sticky action bars have full view
  const isFormRoute =
    pathname.endsWith("/new") ||
    pathname.endsWith("/edit") ||
    pathname.includes("/new/") ||
    pathname.includes("/edit/");

  if (isFormRoute) {
    return null;
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-[var(--card-bg)] border-t border-[var(--border)] flex items-center justify-around z-40 select-none print:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {/* 1. Home Tab */}
        <Link
          href="/"
          onClick={() => triggerHaptic("selection")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[56px] h-full text-[11px] font-bold tracking-tight transition-all active:scale-90",
            isHome ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          <div className="relative flex items-center justify-center">
            <Home className="h-5 w-5 stroke-[2.2]" />
            {isHome && (
              <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary)] animate-pulse" />
            )}
          </div>
          <span>Home</span>
        </Link>

        {/* 2. Sales Tab */}
        <Link
          href="/sales/bills"
          onClick={() => triggerHaptic("selection")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[56px] h-full text-[11px] font-bold tracking-tight transition-all active:scale-90",
            isSales ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          <div className="relative flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 stroke-[2.2]" />
            {isSales && (
              <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary)] animate-pulse" />
            )}
          </div>
          <span>Sales</span>
        </Link>

        {/* 3. Central Floating Action Button (FAB) */}
        <div className="relative -top-3.5 flex items-center justify-center">
          {/* Tooltip on long-press (Dark mode safe: uses card-bg and text-primary) */}
          {fabTooltipVisible && (
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border)] text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-2xl pointer-events-none z-50">
              {fabAction.label}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--card-bg)]" />
            </div>
          )}
          <Link
            href={fabAction.href}
            onClick={() => {
              triggerHaptic("impactMedium");
              setFabTooltipVisible(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setFabTooltipVisible(true);
              setTimeout(() => setFabTooltipVisible(false), 2500);
            }}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-[var(--primary-dark)] to-[var(--primary)] text-white flex items-center justify-center shadow-lg shadow-[var(--primary)]/35 border-2 border-[var(--card-bg)] active:scale-90 transition-transform touch-ripple"
            title={fabAction.label}
            aria-label={fabAction.label}
          >
            <Plus className="h-6 w-6 stroke-[2.8]" />
          </Link>
        </div>

        {/* 4. Stock Tab */}
        <Link
          href="/finished-stock"
          onClick={() => triggerHaptic("selection")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[56px] h-full text-[11px] font-bold tracking-tight transition-all active:scale-90",
            isStock ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          <div className="relative flex items-center justify-center">
            <Boxes className="h-5 w-5 stroke-[2.2]" />
            {isStock && (
              <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary)] animate-pulse" />
            )}
          </div>
          <span>Stock</span>
        </Link>

        {/* 5. More Launcher Tab */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("selection");
            setDrawerOpen(true);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 min-w-[56px] h-full text-[11px] font-bold tracking-tight transition-all active:scale-90 cursor-pointer",
            drawerOpen ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          )}
        >
          <div className="relative flex items-center justify-center">
            <Grid className="h-5 w-5 stroke-[2.2]" />
            {drawerOpen && (
              <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-[var(--primary)] animate-pulse" />
            )}
          </div>
          <span>More</span>
        </button>
      </nav>

      {/* PWA Launcher Sheet (Swipeable Bottom Sheet) */}
      <MobileMoreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
