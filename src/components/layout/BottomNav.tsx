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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0F1629] border-t border-[#1E293B] flex items-center justify-around z-40 select-none pb-safe print:hidden">
        {/* Home Tab */}
        <Link
          href="/"
          onClick={triggerHaptic}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-14 h-full text-[10px] font-semibold tracking-wider transition-colors",
            pathname === "/" ? "text-[#6366F1]" : "text-[#94A3B8]"
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
            pathname.startsWith("/finished-stock") || pathname.startsWith("/raw-materials")
              ? "text-[#6366F1]"
              : "text-[#94A3B8]"
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
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center shadow-lg shadow-[#6366F1]/40 border-2 border-[#0F1629] active:scale-95 transition-transform"
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
            pathname.startsWith("/parties") ? "text-[#6366F1]" : "text-[#94A3B8]"
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
            drawerOpen ? "text-[#6366F1]" : "text-[#94A3B8]"
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
