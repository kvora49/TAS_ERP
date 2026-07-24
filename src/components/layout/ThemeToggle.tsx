"use client";

import { useEffect } from "react";
import { Sun, Monitor, Moon } from "lucide-react";
import { useThemeStore, Theme } from "@/store/theme";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
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

  const handleSelect = (t: Theme) => {
    setTheme(t);
  };

  return (
    <div className="flex items-center gap-0.5 p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg shadow-xs">
      <button
        type="button"
        title="Light mode"
        onClick={() => handleSelect("light")}
        className={cn(
          "p-1.5 rounded-md transition-colors cursor-pointer text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]",
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
          "p-1.5 rounded-md transition-colors cursor-pointer text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]",
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
          "p-1.5 rounded-md transition-colors cursor-pointer text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]",
          theme === "dark" && "bg-[var(--primary-light)] text-[var(--primary)] font-bold shadow-xs"
        )}
      >
        <Moon size={14} />
      </button>
    </div>
  );
}
