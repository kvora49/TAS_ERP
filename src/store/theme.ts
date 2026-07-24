import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeStore {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: "light",
      setTheme: (theme) => {
        let resolved: "light" | "dark" = "light";
        if (theme === "system") {
          resolved =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
        } else {
          resolved = theme;
        }
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", resolved);
          if (resolved === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
        set({ theme, resolvedTheme: resolved });
      },
      initTheme: () => {
        const currentTheme = get().theme;
        let resolved: "light" | "dark" = "light";
        if (currentTheme === "system") {
          resolved =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light";
        } else {
          resolved = currentTheme;
        }
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", resolved);
          if (resolved === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
        set({ resolvedTheme: resolved });
      },
    }),
    {
      name: "tas-erp-theme",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
