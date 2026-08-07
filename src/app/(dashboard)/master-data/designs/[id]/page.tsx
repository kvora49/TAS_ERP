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
  Calculator,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import ColourDot from "@/components/shared/ColourDot";
import { cn } from "@/lib/utils";

import DesignCostingSection from "../_components/DesignCostingSection";
import DesignNotesSection from "../_components/DesignNotesSection";
import DesignStockFiltersSection from "../_components/DesignStockFiltersSection";

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
  const [activeTab, setActiveTab] = useState<"matrix" | "costing" | "notes" | "filters" | "specs" | "lots">("matrix");

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
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--primary)] transition-colors">
            Dashboard
          </Link>
          <ChevronRight size={12} className="text-[var(--text-faint)]" />
          <Link href="/master-data/designs" className="hover:text-[var(--primary)] transition-colors">
            Master Data
          </Link>
          <ChevronRight size={12} className="text-[var(--text-faint)]" />
          <Link href="/master-data/designs" className="hover:text-[var(--primary)] transition-colors">
            Designs
          </Link>
          <ChevronRight size={12} className="text-[var(--text-faint)]" />
          <span className="text-[var(--text-primary)] font-extrabold">{design?.design_number || "Detail"}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/production/lots/new?design_id=${params.id}`}
            className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-4 py-2 rounded-xl transition-all shadow-md"
          >
            <Plus size={15} />
            <span>Launch Production Lot</span>
          </Link>

          <button
            onClick={fetchDetail}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--card-bg)] border border-[var(--border)] px-3.5 py-2 rounded-xl hover:bg-[var(--table-row-hover)] active:bg-[var(--page-bg)] transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Header Info Card */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/master-data/designs"
              className="p-2.5 bg-[var(--page-bg)] hover:bg-[var(--table-row-hover)] border border-[var(--border)] rounded-xl transition-all"
            >
              <ArrowLeft className="h-5 w-5 text-[var(--text-muted)]" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{design?.name || "Design Overview"}</h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 font-semibold">
                Design: <strong className="text-[var(--text-secondary)]">{design?.design_number}</strong> • Category:{" "}
                <strong className="text-[var(--text-secondary)]">{design?.category || "Apparel"}</strong> • Brand:{" "}
                <strong className="text-[var(--text-secondary)]">{design?.brand?.name || "No Brand"}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Workspace Navigation Tabs (Inline Buttons) */}
        <div className="border-t border-[var(--border-light)] pt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("matrix")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer",
              activeTab === "matrix"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-[var(--page-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <Boxes size={15} />
            <span>1. Godown Stock Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab("costing")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer",
              activeTab === "costing"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            )}
          >
            <Calculator size={15} className={activeTab === "costing" ? "text-white" : "text-amber-600 dark:text-amber-400"} />
            <span>2. Design Costing Calculator</span>
          </button>

          <button
            onClick={() => setActiveTab("notes")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer",
              activeTab === "notes"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            )}
          >
            <Calendar size={15} className={activeTab === "notes" ? "text-white" : "text-emerald-600 dark:text-emerald-400"} />
            <span>3. Date Notes & Reminders</span>
          </button>

          <button
            onClick={() => setActiveTab("specs")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer",
              activeTab === "specs"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-[var(--page-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <Tag size={15} />
            <span>4. Specifications & Photos</span>
          </button>

          <button
            onClick={() => setActiveTab("lots")}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border cursor-pointer",
              activeTab === "lots"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-[var(--page-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <Factory size={15} />
            <span>5. Production Lots & Runs</span>
            {productionLots.length > 0 && (
              <span className={cn(
                "px-2 py-0.5 text-[10px] rounded-full font-black ml-1",
                activeTab === "lots" ? "bg-white text-[var(--primary)]" : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
              )}>
                {productionLots.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Top 3 Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 animate-pulse shadow-sm h-24" />
          ))
        ) : (
          <>
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Average Cost</p>
                <h4 className="text-lg font-bold text-[var(--text-primary)]">{formatRupee(avgCost)}</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Across all active colours</p>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Total Pieces on Hand</p>
                <h4 className="text-lg font-bold text-[var(--text-primary)]">
                  {grandTotalQty.toLocaleString()} <span className="text-xs font-semibold text-[var(--text-muted)]">pcs</span>
                </h4>
                <p className="text-[10px] text-[var(--text-muted)]">Across all godowns</p>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Palette className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase">Stock Valuation</p>
                <h4 className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatRupee(grandTotalValue)}</h4>
                <p className="text-[10px] text-[var(--text-muted)]">Weighted average value</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* TAB 1: GODOWN & SIZING STOCK MATRIX */}
      {activeTab === "matrix" && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[var(--border)] flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--text-faint)]" />
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Godown & Sizing Stock Matrix</h3>
              <p className="text-xs text-[var(--text-muted)]">Sizing breakdown per colour across active storage locations</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-[var(--text-faint)] animate-pulse">Loading matrix database...</div>
            ) : (
              <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-body)]">
                <thead>
                  {/* Level 1: Godown Names */}
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)]">
                    <th rowSpan={2} className="py-4 px-5 border-r border-[var(--border)] w-48 text-[var(--text-primary)] text-sm font-bold uppercase tracking-wider text-center">
                      Colour
                    </th>
                    {godowns.map((g) => (
                      <th key={g.id} colSpan={sizesList.length + 1} className="py-2.5 px-4 text-center border-r border-[var(--border)] text-[var(--primary)] font-bold text-xs uppercase tracking-wider">
                        {g.name}
                      </th>
                    ))}
                    <th colSpan={sizesList.length + 1} className="py-2.5 px-4 text-center text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40 font-bold text-xs uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                  {/* Level 2: Sizes list */}
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[10px] uppercase font-bold text-[var(--text-muted)] text-center">
                    {godowns.map((g) => (
                      <React.Fragment key={g.id}>
                        {sizesList.map((s) => (
                          <th key={s} className="py-2 px-1 w-12 border-r border-[var(--border-light)]">{s}</th>
                        ))}
                        <th className="py-2 px-1.5 w-14 font-bold border-r border-[var(--border)] bg-[var(--page-bg)] text-[var(--text-primary)]">Total</th>
                      </React.Fragment>
                    ))}
                    {sizesList.map((s) => (
                      <th key={s} className="py-2 px-1 w-12 border-r border-[var(--border-light)] bg-indigo-50/30 dark:bg-indigo-950/20">{s}</th>
                    ))}
                    <th className="py-2 px-1.5 w-14 font-bold bg-indigo-100/50 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-center">
                  {colours.length > 0 ? (
                    colours.map((c) => {
                      let totalColourQty = 0;
                      const sizeTotals: Record<string, number> = {};

                      return (
                        <tr key={c.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                          <td className="py-3 px-5 border-r border-[var(--border)] text-left flex items-center gap-3">
                            <ColourDot colourHex={c.colour_hex} size="md" />
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)] leading-none mb-0.5">{c.colour_name}</p>
                              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none">Cost: {formatRupee(colourCosts[c.id] || 0)}</p>
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
                                    <td key={s} className={cn("py-3 px-1 border-r border-[var(--border-light)] text-xs font-bold", qty === 0 ? "text-[var(--text-faint)] font-normal" : "text-[var(--text-primary)]")}>
                                      {qty || "-"}
                                    </td>
                                  );
                                })}
                                <td className="py-3 px-1.5 border-r border-[var(--border)] bg-[var(--table-row-hover)]/50 text-[var(--text-primary)] font-bold">
                                  {godownTotal || "-"}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          {/* Render aggregate cells for Total column */}
                          {sizesList.map((s) => {
                            const qty = sizeTotals[s] || 0;
                            return (
                              <td key={s} className={cn("py-3 px-1 border-r border-[var(--border-light)] bg-indigo-50/20 dark:bg-indigo-950/30 text-xs font-bold", qty === 0 ? "text-[var(--text-faint)] font-normal" : "text-indigo-700 dark:text-indigo-300 font-bold")}>
                                {qty || "-"}
                              </td>
                            );
                          })}
                          <td className="py-3 px-1.5 bg-indigo-50/40 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                            {totalColourQty || "-"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={2 + godowns.length * (sizesList.length + 1) + (sizesList.length + 1)} className="py-8 text-center text-xs text-[var(--text-faint)]">
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

      {/* TAB 2: DESIGN COSTING CALCULATOR */}
      {activeTab === "costing" && (
        <DesignCostingSection designId={params.id} />
      )}

      {/* TAB 3: DATE NOTES & REMINDERS */}
      {activeTab === "notes" && (
        <DesignNotesSection designId={params.id} />
      )}

      {/* TAB 4: DESIGN SPECIFICATIONS */}
      {activeTab === "specs" && (
        <div className="space-y-6">
          {/* Photo Gallery & Basic Attributes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Catalog Images */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] p-5 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <ImageIcon size={18} className="text-[var(--primary)]" />
                <span>Catalog Photos Gallery</span>
              </h3>
              {design?.images && design.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {design.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${design.name} photo ${idx + 1}`}
                      className="w-full h-44 object-cover rounded-xl border border-[var(--border)]"
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-[var(--text-faint)] bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
                  <ImageIcon className="mx-auto h-8 w-8 mb-1.5 opacity-50" />
                  <p className="text-xs font-bold">No catalog photos uploaded</p>
                </div>
              )}
            </div>

            {/* Attributes List */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] p-5 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Tag size={18} className="text-[var(--primary)]" />
                <span>Master Style Parameters</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">Design Code</span>
                  <span className="font-extrabold text-[var(--text-primary)]">{design?.design_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">Style Name</span>
                  <span className="font-bold text-[var(--text-primary)]">{design?.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">Brand</span>
                  <span className="font-bold text-[var(--primary)]">{design?.brand?.name || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">Category / Sub-Category</span>
                  <span className="font-bold text-[var(--text-secondary)]">
                    {design?.category || "—"} {design?.sub_category ? `/ ${design.sub_category}` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">Season</span>
                  <span className="font-bold text-[var(--text-secondary)]">{design?.season || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">Gender Range</span>
                  <span className="font-bold text-[var(--text-secondary)]">{design?.gender || "Unisex"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">Sale Price</span>
                  <span className="font-extrabold text-[var(--text-primary)]">₹{design?.sale_price?.toFixed(2) || "0.00"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block">HSN Code</span>
                  <span className="font-mono font-bold text-[var(--text-body)]">{design?.hsn_code || "—"}</span>
                </div>
              </div>

              {/* Description */}
              <div className="pt-3 border-t border-[var(--border-light)]">
                <span className="text-[10px] text-[var(--text-faint)] font-bold uppercase block mb-1">Description</span>
                <p className="text-xs text-[var(--text-body)] leading-relaxed font-medium bg-[var(--page-bg)] p-3 rounded-xl border border-[var(--border)]">
                  {design?.description || "No description provided."}
                </p>
              </div>
            </div>
          </div>

          {/* Size Set & Colours */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Size Set */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] p-5 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Size Set Template</h3>
              <p className="text-xs font-bold text-[var(--primary)]">{design?.size_set?.name || "Standard Size Set"}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {sizesList.map((s) => (
                  <span key={s} className="px-3 py-1 bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-extrabold rounded-lg">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Available Colours */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] p-5 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Available Colour Swatches ({colours.length})</h3>
              <div className="grid grid-cols-2 gap-3">
                {colours.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
                    <ColourDot colourHex={c.colour_hex} size="md" />
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{c.colour_name}</p>
                      <p className="text-[10px] text-[var(--text-faint)] font-mono">{c.colour_hex || "#6366F1"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CONNECTED PRODUCTION LOTS */}
      {activeTab === "lots" && (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Connected Production Lots</h3>
                <p className="text-xs text-[var(--text-muted)]">Manufacturing runs created for this design SKU</p>
              </div>
            </div>

            <Link
              href={`/production/lots/new?design_id=${params.id}`}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              <span>Create New Lot</span>
            </Link>
          </div>

          {productionLots.length === 0 ? (
            <div className="py-16 text-center bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
              <Factory className="mx-auto text-[var(--text-faint)] h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-[var(--text-primary)]">No Production Lots Created Yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Click &quot;+ Create New Lot&quot; to start a manufacturing run for this design.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Lot Number</th>
                    <th className="py-3 px-4 text-right">Target Qty</th>
                    <th className="py-3 px-4 text-right">Completed Qty</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
                  {productionLots.map((lot) => (
                    <tr key={lot.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--primary)]">{lot.lot_number}</td>
                      <td className="py-3 px-4 text-right font-bold">{lot.total_quantity?.toLocaleString("en-IN")} Pcs</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {lot.completed_quantity?.toLocaleString("en-IN")} Pcs
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            lot.status === "completed"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {lot.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] font-mono">
                        {new Date(lot.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/production/lots/${lot.id}`}
                          className="text-xs font-bold text-[var(--primary)] hover:underline"
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
