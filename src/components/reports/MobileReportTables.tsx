"use client";

import { useEffect } from "react";

/** Preserve each cell and its column heading when tables become mobile cards. */
export default function MobileReportTables() {
  useEffect(() => {
    const root = document.querySelector(".report-surface");
    if (!root) return;
    const labelCells = () => {
      root.querySelectorAll("table").forEach(table => {
        const headings = Array.from(table.querySelectorAll("thead tr:last-child th"), h => h.textContent?.trim() || "Details");
        table.querySelectorAll("tbody tr, tfoot tr").forEach(row => {
          let column = 0;
          Array.from(row.children).forEach(cell => {
            const label = headings[column] || "Details";
            if (!cell.hasAttribute("data-column-label")) cell.setAttribute("data-column-label", label);
            column += Number(cell.getAttribute("colspan") || 1);
          });
        });
      });
    };
    labelCells();
    const observer = new MutationObserver(labelCells);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
