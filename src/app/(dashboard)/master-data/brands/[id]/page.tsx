"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  ChevronRight,
  MapPin,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";
import ProgressBar from "@/components/shared/ProgressBar";

interface Design {
  name: string;
  code: string;
}

interface Lot {
  id: string;
  lot_number: string;
  lot_date: string;
  total_quantity: number;
  completed_quantity: number;
  status: "draft" | "in_progress" | "completed" | "on_hold" | "cancelled";
  design?: Design;
}

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  gstin: string | null;
  address: string | null;
  state: string | null;
  state_code: string | null;
  bill_prefix_pakka: string | null;
  bill_prefix_kacha: string | null;
  design_prefix: string | null;
  design_separator: string | null;
  design_digits: number | null;
  is_primary: boolean;
  is_active: boolean;
}

interface LinkedDesign {
  id: string;
  name: string;
  design_number: string;
  is_active: boolean;
  created_at: string;
}

interface StockItem {
  id: string;
  total_quantity: number;
  cost_per_piece: number;
  total_value: number;
  size_quantities: Record<string, number>;
  godown?: { id: string; name: string };
  design?: { id: string; name: string; code: string };
  colour?: { id: string; colour_name: string };
}

interface BrandDetailResponse {
  brand: Brand;
  lots: Lot[];
  designs: LinkedDesign[];
  stock: StockItem[];
}

