"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

interface SubNavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface ModuleSubNavProps {
  items: SubNavItem[];
  /** Optional className override for container */
  className?: string;
}

export function ModuleSubNav({ items, className }: ModuleSubNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex md:hidden print:hidden gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none -mx-0.5 px-0.5 select-none",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        // Match: exact or starts-with (but not just "/" matching everything)
        const isActive =
          pathname === item.href ||
          (item.href !== "/" && pathname?.startsWith(item.href + "/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => triggerHaptic("selection")}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap active:scale-95",
              isActive
                ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/20"
                : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--primary)]/30"
            )}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default ModuleSubNav;
