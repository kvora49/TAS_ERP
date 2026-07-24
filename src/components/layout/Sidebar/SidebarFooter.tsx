"use client";

import { ShoppingBag, Package } from "lucide-react";

interface SidebarFooterProps {
  sidebarOpen: boolean;
  quickStats: {
    totalDesigns: number;
    totalStock: number;
  };
}

export function SidebarFooter({ sidebarOpen, quickStats }: SidebarFooterProps) {
  if (!sidebarOpen) return null;

  return (
    <div className="bg-[#0B101D] border-t border-[#1E293B] p-3 shrink-0">
      <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
        Quick Stats
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-[#E2E8F0] font-bold">
          <ShoppingBag className="h-4 w-4 text-[#818CF8]" />
          <span>{quickStats.totalDesigns} Total Designs</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-medium">
          <Package className="h-4 w-4 text-[#818CF8]" />
          <span>{quickStats.totalStock.toLocaleString()} Total Stock (Pcs)</span>
        </div>
      </div>
    </div>
  );
}
