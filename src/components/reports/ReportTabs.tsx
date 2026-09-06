"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

export interface ReportTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
}

interface ReportTabsProps<T extends string = string> {
  tabs: ReportTabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  layoutIdPrefix?: string;
  size?: "sm" | "md";
}

export default function ReportTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className,
  layoutIdPrefix = "report-tabs",
  size = "md",
}: ReportTabsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [tabs]);

  const scroll = (direction: "left" | "right") => {
    if (!containerRef.current) return;
    const offset = direction === "left" ? -180 : 180;
    containerRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <div className={cn("relative group border-b border-[var(--border)] -mt-2 print:hidden", className)}>
      {/* Scroll indicator - Left */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[var(--card-bg)] border border-[var(--border)] shadow-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          aria-label="Scroll left"
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Left gradient fade cue */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--page-bg)] to-transparent pointer-events-none z-[5]" />
      )}

      {/* Tabs container */}
      <div
        ref={containerRef}
        onScroll={checkScroll}
        className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 px-1 sm:px-0"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                onChange(tab.id);
              }}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer shrink-0",
                size === "sm" ? "px-2.5 py-1.5 text-[11px] font-semibold" : "px-3.5 py-2 text-xs font-bold",
                isActive
                  ? "text-[var(--primary)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] border border-[var(--border)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--card-bg)]/50"
              )}
            >
              {tab.icon && <span className={cn(isActive ? "text-[var(--primary)]" : "text-[var(--text-faint)]")}>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== 0 && (
                <span
                  className={cn(
                    "text-[10px] font-extrabold px-1.5 py-0.5 rounded-full",
                    tab.badgeColor ?? "bg-[var(--primary-light)] text-[var(--primary)]"
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId={`${layoutIdPrefix}-indicator`}
                  className="absolute -bottom-1 left-2 right-2 h-0.5 bg-[var(--primary)] rounded-full"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right gradient fade cue */}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--page-bg)] to-transparent pointer-events-none z-[5]" />
      )}

      {/* Scroll indicator - Right */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[var(--card-bg)] border border-[var(--border)] shadow-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
          aria-label="Scroll right"
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
