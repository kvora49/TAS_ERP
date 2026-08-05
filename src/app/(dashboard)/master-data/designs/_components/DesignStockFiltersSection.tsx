"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Boxes, Layers, RefreshCw, Search } from "lucide-react";
import PageState from "@/components/shared/PageState";
import { formatCurrency } from "@/lib/utils";
import ColourDot from "@/components/shared/ColourDot";
import { toast } from "sonner";

export default function DesignStockFiltersSection({ designId }: { designId: string }) {
  const [isSyncing, setIsSyncing] = useState(false);
  // 10 Dimensional Filters
  const [selectedGodown, setSelectedGodown] = useState<string>("all"); // 1. Warehouse
  const [selectedColour, setSelectedColour] = useState<string>("all"); // 2. Colour
  const [selectedSize, setSelectedSize] = useState<string>("all"); // 3. Size
  const [stockType, setStockType] = useState<"all" | "latest" | "old">("all"); // 4 & 5. Aging
  const [movementType, setMovementType] = useState<"all" | "stock_in" | "stock_out">("all"); // 6 & 7. Movement
  const [selectedLot, setSelectedLot] = useState<string>("all"); // 8. Production Lot
  const [searchQuery, setSearchQuery] = useState(""); // 9. Search
  const [viewMode, setViewMode] = useState<"item_wise" | "design_wise">("item_wise"); // 10. Grouping Mode

  // Fetch Godowns, Production Lots, Design info
  const { data: godownsData } = useQuery({
    queryKey: ["godowns-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      return res.json();
    },
  });
  const godowns = godownsData?.godowns || [];

  const { data: designDetail } = useQuery({
    queryKey: ["design-detail-filters", designId],
    queryFn: async () => {
      const res = await fetch(`/api/finished-stock/designs/${designId}`);
      return res.json();
    },
    enabled: !!designId,
  });

  const colours = designDetail?.colours || [];
  const sizes = designDetail?.design?.size_set?.sizes || ["S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36"];
  const productionLots = designDetail?.productionLots || [];

  // Query stock entries with all 10 filters
  const { data: stockData, isLoading, refetch } = useQuery({
    queryKey: [
      "design-stock-filters-section",
      designId,
      selectedGodown,
      selectedColour,
      selectedSize,
      stockType,
      movementType,
      selectedLot,
      searchQuery,
      viewMode,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("design_id", designId);
      if (selectedGodown !== "all") params.append("godown_id", selectedGodown);
      if (selectedColour !== "all") params.append("colour_id", selectedColour);
      if (selectedSize !== "all") params.append("size", selectedSize);
      if (stockType !== "all") params.append("stock_type", stockType);
      if (movementType !== "all") params.append("movement_type", movementType);
      if (selectedLot !== "all") params.append("lot_id", selectedLot);
      if (searchQuery) params.append("search", searchQuery);
      params.append("view_mode", viewMode);

      const res = await fetch(`/api/master-data/designs/stock?${params.toString()}`);
      if (!res.ok) return { stock_entries: [], metrics: { total_quantity: 0, total_value: 0 } };
      return res.json();
    },
    enabled: !!designId,
  });

  const stockEntries = stockData?.stock_entries || [];
  const metrics = stockData?.metrics || { total_quantity: 0, total_value: 0 };

  const inputClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    placeholder:text-[var(--text-faint)]
    focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-3 h-9 text-xs
    transition-colors
  `;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-sm)] space-y-5">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-light)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Filter className="h-5 w-5 text-indigo-500" />
            <span>Design Stock 10-Dimensional Filters & Ledger</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Filter stock ledger by Warehouse, Colour, Size, Aging, Stock Movements, Production Lots, and Groupings
          </p>
        </div>

        <button
          disabled={isSyncing}
          onClick={async () => {
            setIsSyncing(true);
            try {
              const res = await fetch("/api/finished-stock/reconcile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetDesignId: designId }),
              });
              if (!res.ok) throw new Error("Reconciliation failed");
              toast.success("Finished stock reconciled successfully!");
              refetch();
            } catch (err: any) {
              toast.error(err.message || "Failed to reconcile finished stock");
            } finally {
              setIsSyncing(false);
            }
          }}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--primary)] bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--card-bg)] transition-all cursor-pointer shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 inline mr-1 ${isSyncing ? "animate-spin" : ""}`} /> Sync Stock
        </button>
      </div>

      {/* 10 FILTER CONTROLS GRID */}
      <div className="bg-[var(--page-bg)] p-4 rounded-xl border border-[var(--border)] space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center justify-between">
          <span>Dimensional Filter Controls</span>
          <button
            onClick={() => {
              setSelectedGodown("all");
              setSelectedColour("all");
              setSelectedSize("all");
              setStockType("all");
              setMovementType("all");
              setSelectedLot("all");
              setSearchQuery("");
              setViewMode("item_wise");
            }}
            className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer normal-case"
          >
            Reset All Filters
          </button>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* 1. Warehouse */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">1. Warehouse (Godown)</label>
            <select value={selectedGodown} onChange={(e) => setSelectedGodown(e.target.value)} className={`${inputClass} w-full`}>
              <option value="all">All Warehouses</option>
              {godowns.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Colour */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">2. Colour Swatch</label>
            <select value={selectedColour} onChange={(e) => setSelectedColour(e.target.value)} className={`${inputClass} w-full`}>
              <option value="all">All Colours</option>
              {colours.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.colour_name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Size */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">3. Size Breakdown</label>
            <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className={`${inputClass} w-full`}>
              <option value="all">All Sizes</option>
              {sizes.map((s: string) => (
                <option key={s} value={s}>
                  Size {s}
                </option>
              ))}
            </select>
          </div>

          {/* 4 & 5. Stock Aging */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">4. Stock Aging</label>
            <select value={stockType} onChange={(e) => setStockType(e.target.value as any)} className={`${inputClass} w-full`}>
              <option value="all">All Stock</option>
              <option value="latest">Latest Stock (&lt;14 days)</option>
              <option value="old">Old Stock (&gt;30 days)</option>
            </select>
          </div>

          {/* 6 & 7. Stock Movement */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">5. Stock Movement</label>
            <select value={movementType} onChange={(e) => setMovementType(e.target.value as any)} className={`${inputClass} w-full`}>
              <option value="all">All Movements</option>
              <option value="stock_in">Stock In</option>
              <option value="stock_out">Stock Out</option>
            </select>
          </div>

          {/* 8. Production Lot */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">6. Production Lot</label>
            <select value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)} className={`${inputClass} w-full`}>
              <option value="all">All Lots</option>
              {productionLots.map((lot: any) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lot_number} ({lot.total_quantity} pcs)
                </option>
              ))}
            </select>
          </div>

          {/* 9. Grouping Mode */}
          <div>
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">7. Grouping View</label>
            <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} className={`${inputClass} w-full font-bold`}>
              <option value="item_wise">Variant Item-wise</option>
              <option value="design_wise">Design Summary</option>
            </select>
          </div>

          {/* 10. Search Keywords */}
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">8. Search Keywords</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search colour, warehouse, lot number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} w-full pl-9`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Filtered Quantity</p>
          <h3 className="text-2xl font-extrabold text-[var(--primary)]">{metrics.total_quantity?.toLocaleString() || 0} Pcs</h3>
        </div>
        <div className="p-4 bg-[var(--page-bg)] rounded-xl border border-[var(--border)]">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Filtered Stock Valuation</p>
          <h3 className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(metrics.total_value || 0)}</h3>
        </div>
      </div>

      {/* Stock Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] text-[var(--text-muted)] font-semibold uppercase">
              <th className="py-2.5 px-3">Colour</th>
              <th className="py-2.5 px-3">Warehouse</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Size Breakdown</th>
              <th className="py-2.5 px-3 text-right">Qty (Pcs)</th>
              <th className="py-2.5 px-3 text-right">Value (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)]">
            {stockEntries.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[var(--text-muted)] font-medium">
                  No stock records match the selected filter parameters for this design.
                </td>
              </tr>
            ) : (
              stockEntries.map((row: any) => (
                <tr key={row.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 font-bold">
                      <ColourDot colourHex={row.colour?.colour_hex} />
                      <span>{row.colour?.colour_name || "N/A"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-muted)]">{row.godown?.name || "Unassigned"}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--page-bg)] border border-[var(--border)] uppercase">
                      {row.entry_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1 flex-wrap text-[10px]">
                      {row.size_quantities &&
                        Object.entries(row.size_quantities).map(([sz, q]) => (
                          <span key={sz} className="px-1.5 py-0.5 rounded bg-[var(--page-bg)] border border-[var(--border)] font-semibold">
                            {sz}: {String(q)}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[var(--primary)]">{row.total_quantity}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(row.total_value)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
