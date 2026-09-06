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
  Tag,
  Calendar,
  Image as ImageIcon,
  Calculator,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ColourDot from "@/components/shared/ColourDot";
import { StatusBadge } from "@/components/shared/StatusBadge";
import PageState from "@/components/shared/PageState";
import { Modal } from "@/components/shared/Modal";
import { cn, formatCurrency } from "@/lib/utils";

import DesignCostingSection from "../_components/DesignCostingSection";
import DesignNotesSection from "../_components/DesignNotesSection";

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
  is_active: boolean;
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
  const [activeTab, setActiveTab] = useState<"matrix" | "costing" | "notes" | "specs" | "lots">("matrix");
  const [zoomImage, setZoomImage] = useState<string | null>(null);

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

  const apiAvgCost = (data as any)?.overallAvgCost ?? 0;
  const apiTotalQty = (data as any)?.totalDesignStockQty ?? 0;
  const apiTotalValue = (data as any)?.totalDesignStockValue ?? 0;

  // Total calculations
  let grandTotalQty = 0;
  let grandTotalValue = 0;
  let weightedCostSum = 0;

  const colourKeys = colours.length > 0 ? colours.map((c) => c.id) : Object.keys(matrix);
  colourKeys.forEach((cId) => {
    let colourQty = 0;
    godowns.forEach((g) => {
      sizesList.forEach((s) => {
        const qty = matrix[cId]?.[g.id]?.[s] || 0;
        colourQty += qty;
      });
    });
    grandTotalQty += colourQty;
    const cost = colourCosts[cId] || apiAvgCost || 0;
    grandTotalValue += colourQty * cost;
    weightedCostSum += cost;
  });

  const finalQty = grandTotalQty > 0 ? grandTotalQty : apiTotalQty;
  const salePrice = Number(design?.sale_price || 0);
  const fallbackUnitCost = salePrice > 0 ? Math.round(salePrice * 0.6) : 150;
  const rawValue = grandTotalValue > 0 ? grandTotalValue : (apiTotalValue > 0 ? apiTotalValue : (finalQty * apiAvgCost));
  const rawAvgCost = finalQty > 0 ? (rawValue / finalQty) : (apiAvgCost > 0 ? apiAvgCost : (colours.length > 0 && weightedCostSum > 0 ? weightedCostSum / colours.length : 0));
  const avgCost = rawAvgCost > 0 ? rawAvgCost : fallbackUnitCost;
  const finalValue = rawValue > 0 ? rawValue : (finalQty > 0 ? Math.round(finalQty * avgCost) : 0);

  return (
    <PageState
      isLoading={loading && !data}
      isError={!loading && !design}
      error="Design not found"
      onRetry={fetchDetail}
      skeletonVariant="card"
      skeletonCount={3}
    >
      <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Mobile App Bar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/master-data/designs"
              className="w-10 h-10 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] flex items-center justify-center text-[var(--text-secondary)] transition-colors shrink-0"
              aria-label="Back to designs"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-bold text-[var(--text-primary)] truncate">
                  {design?.name || "Design Overview"}
                </h1>
                {design?.design_number && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--table-header-bg)] text-[var(--text-secondary)] border border-[var(--border)]">
                    {design.design_number}
                  </span>
                )}
                {design && <StatusBadge active={design.is_active} />}
              </div>
              <p className="text-[11px] sm:text-xs text-[var(--text-muted)] truncate mt-0.5">
                Category: <strong className="text-[var(--text-secondary)]">{design?.category || "Apparel"}</strong>
                {design?.sub_category ? ` / ${design.sub_category}` : ""} • Brand:{" "}
                <strong className="text-[var(--text-secondary)]">{design?.brand?.name || "No Brand"}</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons: Clean, non-overlapping */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <Link
              href={`/production/lots/new?design_id=${params.id}`}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] flex items-center gap-1.5 shadow-md shadow-[var(--primary)]/15 transition-all"
            >
              <Plus size={15} />
              <span>New Lot</span>
            </Link>

            <button
              type="button"
              onClick={fetchDetail}
              disabled={loading}
              className="h-9 sm:h-10 px-3 rounded-xl text-xs font-semibold text-[var(--text-secondary)] bg-[var(--card-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Refresh design data"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Segmented Horizontal Scrollable Subtabs Bar */}
        <div className="overflow-x-auto no-scrollbar pb-1">
          <div className="flex items-center gap-1 p-1 bg-[var(--table-header-bg)] border border-[var(--border)] rounded-2xl w-max min-w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0",
                activeTab === "matrix"
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)]"
              )}
            >
              <Boxes size={14} />
              <span>Stock Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("costing")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0",
                activeTab === "costing"
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)]"
              )}
            >
              <Calculator size={14} />
              <span>Costing</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0",
                activeTab === "notes"
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)]"
              )}
            >
              <Calendar size={14} />
              <span>Notes & Reminders</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0",
                activeTab === "specs"
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)]"
              )}
            >
              <Tag size={14} />
              <span>Specs & Photos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("lots")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0",
                activeTab === "lots"
                  ? "bg-[var(--primary)] text-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--card-bg)] hover:text-[var(--text-primary)]"
              )}
            >
              <Factory size={14} />
              <span>Production Lots</span>
              {productionLots.length > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ml-0.5",
                    activeTab === "lots"
                      ? "bg-[var(--card-bg)] text-[var(--primary)]"
                      : "bg-[var(--primary)] text-white"
                  )}
                >
                  {productionLots.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 2x2 Responsive Summary KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
                Average Cost
              </p>
              <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] truncate">
                {formatRupee(avgCost)}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] truncate hidden sm:block">
                Across all active colours
              </p>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
                Pieces on Hand
              </p>
              <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] truncate">
                {finalQty.toLocaleString()}{" "}
                <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-muted)]">pcs</span>
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] truncate hidden sm:block">
                Across all storage godowns
              </p>
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Palette className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
                Stock Valuation
              </p>
              <h3 className="text-sm sm:text-lg font-bold text-purple-600 dark:text-purple-400 truncate">
                {formatRupee(finalValue)}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] truncate hidden sm:block">
                Weighted valuation
              </p>
            </div>
          </div>
        </div>

        {/* TAB 1: GODOWN & SIZING STOCK MATRIX */}
        {activeTab === "matrix" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                  Godown & Sizing Stock Matrix
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Breakdown per colour swatch across storage locations
                </p>
              </div>
            </div>

            {/* Mobile View: Colour & Godown Stock Cards (0 horizontal scroll) */}
            <div className="block md:hidden space-y-3">
              {colours.length === 0 ? (
                <div className="bg-[var(--card-bg)] border border-dashed border-[var(--border)] rounded-2xl p-8 text-center text-xs text-[var(--text-muted)]">
                  No colours configured for this design.
                </div>
              ) : (
                colours.map((c) => {
                  let totalColourQty = 0;
                  const sizeTotals: Record<string, number> = {};

                  // Precalculate totals
                  godowns.forEach((g) => {
                    sizesList.forEach((s) => {
                      const qty = matrix[c.id]?.[g.id]?.[s] || 0;
                      sizeTotals[s] = (sizeTotals[s] || 0) + qty;
                      totalColourQty += qty;
                    });
                  });

                  return (
                    <div
                      key={c.id}
                      className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] space-y-3"
                    >
                      {/* Colour Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-light)]">
                        <div className="flex items-center gap-2.5">
                          <ColourDot colourHex={c.colour_hex} size="md" />
                          <div>
                            <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                              {c.colour_name}
                            </h4>
                            <p className="text-[11px] text-[var(--text-muted)] font-medium">
                              Avg Cost: {formatRupee(colourCosts[c.id] || 0)}
                            </p>
                          </div>
                        </div>

                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                          {totalColourQty} pcs
                        </span>
                      </div>

                      {/* Sizing Breakdown Chips for this Colour */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                          Size Distribution
                        </span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {sizesList.map((s) => {
                            const qty = sizeTotals[s] || 0;
                            return (
                              <div
                                key={s}
                                className={cn(
                                  "p-1.5 rounded-xl border text-center transition-colors",
                                  qty > 0
                                    ? "bg-[var(--table-header-bg)] border-[var(--border)]"
                                    : "bg-transparent border-[var(--border-light)] opacity-40"
                                )}
                              >
                                <span className="text-[9px] font-bold text-[var(--text-muted)] block">
                                  {s}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-bold block",
                                    qty > 0 ? "text-[var(--text-primary)]" : "text-[var(--text-faint)]"
                                  )}
                                >
                                  {qty || "-"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Godown Breakdown */}
                      {godowns.length > 0 && (
                        <div className="pt-2 border-t border-[var(--border-light)] space-y-1.5">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                            Locations
                          </span>
                          <div className="space-y-1">
                            {godowns.map((g) => {
                              let godownTotal = 0;
                              sizesList.forEach((s) => {
                                godownTotal += matrix[c.id]?.[g.id]?.[s] || 0;
                              });

                              return (
                                <div
                                  key={g.id}
                                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[var(--table-header-bg)] border border-[var(--border-light)]"
                                >
                                  <span className="text-[var(--text-secondary)] font-medium">
                                    {g.name}
                                  </span>
                                  <span
                                    className={cn(
                                      "font-bold font-mono",
                                      godownTotal > 0
                                        ? "text-[var(--text-primary)]"
                                        : "text-[var(--text-faint)]"
                                    )}
                                  >
                                    {godownTotal} pcs
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop View: High-Density Table (hidden md:block) */}
            <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-body)]">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)]">
                      <th
                        rowSpan={2}
                        className="py-3 px-4 border-r border-[var(--border)] w-44 text-[var(--text-primary)] text-xs font-bold uppercase tracking-wider text-center"
                      >
                        Colour
                      </th>
                      {godowns.map((g) => (
                        <th
                          key={g.id}
                          colSpan={sizesList.length + 1}
                          className="py-2 px-3 text-center border-r border-[var(--border)] text-[var(--primary)] font-bold text-xs uppercase tracking-wider"
                        >
                          {g.name}
                        </th>
                      ))}
                      <th
                        colSpan={sizesList.length + 1}
                        className="py-2 px-3 text-center text-[var(--primary)] bg-[var(--primary-light)]/50 font-bold text-xs uppercase tracking-wider"
                      >
                        Total
                      </th>
                    </tr>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] uppercase font-bold text-[var(--text-muted)] text-center">
                      {godowns.map((g) => (
                        <React.Fragment key={g.id}>
                          {sizesList.map((s) => (
                            <th key={s} className="py-1.5 px-1 w-10 border-r border-[var(--border-light)]">
                              {s}
                            </th>
                          ))}
                          <th className="py-1.5 px-1.5 w-12 font-bold border-r border-[var(--border)] bg-[var(--table-row-hover)] text-[var(--text-primary)]">
                            Total
                          </th>
                        </React.Fragment>
                      ))}
                      {sizesList.map((s) => (
                        <th key={s} className="py-1.5 px-1 w-10 border-r border-[var(--border-light)] bg-[var(--primary-light)]/20">
                          {s}
                        </th>
                      ))}
                      <th className="py-1.5 px-1.5 w-12 font-bold bg-[var(--primary-light)] text-[var(--primary)]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-center">
                    {colours.length > 0 ? (
                      colours.map((c) => {
                        let totalColourQty = 0;
                        const sizeTotals: Record<string, number> = {};

                        return (
                          <tr key={c.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                            <td className="py-2.5 px-4 border-r border-[var(--border)] text-left flex items-center gap-2.5">
                              <ColourDot colourHex={c.colour_hex} size="md" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {c.colour_name}
                                </p>
                                <p className="text-[10px] text-[var(--text-muted)] font-medium">
                                  {formatRupee(colourCosts[c.id] || 0)}
                                </p>
                              </div>
                            </td>

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
                                      <td
                                        key={s}
                                        className={cn(
                                          "py-2.5 px-1 border-r border-[var(--border-light)] text-xs font-bold",
                                          qty === 0 ? "text-[var(--text-faint)] font-normal" : "text-[var(--text-primary)]"
                                        )}
                                      >
                                        {qty || "-"}
                                      </td>
                                    );
                                  })}
                                  <td className="py-2.5 px-1.5 border-r border-[var(--border)] bg-[var(--table-row-hover)]/60 text-[var(--text-primary)] font-bold">
                                    {godownTotal || "-"}
                                  </td>
                                </React.Fragment>
                              );
                            })}

                            {sizesList.map((s) => {
                              const qty = sizeTotals[s] || 0;
                              return (
                                <td
                                  key={s}
                                  className={cn(
                                    "py-2.5 px-1 border-r border-[var(--border-light)] bg-[var(--primary-light)]/10 text-xs font-bold",
                                    qty === 0 ? "text-[var(--text-faint)] font-normal" : "text-[var(--primary)]"
                                  )}
                                >
                                  {qty || "-"}
                                </td>
                              );
                            })}
                            <td className="py-2.5 px-1.5 bg-[var(--primary-light)]/30 text-[var(--primary)] font-bold text-sm">
                              {totalColourQty || "-"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={2 + godowns.length * (sizesList.length + 1) + (sizesList.length + 1)}
                          className="py-8 text-center text-xs text-[var(--text-faint)]"
                        >
                          No colours defined for this design.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DESIGN COSTING CALCULATOR */}
        {activeTab === "costing" && (
          <DesignCostingSection designId={params.id} onSave={fetchDetail} />
        )}

        {/* TAB 3: DATE NOTES & REMINDERS */}
        {activeTab === "notes" && (
          <DesignNotesSection designId={params.id} />
        )}

        {/* TAB 4: SPECIFICATIONS & PHOTOS */}
        {activeTab === "specs" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Photo Gallery */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-[var(--shadow-sm)] space-y-3">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <ImageIcon size={16} className="text-[var(--primary)]" />
                  <span>Catalog Photos</span>
                </h3>

                {design?.images && design.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {design.images.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setZoomImage(img)}
                        className="relative h-32 sm:h-40 rounded-xl overflow-hidden border border-[var(--border)] group cursor-pointer"
                      >
                        <img
                          src={img}
                          alt={`${design.name} photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ZoomIn size={20} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
                    <ImageIcon className="mx-auto h-8 w-8 text-[var(--text-faint)] mb-1.5" />
                    <p className="text-xs font-semibold text-[var(--text-muted)]">No catalog photos uploaded</p>
                  </div>
                )}
              </div>

              {/* Master Style Parameters */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-[var(--shadow-sm)] space-y-3">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Tag size={16} className="text-[var(--primary)]" />
                  <span>Master Parameters</span>
                </h3>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block">Design Code</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{design?.design_number}</span>
                  </div>
                  <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block">Brand</span>
                    <span className="font-bold text-[var(--primary)]">{design?.brand?.name || "—"}</span>
                  </div>
                  <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block">Category</span>
                    <span className="font-bold text-[var(--text-secondary)]">
                      {design?.category || "—"} {design?.sub_category ? `/ ${design.sub_category}` : ""}
                    </span>
                  </div>
                  <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block">Season</span>
                    <span className="font-bold text-[var(--text-secondary)]">{design?.season || "—"}</span>
                  </div>
                  <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block">Sale Price</span>
                    <span className="font-extrabold text-[var(--text-primary)]">
                      ₹{design?.sale_price?.toLocaleString("en-IN") || "0.00"}
                    </span>
                  </div>
                  <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-2.5">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block">HSN Code</span>
                    <span className="font-mono font-bold text-[var(--text-secondary)]">{design?.hsn_code || "—"}</span>
                  </div>
                </div>

                {design?.description && (
                  <div className="pt-2 border-t border-[var(--border-light)]">
                    <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase block mb-1">Description</span>
                    <p className="text-xs text-[var(--text-body)] leading-relaxed font-medium bg-[var(--page-bg)] p-2.5 rounded-xl border border-[var(--border)]">
                      {design.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Size Set & Colours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Size Set */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-[var(--shadow-sm)] space-y-2.5">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">Size Set Template</h3>
                <p className="text-xs font-bold text-[var(--primary)]">{design?.size_set?.name || "Standard Size Set"}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sizesList.map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 bg-[var(--table-header-bg)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-lg font-mono"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Available Colours */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-[var(--shadow-sm)] space-y-2.5">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                  Available Colour Swatches ({colours.length})
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {colours.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--table-header-bg)] border border-[var(--border)]"
                    >
                      <ColourDot colourHex={c.colour_hex} size="md" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{c.colour_name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">{c.colour_hex || "#6366F1"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PRODUCTION LOTS */}
        {activeTab === "lots" && (
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-[var(--primary)]" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                    Production Lots
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Manufacturing runs scheduled or completed for this design SKU
                  </p>
                </div>
              </div>

              <Link
                href={`/production/lots/new?design_id=${params.id}`}
                className="h-8 sm:h-9 px-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={14} />
                <span>New Lot</span>
              </Link>
            </div>

            {productionLots.length === 0 ? (
              <div className="py-12 text-center bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)] space-y-2">
                <Factory className="mx-auto text-[var(--text-faint)] h-8 w-8" />
                <p className="text-xs font-bold text-[var(--text-primary)]">No Production Lots Created Yet</p>
                <p className="text-[11px] text-[var(--text-muted)]">Click &quot;+ New Lot&quot; to start a manufacturing run.</p>
              </div>
            ) : (
              <>
                {/* Mobile View: Production Lot Cards (block md:hidden) - 0 horizontal scroll */}
                <div className="block md:hidden space-y-2.5">
                  {productionLots.map((lot) => {
                    const target = lot.total_quantity || 1;
                    const completed = lot.completed_quantity || 0;
                    const percent = Math.min(100, Math.round((completed / target) * 100));

                    return (
                      <div
                        key={lot.id}
                        className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[var(--primary)]">
                            {lot.lot_number}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                              lot.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            )}
                          >
                            {lot.status}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-[var(--text-muted)]">Completed: {completed.toLocaleString()} / {target.toLocaleString()} Pcs</span>
                            <span className="text-[var(--primary)] font-bold">{percent}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--primary)] rounded-full transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-muted)]">
                          <span>{new Date(lot.created_at).toLocaleDateString("en-IN")}</span>
                          <Link
                            href={`/production/lots/${lot.id}`}
                            className="text-xs font-bold text-[var(--primary)] flex items-center gap-1 hover:underline"
                          >
                            View Lot <ChevronRight size={13} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Lot Number</th>
                        <th className="py-2.5 px-4 text-right">Target Qty</th>
                        <th className="py-2.5 px-4 text-right">Completed Qty</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4">Created Date</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
                      {productionLots.map((lot) => (
                        <tr key={lot.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                          <td className="py-2.5 px-4 font-bold text-[var(--primary)] font-mono">{lot.lot_number}</td>
                          <td className="py-2.5 px-4 text-right font-bold">{lot.total_quantity?.toLocaleString("en-IN")} Pcs</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {lot.completed_quantity?.toLocaleString("en-IN")} Pcs
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                lot.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              )}
                            >
                              {lot.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[var(--text-muted)] font-mono">
                            {new Date(lot.created_at).toLocaleDateString("en-IN")}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <Link
                              href={`/production/lots/${lot.id}`}
                              className="text-xs font-bold text-[var(--primary)] hover:underline"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Photo Zoom Modal */}
        <Modal
          open={!!zoomImage}
          onOpenChange={(open) => !open && setZoomImage(null)}
          title="Catalog Photo Preview"
          maxWidth="max-w-2xl"
        >
          {zoomImage && (
            <div className="p-2">
              <img
                src={zoomImage}
                alt="Enlarged photo preview"
                className="w-full h-auto max-h-[70vh] object-contain rounded-xl"
              />
            </div>
          )}
        </Modal>
      </div>
    </PageState>
  );
}
