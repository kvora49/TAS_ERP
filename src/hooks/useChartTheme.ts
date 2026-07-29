"use client";

import { useEffect, useState } from "react";

export interface ChartTheme {
  grid: string;
  axisText: string;
  tooltipBg: string;
  tooltipBorder: string;
  text: string;
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>({
    grid: "#E5E7EB",
    axisText: "#64748B",
    tooltipBg: "#FFFFFF",
    tooltipBorder: "#E5E7EB",
    text: "#0F172A",
  });

  useEffect(() => {
    const updateTheme = () => {
      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark" ||
        document.documentElement.classList.contains("dark");

      if (isDark) {
        setTheme({
          grid: "#334155",
          axisText: "#94A3B8",
          tooltipBg: "#1E293B",
          tooltipBorder: "#334155",
          text: "#F8FAFC",
        });
      } else {
        setTheme({
          grid: "#E5E7EB",
          axisText: "#64748B",
          tooltipBg: "#FFFFFF",
          tooltipBorder: "#E5E7EB",
          text: "#0F172A",
        });
      }
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
