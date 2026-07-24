"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { NavItem, isWhitelisted, handlePrefetch } from "./navigation.config";
import { QueryClient } from "@tanstack/react-query";

interface SidebarItemProps {
  item: NavItem;
  navigatingTo: string | null;
  setNavigatingTo: (val: string | null) => void;
  expandedMenus: Record<string, boolean>;
  toggleSubMenu: (name: string) => void;
  queryClient: QueryClient;
  toast: any;
}

export function SidebarItem({
  item,
  navigatingTo,
  setNavigatingTo,
  expandedMenus,
  toggleSubMenu,
  queryClient,
  toast,
}: SidebarItemProps) {
  const pathname = usePathname();

  const isPathActive = (href?: string) => {
    if (!href) return false;
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isItemActive = item.href
    ? isPathActive(item.href) || navigatingTo === item.href
    : item.subItems?.some(
        (s) =>
          isPathActive(s.href) ||
          navigatingTo === s.href ||
          s.subItems?.some((ss) => isPathActive(ss.href) || navigatingTo === ss.href)
      );

  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
    if (!href) return;

    if (pathname === href) {
      e.preventDefault();
      return;
    }

    if (!isWhitelisted(href)) {
      e.preventDefault();
      toast.info("This feature is coming soon!");
      return;
    }

    if (navigatingTo) {
      e.preventDefault();
      return;
    }

    setNavigatingTo(href);
  };

  const Icon = item.icon;
  const isExpandable = !!item.subItems;
  const isMenuOpen = expandedMenus[item.name];

  return (
    <div className="space-y-1">
      {isExpandable ? (
        <button
          type="button"
          onClick={() => toggleSubMenu(item.name)}
          className={cn(
            "w-[calc(100%-16px)] flex items-center justify-between px-3 py-2.5 rounded-lg mx-2 text-sm font-medium transition-all duration-200 cursor-pointer text-left",
            isItemActive
              ? item.name === "Settings"
                ? "text-white bg-[#312E81]"
                : "text-white bg-[#1E1B4B]"
              : "text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white"
          )}
        >
          <div className="flex items-center gap-3">
            {Icon && <Icon className="h-[18px] w-[18px]" />}
            <span>{item.name}</span>
          </div>
          {item.name === "Settings" ? (
            isMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />
          ) : (
            isMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </button>
      ) : (
        <a
          href={item.href || "#"}
          onClick={(e) => handleNavigation(e as any, item.href)}
          onMouseEnter={() => item.href && handlePrefetch(item.href, queryClient)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 text-sm font-medium transition-all duration-200 cursor-pointer",
            isPathActive(item.href) || navigatingTo === item.href
              ? "bg-[#312E81] text-white"
              : "text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white"
          )}
        >
          {Icon && <Icon className="h-[18px] w-[18px]" />}
          <span>
            {item.name}
            {item.href && (item.href === "/dispatch-soon" || item.href === "/stock-soon") && " (Soon)"}
            {navigatingTo === item.href ? " (Loading...)" : ""}
          </span>
        </a>
      )}

      {/* Subitems container */}
      {isExpandable && isMenuOpen && (
        <div className={cn(item.name === "Settings" ? "space-y-1 mt-1" : "pl-9 space-y-1.5 pr-2")}>
          {item.subItems?.map((sub, sIdx) => {
            const hasSubSub = !!sub.subItems;
            const isSubSubOpen = expandedMenus[sub.name];
            const isSubActive = sub.href
              ? isPathActive(sub.href) || navigatingTo === sub.href
              : sub.subItems?.some((ss) => isPathActive(ss.href) || navigatingTo === ss.href);

            if (hasSubSub) {
              return (
                <div key={sIdx} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSubMenu(sub.name)}
                    className={cn(
                      "w-full flex items-center justify-between py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer text-left",
                      isSubActive
                        ? "text-white bg-[#1E1B4B]"
                        : "text-[#94A3B8] hover:text-white hover:bg-[#1E1B4B]/55"
                    )}
                  >
                    <span>{sub.name}</span>
                    {isSubSubOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>

                  {isSubSubOpen && (
                    <div className="pl-3 space-y-1 mt-1">
                      {sub.subItems?.map((subSub, ssIdx) => {
                        const isSubSubActive = isPathActive(subSub.href) || navigatingTo === subSub.href;
                        return (
                          <a
                            key={ssIdx}
                            href={subSub.href}
                            onClick={(e) => handleNavigation(e as any, subSub.href)}
                            onMouseEnter={() => handlePrefetch(subSub.href, queryClient)}
                            className={cn(
                              "block py-1.5 pl-6 pr-3 rounded-md text-[11px] font-semibold tracking-wide transition-all cursor-pointer",
                              isSubSubActive
                                ? "text-white bg-[#312E81]"
                                : "text-[#94A3B8]/80 hover:text-white hover:bg-[#1E1B4B]/40"
                            )}
                          >
                            {subSub.name}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.name === "Settings") {
              return (
                <a
                  key={sIdx}
                  href={sub.href || "#"}
                  onClick={(e) => handleNavigation(e as any, sub.href)}
                  onMouseEnter={() => sub.href && handlePrefetch(sub.href, queryClient)}
                  className={cn(
                    "flex items-center gap-2.5 pl-9 pr-3 py-2 rounded-lg mx-2 text-sm font-medium transition-all duration-200 cursor-pointer",
                    isSubActive
                      ? "bg-[#312E81] text-white"
                      : "text-[#94A3B8] hover:bg-[#1E1B4B] hover:text-white"
                  )}
                >
                  <span>{sub.name}</span>
                </a>
              );
            }

            return (
              <a
                key={sIdx}
                href={sub.href || "#"}
                onClick={(e) => handleNavigation(e as any, sub.href)}
                onMouseEnter={() => sub.href && handlePrefetch(sub.href, queryClient)}
                className={cn(
                  "block py-1.5 px-3 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer",
                  isSubActive
                    ? "text-white bg-[#312E81]"
                    : "text-[#94A3B8] hover:text-white hover:bg-[#1E1B4B]/55"
                )}
              >
                {sub.name}
                {navigatingTo === sub.href ? " (Loading...)" : ""}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
