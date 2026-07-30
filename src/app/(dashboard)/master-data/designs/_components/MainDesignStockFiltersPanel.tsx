"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, RefreshCw, Search, Boxes, Layers } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface FilterState {
  selectedGodown: string;
  selectedDesign: string;
  selectedColour: string;
  selectedSize: string;
  selectedLot: string;
  stockType: "all" | "latest" | "old";
  movementType: "all" | "stock_in" | "stock_out";
  viewMode: "design_wise" | "item_wise";
  searchQuery: string;
}

export default function MainDesignStockFiltersPanel({
  onFilterChange,
}: {
  onFilterChange?: (filters: FilterState) => void;
}) {
  const [showPanel, setShowPanel] = useState(true);

  // 10 Filter States (Matching Screenshot 1)
  const [selectedGodown, setSelectedGodown] = useState<string>("all");
  const [selectedDesign, setSelectedDesign] = useState<string>("all");
  const [selectedColour, setSelectedColour] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [selectedLot, setSelectedLot] = useState<string>("all");
  const [stockType, setStockType] = useState<"all" | "latest" | "old">("all");
  const [movementType, setMovementType] = useState<"all" | "stock_in" | "stock_out">("all");
  const [viewMode, setViewMode] = useState<"design_wise" | "item_wise">("design_wise");
  const [searchQuery, setSearchQuery] = useState("");

  // Notify parent on filter change in real-time
  useEffect(() => {
    onFilterChange?.({
      selectedGodown,
      selectedDesign,
      selectedColour,
      selectedSize,
      selectedLot,
      stockType,
      movementType,
      viewMode,
      searchQuery,
    });
  }, [
    selectedGodown,
    selectedDesign,
    selectedColour,
    selectedSize,
    selectedLot,
    stockType,
    movementType,
    viewMode,
    searchQuery,
    onFilterChange,
  ]);

  // Fetch Master Data options
  const { data: godownsData } = useQuery({
    queryKey: ["godowns-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/godowns");
      return res.json();
    },
  });
  const godowns = godownsData?.godowns || [];

  const { data: designsData } = useQuery({
    queryKey: ["master-designs-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/designs");
      return res.json();
    },
  });
  const designs = designsData?.designs || [];

  const { data: lotsData } = useQuery({
    queryKey: ["production-lots-list"],
    queryFn: async () => {
      const res = await fetch("/api/production/lots");
      return res.json();
    },
  });
  const lots = lotsData?.lots || [];

  // Extract unique Colours from real-time designs catalog
  const coloursList = useMemo(() => {
    const map = new Map<string, string>();
    designs.forEach((d: any) => {
      d.design_colours?.forEach((c: any) => {
        if (c.colour_name) {
          map.set(c.colour_name, c.colour_name);
        }
      });
    });
    return Array.from(map.keys());
  }, [designs]);

  // Extract unique Sizes from real-time size sets
  const sizesList = useMemo(() => {
    const set = new Set<string>();
    designs.forEach((d: any) => {
      d.size_set?.sizes?.forEach((s: string) => set.add(s));
    });
    return Array.from(set).length > 0
      ? Array.from(set)
      : ["S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36"];
  }, [designs]);

  // Fetch API stock data for totals
  const { data: stockData, isLoading, refetch } = useQuery({
    queryKey: [
      "main-stock-filters-panel",
      selectedGodown,
      selectedDesign,
      selectedColour,
      selectedSize,
      selectedLot,
      stockType,
      movementType,
      viewMode,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedGodown !== "all") params.append("godown_id", selectedGodown);
      if (selectedDesign !== "all") params.append("design_id", selectedDesign);
      if (selectedColour !== "all") params.append("colour_id", selectedColour);
      if (selectedSize !== "all") params.append("size", selectedSize);
      if (selectedLot !== "all") params.append("lot_id", selectedLot);
      if (stockType !== "all") params.append("stock_type", stockType);
      if (movementType !== "all") params.append("movement_type", movementType);
      if (searchQuery) params.append("search", searchQuery);
      params.append("view_mode", viewMode);

      const res = await fetch(`/api/master-data/designs/stock?${params.toString()}`);
      if (!res.ok)
        return {
          stock_entries: [],
          design_summaries: [],
          metrics: { total_quantity: 0, total_value: 0, filtered_count: 0 },
        };
      return res.json();
    },
  });

  const metrics = stockData?.metrics || {
    total_quantity: designs.reduce((acc: number, d: any) => acc + (d.total_quantity || 0), 0),
    total_value: designs.reduce((acc: number, d: any) => acc + (d.total_value || 0), 0),
    filtered_count: designs.length,
  };

  const handleReset = () => {
    setSelectedGodown("all");
    setSelectedDesign("all");
    setSelectedColour("all");
    setSelectedSize("all");
    setSelectedLot("all");
    setStockType("all");
    setMovementType("all");
    setViewMode("design_wise");
    setSearchQuery("");
  };

  const inputSelectClass = `
    bg-[var(--input-bg)]
    border border-[var(--input-border)]
    text-[var(--text-primary)]
    focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-xl px-3 h-10 text-xs font-semibold
    transition-colors w-full cursor-pointer
  `;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] space-y-5">
      {/* Title & Actions Bar (Matching Screenshot 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-[var(--primary)] shrink-0">
            <Filter className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Design Stock Filters & Analysis
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Explore finished stock ledger using 10 dimensional filters (Godown, Design, Colour, Size, Aging, Movements, Lots)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--primary)] bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--card-bg)] transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Sync Stock
          </button>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--page-bg)] border border-[var(--border)] cursor-pointer"
          >
            {showPanel ? "Hide Filters" : "Show Filters"}
          </button>
        </div>
      </div>

      {showPanel && (
        <>
          {/* 10-DIMENSIONAL CONTROLS PANEL (Exact layout of Screenshot 1) */}
          <div className="bg-[var(--page-bg)] p-4 rounded-xl border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-[var(--primary)]" /> 10-DIMENSIONAL STOCK FILTERING CONTROLS
              </span>
              <button
                onClick={handleReset}
                className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>

            {/* Row 1: Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">1. Warehouse (Godown)</label>
                <select value={selectedGodown} onChange={(e) => setSelectedGodown(e.target.value)} className={inputSelectClass}>
                  <option value="all">All Warehouses</option>
                  {godowns.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">2. Design Number</label>
                <select value={selectedDesign} onChange={(e) => setSelectedDesign(e.target.value)} className={inputSelectClass}>
                  <option value="all">All Designs</option>
                  {designs.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.design_number} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">3. Colour</label>
                <select value={selectedColour} onChange={(e) => setSelectedColour(e.target.value)} className={inputSelectClass}>
                  <option value="all">All Colours</option>
                  {coloursList.map((cName) => (
                    <option key={cName} value={cName}>
                      {cName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">4. Size</label>
                <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} className={inputSelectClass}>
                  <option value="all">All Sizes</option>
                  {sizesList.map((sz) => (
                    <option key={sz} value={sz}>
                      Size {sz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">10. Production Lot</label>
                <select value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)} className={inputSelectClass}>
                  <option value="all">All Production Lots</option>
                  {lots.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.lot_number} ({l.total_quantity} pcs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Pill Switches & Search (Exact matching Screenshot 1) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
              {/* 5 & 6. Stock Aging */}
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">5 & 6. Stock Recency / Aging</label>
                <div className="flex p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl">
                  <button
                    onClick={() => setStockType("all")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      stockType === "all" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    All Stock
                  </button>
                  <button
                    onClick={() => setStockType("latest")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      stockType === "latest" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Latest Stock
                  </button>
                  <button
                    onClick={() => setStockType("old")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      stockType === "old" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Old Stock (&gt;30d)
                  </button>
                </div>
              </div>

              {/* 7 & 8. Stock Movement */}
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">7 & 8. Stock Movement</label>
                <div className="flex p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl">
                  <button
                    onClick={() => setMovementType("all")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      movementType === "all" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    All Movements
                  </button>
                  <button
                    onClick={() => setMovementType("stock_in")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      movementType === "stock_in" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Stock In
                  </button>
                  <button
                    onClick={() => setMovementType("stock_out")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      movementType === "stock_out" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Stock Out
                  </button>
                </div>
              </div>

              {/* 9. Grouping Mode */}
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">9. Grouping Mode</label>
                <div className="flex p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl">
                  <button
                    onClick={() => setViewMode("design_wise")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      viewMode === "design_wise" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Design-wise
                  </button>
                  <button
                    onClick={() => setViewMode("item_wise")}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      viewMode === "item_wise" ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Variant Item-wise
                  </button>
                </div>
              </div>

              {/* Search Keywords */}
              <div>
                <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">Search Keywords</label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search Design, Lot, Godown..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3 KPI SUMMARY CARDS (Exact replica of Screenshot 1) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-[var(--primary)] flex items-center justify-center shrink-0">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">TOTAL QUANTITY</p>
                <h3 className="text-xl font-extrabold text-[var(--text-primary)]">
                  {metrics.total_quantity || 0} <span className="text-xs font-bold text-[var(--text-muted)]">Pcs</span>
                </h3>
              </div>
            </div>

            <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">VALUATION AMOUNT</p>
                <h3 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(metrics.total_value || 0)}
                </h3>
              </div>
            </div>

            <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Filter className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">FILTERED RECORDS</p>
                <h3 className="text-xl font-extrabold text-[var(--text-primary)]">
                  {metrics.filtered_count || 0} Entries
                </h3>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
