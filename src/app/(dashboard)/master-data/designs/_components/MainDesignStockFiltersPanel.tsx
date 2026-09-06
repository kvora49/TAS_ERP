"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, RefreshCw, Search, Boxes, Layers, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";

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
  // Collapsed by default as requested
  const [showPanel, setShowPanel] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 10 Filter States
  const [selectedGodown, setSelectedGodown] = useState<string>("all");
  const [selectedDesign, setSelectedDesign] = useState<string>("all");
  const [selectedColour, setSelectedColour] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [selectedLot, setSelectedLot] = useState<string>("all");
  const [stockType, setStockType] = useState<"all" | "latest" | "old">("all");
  const [movementType, setMovementType] = useState<"all" | "stock_in" | "stock_out">("all");
  const [viewMode, setViewMode] = useState<"design_wise" | "item_wise">("design_wise");
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedGodown !== "all") count++;
    if (selectedDesign !== "all") count++;
    if (selectedColour !== "all") count++;
    if (selectedSize !== "all") count++;
    if (selectedLot !== "all") count++;
    if (stockType !== "all") count++;
    if (movementType !== "all") count++;
    if (viewMode !== "design_wise") count++;
    if (searchQuery.trim()) count++;
    return count;
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
  ]);

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
  const { data: stockData, refetch } = useQuery({
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
    focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] focus:border-transparent
    rounded-lg px-2.5 h-9 text-xs font-semibold
    transition-colors w-full cursor-pointer
  `;

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-5 shadow-[var(--shadow-sm)] space-y-3 sm:space-y-4">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)] shrink-0 font-bold">
            <Filter size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight truncate">
                Stock Filters & Analysis
              </h2>
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary)] text-white shrink-0">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] truncate hidden sm:block">
              Multi-dimensional ledger filtering by godown, design, colour, size & lot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isSyncing}
            onClick={async () => {
              setIsSyncing(true);
              try {
                const res = await fetch("/api/finished-stock/reconcile", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                if (!res.ok) throw new Error("Reconciliation failed");
                toast.success("Finished stock reconciled!");
                refetch();
              } catch (err: any) {
                toast.error(err.message || "Failed to reconcile finished stock");
              } finally {
                setIsSyncing(false);
              }
            }}
            className="flex items-center gap-1.5 px-3 h-8 sm:h-9 rounded-xl text-xs font-semibold text-[var(--primary)] bg-[var(--page-bg)] border border-[var(--border)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            <span className="hidden min-[380px]:inline">Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPanel(!showPanel)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 sm:h-9 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              showPanel
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm"
                : "bg-[var(--page-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--table-row-hover)]"
            )}
          >
            <Filter size={13} />
            <span>{showPanel ? "Hide Filters" : "Show Filters"}</span>
            {showPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {showPanel && (
        <div className="space-y-3 pt-1 border-t border-[var(--border-light)] animate-fadeIn">
          {/* 10-DIMENSIONAL CONTROLS PANEL (Compact Grid Layout) */}
          <div className="bg-[var(--page-bg)] p-3 sm:p-4 rounded-xl border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Filter className="h-3 w-3 text-[var(--primary)]" /> Stock Filter Dimensions
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>

            {/* Row 1: Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  1. Godown
                </label>
                <select
                  value={selectedGodown}
                  onChange={(e) => setSelectedGodown(e.target.value)}
                  className={inputSelectClass}
                >
                  <option value="all">All Godowns</option>
                  {godowns.map((g: any) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  2. Design
                </label>
                <select
                  value={selectedDesign}
                  onChange={(e) => setSelectedDesign(e.target.value)}
                  className={inputSelectClass}
                >
                  <option value="all">All Designs</option>
                  {designs.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.design_number} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  3. Colour
                </label>
                <select
                  value={selectedColour}
                  onChange={(e) => setSelectedColour(e.target.value)}
                  className={inputSelectClass}
                >
                  <option value="all">All Colours</option>
                  {coloursList.map((cName) => (
                    <option key={cName} value={cName}>
                      {cName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  4. Size
                </label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className={inputSelectClass}
                >
                  <option value="all">All Sizes</option>
                  {sizesList.map((sz) => (
                    <option key={sz} value={sz}>
                      Size {sz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  5. Production Lot
                </label>
                <select
                  value={selectedLot}
                  onChange={(e) => setSelectedLot(e.target.value)}
                  className={inputSelectClass}
                >
                  <option value="all">All Lots</option>
                  {lots.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.lot_number} ({l.total_quantity} pcs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Switches & Search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 pt-0.5">
              {/* Stock Aging */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  Stock Recency
                </label>
                <div className="flex p-0.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setStockType("all")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      stockType === "all"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockType("latest")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      stockType === "latest"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Latest
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockType("old")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      stockType === "old"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Old (&gt;30d)
                  </button>
                </div>
              </div>

              {/* Stock Movement */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  Movement
                </label>
                <div className="flex p-0.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMovementType("all")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      movementType === "all"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType("stock_in")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      movementType === "stock_in"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    In
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType("stock_out")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      movementType === "stock_out"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Out
                  </button>
                </div>
              </div>

              {/* Grouping Mode */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  Grouping Mode
                </label>
                <div className="flex p-0.5 bg-[var(--card-bg)] border border-[var(--border)] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode("design_wise")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      viewMode === "design_wise"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Design-wise
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("item_wise")}
                    className={cn(
                      "flex-1 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer",
                      viewMode === "item_wise"
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Variant-wise
                  </button>
                </div>
              </div>

              {/* Search Keywords */}
              <div>
                <label className="text-[10px] font-bold text-[var(--text-muted)] block mb-1">
                  Keywords
                </label>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search lot, code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2x2 RESPONSIVE KPI CARDS GRID */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                <Boxes className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
                  Total Quantity
                </p>
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
                  {metrics.total_quantity || 0}{" "}
                  <span className="text-[10px] font-semibold text-[var(--text-muted)]">Pcs</span>
                </h3>
              </div>
            </div>

            <div className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
                  Valuation Amount
                </p>
                <h3 className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                  {formatCurrency(metrics.total_value || 0)}
                </h3>
              </div>
            </div>

            <div className="col-span-2 lg:col-span-1 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Filter className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">
                  Filtered Records
                </p>
                <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] truncate">
                  {metrics.filtered_count || 0}{" "}
                  <span className="text-[10px] font-semibold text-[var(--text-muted)]">Entries</span>
                </h3>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