export default function BrandDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("lots");

  const { data: detailData, isLoading, error } = useQuery<BrandDetailResponse>({
    queryKey: ["brand-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/brands/${id}`);
      if (!res.ok) throw new Error("Failed to fetch brand details");
      return res.json();
    },
  });

  const isDataStale = detailData && detailData.brand.id !== id;

  if (isLoading || isDataStale) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#64748B]">Loading brand profile...</p>
        </div>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-[#0F172A]">Error Loading Brand</h3>
        <p className="text-sm text-[#64748B]">{error?.toString() || "Brand not found"}</p>
        <button
          onClick={() => router.push("/master-data/brands")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
        >
          Back to Brands
        </button>
      </div>
    );
  }

  const { brand, lots, designs = [], stock = [] } = detailData;

  // Compute rollups
  const totalLots = lots.length;
  const activeLots = lots.filter((l) => l.status === "in_progress").length;
  const totalPlannedQty = lots.reduce((acc, curr) => acc + Number(curr.total_quantity || 0), 0);
  const totalProducedQty = lots.reduce((acc, curr) => acc + Number(curr.completed_quantity || 0), 0);

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
        <Link href="/master-data/brands" className="hover:text-[#0F172A] transition-colors">
          Brands
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#0F172A]">{brand.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10" />

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-xl shadow-sm">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain rounded-2xl" />
            ) : (
              brand.name.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">{brand.name}</h1>
              {brand.is_primary && (
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                  Primary
                </span>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  brand.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                }`}
              >
                {brand.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] font-semibold">
              {brand.gstin && (
                <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                  GST: {brand.gstin}
                </span>
              )}
              {brand.state && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-[#94A3B8]" />
                  {brand.state} ({brand.state_code || "—"})
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push(`/master-data/brands`)}
          className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ArrowLeft size={14} /> Back to List
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Total Lots</span>
            <span className="text-lg font-black text-[#1E293B]">{totalLots}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Produced Qty</span>
            <span className="text-lg font-black text-[#1E293B]">{totalProducedQty.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Active Lots</span>
            <span className="text-lg font-black text-[#1E293B]">{activeLots}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#F8FAFC] rounded-lg text-[#64748B] shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Planned Qty</span>
            <span className="text-lg font-black text-[#1E293B]">{totalPlannedQty.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex gap-1 border-b border-[#E2E8F0] pb-px select-none">
        <button
          onClick={() => setActiveTab("lots")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "lots"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Production Lots ({totalLots})
        </button>
        <button
          onClick={() => setActiveTab("designs")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "designs"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Designs ({designs.length})
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "stock"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Finished Stock ({stock.length})
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "details"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Brand Information
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "designs" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5">Design Code</th>
                  <th className="py-3 px-5">Design Name</th>
                  <th className="py-3 px-5">Created At</th>
                  <th className="py-3 px-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {designs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#64748B]">
                      No designs configured for this brand yet.
                    </td>
                  </tr>
                ) : (
                  designs.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => router.push(`/finished-stock/designs/${d.id}`)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#6366F1]">
                        {d.design_number}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                        {d.name}
                      </td>
                      <td className="py-3.5 px-5 text-[#64748B] font-mono text-xs">
                        {formatDate(d.created_at)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            d.is_active
                              ? "bg-green-100 text-green-850 text-green-700"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {d.is_active ? "Active" : "Inactive"}
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

      {activeTab === "stock" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5">Design / Style</th>
                  <th className="py-3 px-5">Colour</th>
                  <th className="py-3 px-5">Godown</th>
                  <th className="py-3 px-5 text-right">In Stock Qty</th>
                  <th className="py-3 px-5 text-right">Cost Per Piece</th>
                  <th className="py-3 px-5 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#64748B]">
                      No finished stock available for this brand&apos;s designs.
                    </td>
                  </tr>
                ) : (
                  stock.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => item.design?.id && router.push(`/finished-stock/designs/${item.design.id}`)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                        {item.design?.code ? `${item.design.code} - ${item.design.name}` : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#475569] font-medium">
                        {item.colour?.colour_name || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#475569]">
                        {item.godown?.name || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#1E293B]">
                        {item.total_quantity.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-xs text-[#475569]">
                        ₹{item.cost_per_piece ? item.cost_per_piece.toFixed(2) : "0.00"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#6366F1]">
                        ₹{item.total_value ? item.total_value.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "lots" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5 w-40">Lot Number</th>
                  <th className="py-3 px-5">Lot Date</th>
                  <th className="py-3 px-5">Design / Style</th>
                  <th className="py-3 px-5 text-right w-32">Total Qty</th>
                  <th className="py-3 px-5 w-44">Production Progress</th>
                  <th className="py-3 px-5 text-center w-36">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#64748B]">
                      No production lots have been assigned to this brand yet.
                    </td>
                  </tr>
                ) : (
                  lots.map((lot) => (
                    <tr
                      key={lot.id}
                      onClick={() => router.push(`/production/lots/${lot.id}`)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#6366F1]">
                        {lot.lot_number}
                      </td>
                      <td className="py-3.5 px-5 text-[#64748B] font-mono text-xs">
                        {formatDate(lot.lot_date)}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                        {lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-medium text-[#374151]">
                        {lot.total_quantity.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5">
                        <ProgressBar value={lot.completed_quantity} total={lot.total_quantity} />
                      </td>
                      <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            lot.status === "in_progress"
                              ? "bg-[#DBEAFE] text-[#1D4ED8]"
                              : lot.status === "completed"
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : lot.status === "on_hold"
                              ? "bg-[#FEF3C7] text-[#D97706]"
                              : lot.status === "cancelled"
                              ? "bg-[#FEE2E2] text-[#DC2626]"
                              : "bg-[#F1F5F9] text-[#64748B]"
                          }`}
                        >
                          {lot.status.replace("_", " ")}
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

      {activeTab === "details" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Billing prefixes & configurations */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
              Document Numbering Configuration
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Bill Prefix (Pakka)
                </span>
                <span className="font-mono text-sm font-semibold text-[#1E293B]">
                  {brand.bill_prefix_pakka || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Bill Prefix (Kacha)
                </span>
                <span className="font-mono text-sm font-semibold text-[#1E293B]">
                  {brand.bill_prefix_kacha || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Design Prefix
                </span>
                <span className="font-mono text-sm font-semibold text-[#1E293B]">
                  {brand.design_prefix || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Design Separator
                </span>
                <span className="font-mono text-sm font-semibold text-[#1E293B]">
                  {brand.design_separator || "."}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Design Digits
                </span>
                <span className="font-mono text-sm font-semibold text-[#1E293B]">
                  {brand.design_digits || "4"}
                </span>
              </div>
            </div>
          </div>

          {/* Legal / Contact Details */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
              Legal & Address Details
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    GSTIN
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#1E293B]">
                    {brand.gstin || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                    State (Code)
                  </span>
                  <span className="font-mono text-sm font-semibold text-[#1E293B]">
                    {brand.state ? `${brand.state} (${brand.state_code || "—"})` : "—"}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Registered Address
                </span>
                <span className="text-sm font-medium text-[#1E293B] block leading-relaxed">
                  {brand.address || "No address provided."}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
