"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Layers, Calculator, Calendar, Filter, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DesignNavigationTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const designId = searchParams.get("design_id");

  const querySuffix = designId ? `?design_id=${designId}` : "";

  const tabs = [
    {
      name: "All Designs",
      href: `/master-data/designs${querySuffix}`,
      basePath: "/master-data/designs",
      icon: Layers,
      exact: true,
    },
    {
      name: "Design Stock Filters",
      href: `/master-data/designs/stock${querySuffix}`,
      basePath: "/master-data/designs/stock",
      icon: Filter,
      exact: false,
    },
    {
      name: "Costing Calculator",
      href: `/master-data/designs/costing${querySuffix}`,
      basePath: "/master-data/designs/costing",
      icon: Calculator,
      exact: false,
    },
    {
      name: "Notes & Reminders",
      href: `/master-data/designs/notes${querySuffix}`,
      basePath: "/master-data/designs/notes",
      icon: Calendar,
      exact: false,
    },
  ];

  // Back button URL target
  const backTarget = designId
    ? `/master-data/designs/${designId}`
    : "/master-data/designs";

  const showBackButton = pathname !== "/master-data/designs" || !!designId;

  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] mb-6 pb-2.5 overflow-x-auto scrollbar-none">
      {showBackButton && (
        <Link
          href={backTarget}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-body)] bg-[var(--card-bg)] hover:bg-[var(--page-bg)] border border-[var(--border)] shadow-xs transition-all shrink-0 cursor-pointer"
          title={designId ? "Back to Design Details" : "Back to Designs Master"}
        >
          <ArrowLeft className="h-4 w-4 text-[var(--primary)]" />
          <span>{designId ? "Back to Design" : "Back to Designs"}</span>
        </Link>
      )}

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.exact
            ? pathname === tab.basePath
            : pathname.startsWith(tab.basePath);

          return (
            <Link
              key={tab.basePath}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                isActive
                  ? "bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/20 font-bold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] border border-transparent hover:border-[var(--border)]"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
