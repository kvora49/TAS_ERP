"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Boxes, Users, Grid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileMoreDrawer } from "./MobileMoreDrawer";

// ─── Context-aware FAB action map ─────────────────────────────────────────────
// Maps route prefixes to the action the central + button takes.
// Checked from most specific to least specific (order matters).
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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabTooltipVisible, setFabTooltipVisible] = useState(false);

  const fabAction = getFabAction(pathname);

  const triggerHaptic = () => {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(10);
      } catch (_) {}
    }
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-[var(--card-bg)] border-t border-[var(--border)] flex items-center justify-around z-40 select-none print:hidden shadow-lg backdrop-blur-md">
        {/* Home Tab */}
        <Link
          href="/"
          onClick={triggerHaptic}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 h-full text-[10px] font-semibold tracking-wider transition-colors",
            pathname === "/" ? "text-[var(--primary)] font-bold" : "text-[var(--text-muted)]"
          )}
        >
          <Home className="h-5 w-5" />
          <span>Home</span>
        </Link>

        {/* Stock Tab */}
        <Link
          href="/finished-stock"
          onClick={triggerHaptic}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 h-full text-[10px] font-semibold tracking-wider transition-colors",
            pathname.startsWith("/finished-stock") || pathname.startsWith("/raw-materials") || pathname.startsWith("/stock")
              ? "text-[var(--primary)] font-bold"
              : "text-[var(--text-muted)]"
          )}
        >
          <Boxes className="h-5 w-5" />
          <span>Stock</span>
        </Link>

        {/* Central Floating Quick Action Button — context-aware */}
        <div className="relative -top-3 flex items-center justify-center">
          {/* Tooltip on long-press */}
          {fabTooltipVisible && (
            <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--text-primary)] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg pointer-events-none z-50">
              {fabAction.label}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--text-primary)]" />
            </div>
          )}
          <Link
            href={fabAction.href}
            onClick={() => {
              triggerHaptic();
              setFabTooltipVisible(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setFabTooltipVisible(true);
              setTimeout(() => setFabTooltipVisible(false), 2000);
            }}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center shadow-lg shadow-[var(--primary)]/30 border-2 border-[var(--card-bg)] active:scale-95 transition-transform"
            title={fabAction.label}
            aria-label={fabAction.label}
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </Link>
        </div>

        {/* Parties Tab */}
        <Link
          href="/parties"
          onClick={triggerHaptic}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 h-full text-[10px] font-semibold tracking-wider transition-colors",
            pathname.startsWith("/parties") ? "text-[var(--primary)] font-bold" : "text-[var(--text-muted)]"
          )}
        >
          <Users className="h-5 w-5" />
          <span>Parties</span>
        </Link>

        {/* More Tab */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setDrawerOpen(true);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 h-full text-[10px] font-semibold tracking-wider transition-colors cursor-pointer",
            drawerOpen ? "text-[var(--primary)] font-bold" : "text-[var(--text-muted)]"
          )}
        >
          <Grid className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* PWA Launcher Sheet */}
      <MobileMoreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
