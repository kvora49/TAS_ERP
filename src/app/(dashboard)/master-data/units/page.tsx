"use client";

import Link from "next/link";
import { ChevronRight, Ruler } from "lucide-react";

export default function UnitsPage() {
  return (
    <div className="p-6 space-y-6 select-none">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-semibold uppercase tracking-wider">
        <Link href="/" className="hover:text-[#6366F1] transition-colors">
          Master Data
        </Link>
        <ChevronRight size={12} className="text-[#94A3B8]" />
        <span className="text-[#374151]">Units</span>
      </nav>

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <Ruler className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-[#0F172A] mb-1">Units of Measurement</h2>
        <p className="text-sm text-[#64748B] max-w-sm text-center mb-6">
          Define standard units like Metre, Kg, Pcs, Roll, and Box for raw material inventory and production tracking.
        </p>
        <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
