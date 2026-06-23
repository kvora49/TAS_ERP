"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings2, Boxes, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Master Data", href: "/master-data/brands", icon: Settings2 },
    { label: "Stock", href: "/finished-stock", icon: Boxes },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0F1629] border-t border-[#1E293B] flex items-center justify-around z-40 select-none pb-safe">
      {navItems.map((item, idx) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href.split("/")[1]);

        return (
          <Link
            key={idx}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 w-16 h-full text-[10px] font-semibold tracking-wider",
              isActive ? "text-[#6366F1]" : "text-[#94A3B8]"
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
