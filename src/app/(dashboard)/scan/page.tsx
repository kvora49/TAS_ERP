"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ScanLine, Hourglass } from "lucide-react";

export default function PWAScanPlaceholderPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
        <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
          Finished Stock
        </Link>
        <span>/</span>
        <span className="text-[#334155]">PWA Scan</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/finished-stock"
          className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[#475569]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">PWA Mobile Scanner</h1>
          <p className="text-sm text-[#64748B]">Scan garment labels to verify stock levels</p>
        </div>
      </div>

      {/* Placeholder Body */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center max-w-2xl mx-auto mt-8 shadow-sm">
        <div className="w-16 h-16 bg-[#EEF2FF] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ScanLine className="h-8 w-8 text-[#6366F1]" />
        </div>
        <h2 className="text-xl font-bold text-[#1E293B] mb-2">Garment Label Scanning</h2>
        <p className="text-sm text-[#64748B] mb-6 max-w-md mx-auto leading-relaxed">
          The progressive web app mobile scanning module is currently being designed and will be deployed in a separate dedicated phase. Once deployed, you can use your device's camera to execute live godown scans.
        </p>
        <div className="inline-flex items-center gap-2 bg-[#FEF3C7] text-[#D97706] text-xs font-semibold px-3 py-1.5 rounded-full">
          <Hourglass className="h-3.5 w-3.5 animate-spin" />
          <span>Feature Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
