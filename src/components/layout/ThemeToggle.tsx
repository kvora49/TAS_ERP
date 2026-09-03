"use client";

import { useEffect } from "react";
import { Sun, Monitor, Moon } from "lucide-react";
import { useThemeStore, Theme } from "@/store/theme";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, setTheme, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (useThemeStore.getState().theme === "system") {
        initTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [initTheme]);

  // Synchronize browser <meta name="theme-color"> with active app theme
  useEffect(() => {
    if (typeof document !== "undefined") {
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark" ||
        document.documentElement.classList.contains("dark");

      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute("content", isDark ? "#0F172A" : "#F1F5F9");
    }
  }, [theme]);

  const handleSelect = (t: Theme) => {
    triggerHaptic("selection");
    setTheme(t);
  };

  const toggleCompact = () => {
    triggerHaptic("selection");
    if (typeof document !== "undefined") {
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark" ||
        document.documentElement.classList.contains("dark");
      setTheme(isDark ? "light" : "dark");
    } else {
      setTheme(theme === "dark" ? "light" : "dark");
    }
  };

  return (
    <>
      {/* Mobile-only Single Tactile Toggle (< sm) */}
      <button
        type="button"
        onClick={toggleCompact}
        aria-label="Toggle theme"
        className={cn(
          "sm:hidden w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-all cursor-pointer touch-ripple active:scale-95 shrink-0",
          compact && "flex"
        )}
      >
        <Sun size={15} className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
        <Moon size={15} className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-indigo-400" />
      </button>

      {/* Desktop 3-Button Segmented Selector (>= sm) */}
      <div
        className={cn(
          "hidden sm:flex items-center gap-0.5 p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-xs",
          compact && "!hidden"
        )}
      >
        <button
          type="button"
          title="Light mode"
          onClick={() => handleSelect("light")}
          className={cn(
            "p-1.5 rounded-md transition-colors cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            theme === "light" && "bg-[var(--primary-light)] text-[var(--primary)] font-bold shadow-xs"
          )}
        >
          <Sun size={14} />
        </button>

        <button
          type="button"
          title="System preference"
          onClick={() => handleSelect("system")}
          className={cn(
            "p-1.5 rounded-md transition-colors cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            theme === "system" && "bg-[var(--primary-light)] text-[var(--primary)] font-bold shadow-xs"
          )}
        >
          <Monitor size={14} />
        </button>

        <button
          type="button"
          title="Dark mode"
          onClick={() => handleSelect("dark")}
          className={cn(
            "p-1.5 rounded-md transition-colors cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            theme === "dark" && "bg-[var(--primary-light)] text-[var(--primary)] font-bold shadow-xs"
          )}
        >
          <Moon size={14} />
        </button>
      </div>
    </>
  );
}
