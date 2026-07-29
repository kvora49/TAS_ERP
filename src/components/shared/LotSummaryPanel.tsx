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
    <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-5 shadow-[var(--shadow-sm)]">
      <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)] mb-4">
        <BarChart2 className="h-5 w-5 text-[var(--primary)]" />
        <span>{title}</span>
      </h3>

      {designImage && (
        <div className="relative w-full h-64 rounded-xl mb-4 overflow-hidden border border-[var(--border)] flex items-center justify-center bg-[var(--page-bg)] group shadow-xs">
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
            className="flex items-center justify-between py-2.5 border-b border-[var(--border-light)] last:border-0"
          >
            <span className="text-sm text-[var(--text-muted)]">{item.label}</span>
            <div className="flex items-center gap-2">
              {item.colorHex && (
                <span
                  className="w-4 h-4 rounded-full border border-[var(--border)]"
                  style={{ backgroundColor: item.colorHex }}
                />
              )}
              <span
                className={cn(
                  "text-sm font-medium text-[var(--text-body)]",
                  item.isQuantity && "text-[var(--primary)] font-semibold"
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
