"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Layers,
  DollarSign,
  Boxes,
  Palette,
  Factory,
  Plus,
  ChevronRight,
  FileText,
  Tag,
  Calendar,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Edit,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import ColourDot from "@/components/shared/ColourDot";
import { cn } from "@/lib/utils";

interface Godown {
  id: string;
  name: string;
}

interface Colour {
  id: string;
  colour_name: string;
  colour_hex?: string;
  image_url?: string;
}

interface ProductionLot {
  id: string;
  lot_number: string;
  total_quantity: number;
  completed_quantity: number;
  status: string;
  created_at: string;
}

interface Design {
  id: string;
  design_number: string;
  name: string;
  category: string;
  sub_category?: string;
  season?: string;
  gender?: string;
  hsn_code?: string;
  description?: string;
  images?: string[];
  sale_price: number;
  brand?: { name: string };
  size_set?: { name: string; sizes: string[] };
}

interface DesignDetailResponse {
  design: Design;
  colours: Colour[];
  godowns: Godown[];
  matrix: Record<string, Record<string, Record<string, number>>>; // colour_id -> godown_id -> size -> qty
  colourCosts: Record<string, number>; // colour_id -> average cost
  productionLots?: ProductionLot[];
}

export default function MasterDataDesignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DesignDetailResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"matrix" | "specs" | "lots">("matrix");

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finished-stock/designs/${params.id}`);
      const json = await res.json();
      if (res.ok && json.design) {
        setData(json);
      } else {
        toast.error(json.error || "Failed to load design details");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not connect to API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Extract dimensions
  const design = data?.design;
  const colours = data?.colours || [];
  const godowns = data?.godowns || [];
  const matrix = data?.matrix || {};
  const colourCosts = data?.colourCosts || {};
  const productionLots = data?.productionLots || [];

  const sizesList = design?.size_set?.sizes || ["S", "M", "L", "XL", "XXL"];

  // Total calculations
  let grandTotalQty = 0;
  let grandTotalValue = 0;
  let weightedCostSum = 0;

  colours.forEach((c) => {
    let colourQty = 0;
    godowns.forEach((g) => {
      sizesList.forEach((s) => {
        const qty = matrix[c.id]?.[g.id]?.[s] || 0;
        colourQty += qty;
      });
    });
    grandTotalQty += colourQty;
    const cost = colourCosts[c.id] || 0;
    grandTotalValue += colourQty * cost;
    weightedCostSum += cost;
  });

  const avgCost = colours.length > 0 ? weightedCostSum / colours.length : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <Link href="/" className="hover:text-[#6366F1] transition-colors">
            Dashboard
          </Link>
          <ChevronRight size={12} className="text-slate-400" />
          <Link href="/master-data/designs" className="hover:text-[#6366F1] transition-colors">
            Master Data
          </Link>
          <ChevronRight size={12} className="text-slate-400" />
          <Link href="/master-data/designs" className="hover:text-[#6366F1] transition-colors">
            Designs
          </Link>
          <ChevronRight size={12} className="text-slate-400" />
          <span className="text-[#334155] font-extrabold">{design?.design_number || "Detail"}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/production/lots/new?design_id=${params.id}`}
            className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-[#5B63D3] hover:bg-[#4F55C3] px-4 py-2 rounded-xl transition-all shadow-md"
          >
            <Plus size={15} />
            <span>Launch Production Lot</span>
          </Link>

          <button
            onClick={fetchDetail}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-white border border-[#E2E8F0] px-3.5 py-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Header Info Card */}
      <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/master-data/designs"
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] rounded-xl transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-[#475569]" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-[#1E293B] tracking-tight">{design?.name || "Design Overview"}</h1>
              <p className="text-xs text-[#64748B] mt-0.5 font-semibold">
                Design: <strong className="text-[#334155]">{design?.design_number}</strong> • Category:{" "}
                <strong className="text-[#334155]">{design?.category || "Apparel"}</strong> • Brand:{" "}
                <strong className="text-[#334155]">{design?.brand?.name || "No Brand"}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* 3 Main Workspace Navigation Tabs */}
        <div className="border-t border-slate-100 pt-4 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("matrix")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border",
              activeTab === "matrix"
                ? "bg-[#5B63D3] text-white border-[#5B63D3] shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <Boxes size={15} />
            <span>1. Godown Stock Matrix (Image 2)</span>
          </button>

          <button
            onClick={() => setActiveTab("specs")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border",
              activeTab === "specs"
                ? "bg-[#5B63D3] text-white border-[#5B63D3] shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <Tag size={15} />
            <span>2. Design Specifications & Photos</span>
          </button>

          <button
            onClick={() => setActiveTab("lots")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border",
              activeTab === "lots"
                ? "bg-[#5B63D3] text-white border-[#5B63D3] shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <Factory size={15} />
            <span>3. Production Lots & Runs</span>
            {productionLots.length > 0 && (
              <span className={cn(
                "px-2 py-0.5 text-[10px] rounded-full font-black ml-1",
                activeTab === "lots" ? "bg-white text-[#5B63D3]" : "bg-indigo-100 text-indigo-700"
              )}>
                {productionLots.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Top 3 Quick Summary Cards (Replica of Image 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-2xl p-4 animate-pulse shadow-sm h-24" />
          ))
        ) : (
          <>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Average Cost</p>
                <h4 className="text-lg font-bold text-[#1E293B]">{formatRupee(avgCost)}</h4>
                <p className="text-[10px] text-[#64748B]">Across all active colours</p>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Total Pieces on Hand</p>
                <h4 className="text-lg font-bold text-[#1E293B]">
                  {grandTotalQty.toLocaleString()} <span className="text-xs font-semibold text-[#64748B]">pcs</span>
                </h4>
                <p className="text-[10px] text-[#64748B]">Across all godowns</p>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                <Palette className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Stock Valuation</p>
                <h4 className="text-lg font-bold text-[#7C3AED]">{formatRupee(grandTotalValue)}</h4>
                <p className="text-[10px] text-[#64748B]">Weighted average value</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* TAB 1: GODOWN & SIZING STOCK MATRIX (Replica of Image 2) */}
      {activeTab === "matrix" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#E2E8F0] flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#94A3B8]" />
            <div>
              <h3 className="text-base font-bold text-[#1E293B]">Godown & Sizing Stock Matrix</h3>
              <p className="text-xs text-[#64748B]">Sizing breakdown per colour across active storage locations</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#94A3B8] animate-pulse">Loading matrix database...</div>
            ) : (
              <table className="w-full border-collapse text-left text-xs font-semibold text-[#475569]">
                <thead>
                  {/* Level 1: Godown Names */}
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th rowSpan={2} className="py-4 px-5 border-r border-[#E2E8F0] w-48 text-[#1E293B] text-sm font-bold uppercase tracking-wider text-center">
                      Colour
                    </th>
                    {godowns.map((g) => (
                      <th key={g.id} colSpan={sizesList.length + 1} className="py-2.5 px-4 text-center border-r border-[#E2E8F0] text-[#6366F1] font-bold text-xs uppercase tracking-wider">
                        {g.name}
                      </th>
                    ))}
                    <th colSpan={sizesList.length + 1} className="py-2.5 px-4 text-center text-indigo-800 bg-indigo-50/40 font-bold text-xs uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                  {/* Level 2: Sizes list */}
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] uppercase font-bold text-[#64748B] text-center">
                    {godowns.map((g) => (
                      <React.Fragment key={g.id}>
                        {sizesList.map((s) => (
                          <th key={s} className="py-2 px-1 w-12 border-r border-[#F1F5F9]">{s}</th>
                        ))}
                        <th className="py-2 px-1.5 w-14 font-bold border-r border-[#E2E8F0] bg-slate-100/50 text-[#1E293B]">Total</th>
                      </React.Fragment>
                    ))}
                    {sizesList.map((s) => (
                      <th key={s} className="py-2 px-1 w-12 border-r border-[#F1F5F9] bg-indigo-50/20">{s}</th>
                    ))}
                    <th className="py-2 px-1.5 w-14 font-bold bg-indigo-100/40 text-indigo-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-center">
                  {colours.length > 0 ? (
                    colours.map((c) => {
                      let totalColourQty = 0;
                      const sizeTotals: Record<string, number> = {};

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-5 border-r border-[#E2E8F0] text-left flex items-center gap-3">
                            <ColourDot colourHex={c.colour_hex} size="md" />
                            <div>
                              <p className="text-xs font-bold text-[#1E293B] leading-none mb-0.5">{c.colour_name}</p>
                              <p className="text-[10px] text-[#94A3B8] font-medium leading-none">Cost: {formatRupee(colourCosts[c.id] || 0)}</p>
                            </div>
                          </td>

                          {/* Render cells for each godown */}
                          {godowns.map((g) => {
                            let godownTotal = 0;
                            return (
                              <React.Fragment key={g.id}>
                                {sizesList.map((s) => {
                                  const qty = matrix[c.id]?.[g.id]?.[s] || 0;
                                  godownTotal += qty;
                                  sizeTotals[s] = (sizeTotals[s] || 0) + qty;
                                  totalColourQty += qty;

                                  return (
                                    <td key={s} className={cn("py-3 px-1 border-r border-[#F1F5F9] text-xs font-bold", qty === 0 ? "text-[#CBD5E1] font-normal" : "text-[#1E293B]")}>
                                      {qty || "-"}
                                    </td>
                                  );
                                })}
                                <td className="py-3 px-1.5 border-r border-[#E2E8F0] bg-slate-50/30 text-[#1E293B] font-bold">
                                  {godownTotal || "-"}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          {/* Render aggregate cells for Total column */}
                          {sizesList.map((s) => {
                            const qty = sizeTotals[s] || 0;
                            return (
                              <td key={s} className={cn("py-3 px-1 border-r border-[#F1F5F9] bg-indigo-50/10 text-xs font-bold", qty === 0 ? "text-[#CBD5E1] font-normal" : "text-indigo-900 font-bold")}>
                                {qty || "-"}
                              </td>
                            );
                          })}
                          <td className="py-3 px-1.5 bg-indigo-50/30 text-indigo-900 font-bold text-sm">
                            {totalColourQty || "-"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={2 + godowns.length * (sizesList.length + 1) + (sizesList.length + 1)} className="py-8 text-center text-xs text-gray-400">
                        No colours defined for this design.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DESIGN SPECIFICATIONS */}
      {activeTab === "specs" && (
        <div className="space-y-6">
          {/* Photo Gallery & Basic Attributes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Catalog Images */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                <ImageIcon size={18} className="text-[#6366F1]" />
                <span>Catalog Photos Gallery</span>
              </h3>
              {design?.images && design.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {design.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${design.name} photo ${idx + 1}`}
                      className="w-full h-44 object-cover rounded-xl border border-slate-200"
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <ImageIcon className="mx-auto h-8 w-8 mb-1.5 opacity-50" />
                  <p className="text-xs font-bold">No catalog photos uploaded</p>
                </div>
              )}
            </div>

            {/* Attributes List */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2">
                <Tag size={18} className="text-[#6366F1]" />
                <span>Master Style Parameters</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Design Code</span>
                  <span className="font-extrabold text-slate-900">{design?.design_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Style Name</span>
                  <span className="font-bold text-slate-900">{design?.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Brand</span>
                  <span className="font-bold text-[#6366F1]">{design?.brand?.name || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Category / Sub-Category</span>
                  <span className="font-bold text-slate-800">
                    {design?.category || "—"} {design?.sub_category ? `/ ${design.sub_category}` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Season</span>
                  <span className="font-bold text-slate-800">{design?.season || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Gender Range</span>
                  <span className="font-bold text-slate-800">{design?.gender || "Unisex"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sale Price</span>
                  <span className="font-extrabold text-slate-900">₹{design?.sale_price?.toFixed(2) || "0.00"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">HSN Code</span>
                  <span className="font-mono font-bold text-slate-700">{design?.hsn_code || "—"}</span>
                </div>
              </div>

              {/* Description */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Description</span>
                <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {design?.description || "No description provided."}
                </p>
              </div>
            </div>
          </div>

          {/* Size Set & Colours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Size Set */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-[#0F172A]">Size Set Template</h3>
              <p className="text-xs font-bold text-[#6366F1]">{design?.size_set?.name || "Standard Size Set"}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {sizesList.map((s) => (
                  <span key={s} className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-extrabold rounded-lg">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Available Colours */}
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-[#0F172A]">Available Colour Swatches ({colours.length})</h3>
              <div className="grid grid-cols-2 gap-3">
                {colours.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <ColourDot colourHex={c.colour_hex} size="md" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{c.colour_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{c.colour_hex || "#6366F1"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONNECTED PRODUCTION LOTS (Wired to Production Module) */}
      {activeTab === "lots" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-[#6366F1]" />
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">Connected Production Lots</h3>
                <p className="text-xs text-[#64748B]">Manufacturing runs created for this design SKU</p>
              </div>
            </div>

            <Link
              href={`/production/lots/new?design_id=${params.id}`}
              className="px-3.5 py-1.5 rounded-xl bg-[#5B63D3] hover:bg-[#4F55C3] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              <span>Create New Lot</span>
            </Link>
          </div>

          {productionLots.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Factory className="mx-auto text-slate-300 h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-slate-700">No Production Lots Created Yet</p>
              <p className="text-xs text-slate-500 mt-0.5">Click "+ Create New Lot" to start a manufacturing run for this design.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#475569] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Lot Number</th>
                    <th className="py-3 px-4 text-right">Target Qty</th>
                    <th className="py-3 px-4 text-right">Completed Qty</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] font-medium text-[#0F172A]">
                  {productionLots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#6366F1]">{lot.lot_number}</td>
                      <td className="py-3 px-4 text-right font-bold">{lot.total_quantity?.toLocaleString("en-IN")} Pcs</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {lot.completed_quantity?.toLocaleString("en-IN")} Pcs
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            lot.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {lot.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(lot.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/production/lots/${lot.id}`}
                          className="text-xs font-bold text-[#6366F1] hover:underline"
                        >
                          View Lot Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
