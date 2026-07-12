"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Layers,
  Percent,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Scissors,
  FileText,
  Sliders,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface RawMaterial {
  id: string;
  name: string;
  category: string;
  unit: string;
  is_active: boolean;
}

interface Design {
  id: string;
  name: string;
  design_number: string;
  is_active: boolean;
  brand?: {
    name: string;
  };
}

interface GstRate {
  id: string;
  hsn_code: string;
  description: string | null;
  gst_percent: number;
  auto_tier: boolean;
  tier_threshold: number | null;
  tier_low_gst: number | null;
  tier_high_gst: number | null;
  is_active: boolean;
}

interface GstRateDetailResponse {
  gstRate: GstRate;
  rawMaterials: RawMaterial[];
  designs: Design[];
}

export default function GstRateDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("materials");

  const { data: detailData, isLoading, error } = useQuery<GstRateDetailResponse>({
    queryKey: ["gst-rate-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/gst-rates/${id}`);
      if (!res.ok) throw new Error("Failed to fetch GST rate details");
      return res.json();
    },
  });

  const isDataStale = detailData && detailData.gstRate.id !== id;

  if (isLoading || isDataStale) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#64748B]">Loading GST rate profile...</p>
        </div>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-[#0F172A]">Error Loading GST Rate</h3>
        <p className="text-sm text-[#64748B]">{error?.toString() || "GST Rate not found"}</p>
        <button
          onClick={() => router.push("/master-data/gst-rates")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
        >
          Back to GST Rates
        </button>
      </div>
    );
  }

  const { gstRate, rawMaterials, designs } = detailData;

  return (
    <div className="p-6 space-y-6">
      {/* Navigation breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-bold text-[#64748B] select-none">
        <Link href="/" className="hover:text-[#0F172A] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} />
        <span>Master Data</span>
        <ChevronRight size={12} />
        <Link href="/master-data/gst-rates" className="hover:text-[#0F172A] transition-colors">
          GST Rates
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#0F172A]">HSN {gstRate.hsn_code}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10" />

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-xl shadow-sm">
            <Percent size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">HSN / SAC: {gstRate.hsn_code}</h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  gstRate.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                }`}
              >
                {gstRate.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] font-semibold">
              {gstRate.description && (
                <span className="text-sm font-medium text-[#475569]">{gstRate.description}</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push(`/master-data/gst-rates`)}
          className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ArrowLeft size={14} /> Back to List
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Base Rate</span>
            <span className="text-lg font-black text-[#1E293B]">{gstRate.gst_percent}%</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Raw Materials</span>
            <span className="text-lg font-black text-[#1E293B]">{rawMaterials.length}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Catalog Designs</span>
            <span className="text-lg font-black text-[#1E293B]">{designs.length}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600 shrink-0">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Auto-Tiering</span>
            <span className="text-lg font-black text-[#1E293B]">{gstRate.auto_tier ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex gap-1 border-b border-[#E2E8F0] pb-px select-none">
        <button
          onClick={() => setActiveTab("materials")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "materials"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Referenced Raw Materials ({rawMaterials.length})
        </button>
        <button
          onClick={() => setActiveTab("designs")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "designs"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Referenced Catalog Designs ({designs.length})
        </button>
        {gstRate.auto_tier && (
          <button
            onClick={() => setActiveTab("tiering")}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "tiering"
                ? "border-[#6366F1] text-[#6366F1]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            Tiering Rules
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "materials" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5">Material Name</th>
                  <th className="py-3 px-5 w-48">Category</th>
                  <th className="py-3 px-5 w-44">Default Unit</th>
                  <th className="py-3 px-5 text-center w-36">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {rawMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#64748B]">
                      No raw materials reference this HSN/SAC code.
                    </td>
                  </tr>
                ) : (
                  rawMaterials.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/master-data/raw-materials`)} // Row click goes to raw material page
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-bold text-[#0F172A]">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="bg-slate-100 text-[#475569] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                          {item.category || "Other"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-[#475569]">
                        {item.unit}
                      </td>
                      <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            item.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "designs" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5 w-40">Design Number</th>
                  <th className="py-3 px-5">Design Name</th>
                  <th className="py-3 px-5">Brand</th>
                  <th className="py-3 px-5 text-center w-36">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {designs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#64748B]">
                      No catalog designs reference this HSN/SAC code.
                    </td>
                  </tr>
                ) : (
                  designs.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/master-data/designs`)} // Row click goes to designs page
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#6366F1]">
                        {item.design_number}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                        {item.name}
                      </td>
                      <td className="py-3.5 px-5 font-medium text-[#475569]">
                        {item.brand?.name || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            item.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-red-50 text-red-700 border border-red-100"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "tiering" && gstRate.auto_tier && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4 max-w-xl">
          <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
            Auto-Tiering Rules
          </h3>
          <p className="text-xs text-[#64748B] leading-relaxed">
            When sale price/value per piece matches the threshold, the system dynamically swaps the applicable tax rate during sales billing.
          </p>
          <div className="grid grid-cols-3 gap-4 text-xs pt-2">
            <div>
              <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                Threshold Limit
              </span>
              <span className="text-sm font-bold text-[#1E293B] font-mono">
                ₹{gstRate.tier_threshold?.toLocaleString() || "0"}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                Low Tier GST % (Below Threshold)
              </span>
              <span className="text-sm font-bold text-emerald-600 font-mono">
                {gstRate.tier_low_gst}%
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                High Tier GST % (Above Threshold)
              </span>
              <span className="text-sm font-bold text-indigo-600 font-mono">
                {gstRate.tier_high_gst}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
