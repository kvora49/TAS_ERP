"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Layers, DollarSign, Boxes, Palette } from "lucide-react";
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
}

interface Design {
  id: string;
  design_number: string;
  name: string;
  category: string;
  sub_category?: string;
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
}

export default function DesignStockDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DesignDetailResponse | null>(null);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finished-stock/designs/${params.id}`);
      const json = await res.json();
      if (res.ok && json.design) {
        setData(json);
      } else {
        toast.error(json.error || "Failed to load stock details");
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
      maximumFractionDigits: 2
    }).format(value);
  };

  // Extract dimensions
  const design = data?.design;
  const colours = data?.colours || [];
  const godowns = data?.godowns || [];
  const matrix = data?.matrix || {};
  const colourCosts = data?.colourCosts || {};

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

  const avgCost = colours.length > 0 ? (weightedCostSum / colours.length) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
            Finished Stock
          </Link>
          <span>/</span>
          <Link href="/finished-stock/designs" className="hover:text-[#6366F1] transition-colors">
            Designs
          </Link>
          <span>/</span>
          <span className="text-[#334155]">{design?.design_number || "Detail"}</span>
        </div>
        <button
          onClick={fetchDetail}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/finished-stock/designs"
          className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[#475569]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">{design?.name || "Garment Stock Matrix"}</h1>
          <p className="text-sm text-[#64748B]">
            Design: <strong className="text-[#334155]">{design?.design_number}</strong> • Category: <strong className="text-[#334155]">{design?.category}</strong> • Brand: <strong className="text-[#334155]">{design?.brand?.name || "No Brand"}</strong>
          </p>
        </div>
      </div>

      {/* Quick Summary Cards */}
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
                <h4 className="text-lg font-bold text-[#1E293B]">{grandTotalQty.toLocaleString()} <span className="text-xs font-semibold text-[#64748B]">pcs</span></h4>
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

      {/* Stock Matrix Table */}
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
                  <th rowSpan={2} className="py-4 px-5 border-r border-[#E2E8F0] w-48 text-[#1E293B] text-sm font-bold uppercase tracking-wider text-center">Colour</th>
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
                    // Colour variables
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
    </div>
  );
}
