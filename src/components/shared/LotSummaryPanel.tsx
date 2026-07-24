"use client";

import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryItem {
  label: string;
  value: React.ReactNode;
  isQuantity?: boolean;
  colorHex?: string | null;
}

interface LotSummaryPanelProps {
  title?: string;
  designImage?: string | null;
  items: SummaryItem[];
}

export default function LotSummaryPanel({
  title = "Lot Summary",
  designImage,
  items,
}: LotSummaryPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-base font-semibold text-[#0F172A] mb-4">
        <BarChart2 className="h-5 w-5 text-[#6366F1]" />
        <span>{title}</span>
      </h3>

      {designImage && (
        <div className="relative w-full h-64 rounded-xl mb-4 overflow-hidden border border-[#E5E7EB] flex items-center justify-center bg-slate-100 group shadow-xs">
          {/* Full-bleed ambient color glow matching the image palette */}
          <img
            src={designImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-90 scale-125 pointer-events-none"
          />
          {/* 100% full uncropped sharp image */}
          <img
            src={designImage}
            alt="Design Thumbnail"
            className="relative z-10 max-h-full max-w-full object-contain group-hover:scale-[1.02] transition-transform duration-300 drop-shadow-md"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="flex flex-col">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-2.5 border-b border-[#F3F4F6] last:border-0"
          >
            <span className="text-sm text-[#64748B]">{item.label}</span>
            <div className="flex items-center gap-2">
              {item.colorHex && (
                <span
                  className="w-4 h-4 rounded-full border border-[#D1D5DB]"
                  style={{ backgroundColor: item.colorHex }}
                />
              )}
              <span
                className={cn(
                  "text-sm font-medium text-[#374151]",
                  item.isQuantity && "text-[#6366F1] font-semibold"
                )}
              >
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
