"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Boxes, Users, Grid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileMoreDrawer } from "./MobileMoreDrawer";

export default function BottomNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const triggerHaptic = () => {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(10);
      } catch (_) {}
    }
  };

  const navItems = [
    { label: "Home", href: "/", icon: Home, matchPrefix: false },
    { label: "Stock", href: "/finished-stock", icon: Boxes, matchPrefix: true },
    { label: "Parties", href: "/parties", icon: Users, matchPrefix: true },
  ];

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

        {/* Central Floating Quick Action Button */}
        <div className="relative -top-3 flex items-center justify-center">
          <Link
            href="/sales/bills/new"
            onClick={triggerHaptic}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center shadow-lg shadow-[var(--primary)]/30 border-2 border-[var(--card-bg)] active:scale-95 transition-transform"
            title="Create New Invoice"
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
