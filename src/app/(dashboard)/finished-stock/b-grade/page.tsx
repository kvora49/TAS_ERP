"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Package,
  Boxes,
  Warehouse,
  ArrowLeft,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Trash2,
  ChevronRight,
  IndianRupee,
  ShoppingCart,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageState from "@/components/shared/PageState";
import { Modal } from "@/components/shared/Modal";
import AsyncButton from "@/components/shared/AsyncButton";
import ColourDot from "@/components/shared/ColourDot";
import { formatCurrency, cn } from "@/lib/utils";
import { useBGradeStock, BGradeStockItem } from "@/hooks/queries/useDefects";
import { usePartiesList } from "@/hooks/queries/useParties";

export default function BGradeStockPage() {
  const queryClient = useQueryClient();
  const [godownFilter, setGodownFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("available");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data, isLoading, error, refetch } = useBGradeStock({
    godown_id: godownFilter !== "all" ? godownFilter : undefined,
    status: statusFilter,
    search: searchQuery,
  });

  const stockList = data?.stock || [];
  const stats = data?.stats || {
    total_quantity: 0,
    total_value: 0,
    unique_designs: 0,
    active_godowns: 0,
    godown_breakdown: [],
    design_breakdown: [],
    size_breakdown: [],
  };

  // Price Edit Modal
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BGradeStockItem | null>(null);
  const [salePriceInput, setSalePriceInput] = useState<string>("");

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const res = await fetch("/api/production/b-grade-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, b_grade_sale_price: price }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update price");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b-grade-stock"] });
      toast.success("B-Grade sale price updated successfully");
      setPriceModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update price");
    },
  });

  const handleOpenPriceModal = (item: BGradeStockItem) => {
    setEditingItem(item);
    setSalePriceInput(item.b_grade_sale_price ? String(item.b_grade_sale_price) : "");
    setPriceModalOpen(true);
  };

  const handleSavePrice = async () => {
    if (!editingItem) return;
    const price = parseFloat(salePriceInput);
    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid positive sale price");
      return;
    }
    await updatePriceMutation.mutateAsync({ id: editingItem.id, price });
  };

  const { data: partiesData } = usePartiesList("customer");
  const customers = partiesData?.parties || [];

  // Quick Sell Modal
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellingItem, setSellingItem] = useState<BGradeStockItem | null>(null);
  const [sellPartyId, setSellPartyId] = useState<string>("");
  const [sellRateInput, setSellRateInput] = useState<string>("");
  const [sellSizeQuantities, setSellSizeQuantities] = useState<Record<string, number>>({});
  const [sellRemarks, setSellRemarks] = useState<string>("");

  const sellStockMutation = useMutation({
    mutationFn: async (payload: {
      b_grade_stock_id: string;
      qty_sold: number;
      sale_rate: number;
      party_id?: string;
      size_quantities?: Record<string, number>;
      remarks?: string;
    }) => {
      const res = await fetch("/api/production/b-grade-stock/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record sale");
      }
      return res.json();
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ["b-grade-stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-ledger"] });
      toast.success(`Successfully sold ${resData?.sale?.qty_sold || "selected"} pieces of B-Grade stock`);
      setSellModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record sale");
    },
  });

  const handleOpenSellModal = (item: BGradeStockItem) => {
    setSellingItem(item);
    setSellPartyId("");
    setSellRateInput(item.b_grade_sale_price ? String(item.b_grade_sale_price) : String(item.cost_per_piece || ""));
    const initSizes: Record<string, number> = {};
    for (const [sz, q] of Object.entries(item.size_quantities || {})) {
      initSizes[sz] = Math.max(0, Number(q) || 0);
    }
    setSellSizeQuantities(initSizes);
    setSellRemarks("");
    setSellModalOpen(true);
  };

  const totalSellQty = Object.values(sellSizeQuantities).reduce(
    (acc, v) => acc + Math.max(0, Number(v) || 0),
    0
  );
  const sellRate = parseFloat(sellRateInput);
  const totalSellValue = !isNaN(sellRate) && sellRate >= 0 ? totalSellQty * sellRate : 0;

  const handleConfirmSell = async () => {
    if (!sellingItem) return;
    if (isNaN(sellRate) || sellRate < 0) {
      toast.error("Please enter a valid positive sale rate");
      return;
    }
    if (totalSellQty <= 0) {
      toast.error("Please allocate at least 1 piece to sell");
      return;
    }

    const availableSizes = sellingItem.size_quantities || {};
    for (const [sz, q] of Object.entries(sellSizeQuantities)) {
      const avail = Number(availableSizes[sz] || 0);
      if (q > avail) {
        toast.error(`Size ${sz}: cannot sell ${q} pcs. Only ${avail} available.`);
        return;
      }
    }

    await sellStockMutation.mutateAsync({
      b_grade_stock_id: sellingItem.id,
      qty_sold: totalSellQty,
      sale_rate: sellRate,
      party_id: sellPartyId || undefined,
      size_quantities: sellSizeQuantities,
      remarks: sellRemarks.trim() || undefined,
    });
  };

  return (
    <div className="p-2.5 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/finished-stock"
              className="text-xs font-semibold text-[var(--text-muted)] hover:text-primary transition flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Finished Stock
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Package className="h-6 w-6 text-orange-500" />
            B-Grade & Aatri Stock Register
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Inventory register for second-grade, shade variance, and slightly defective jeans stored separately from Grade A finished goods.
          </p>
        </div>
      </div>

      {/* ── METRICS CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Total B-Grade Stock</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {stats.total_quantity}
            </span>
            <span className="text-xs text-orange-600/70">pcs</span>
          </div>
          <span className="text-[11px] text-orange-600/80 mt-1 block">In godowns ready for sale</span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-[var(--text-muted)]">Estimated Cost Valuation</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {formatCurrency(stats.total_value)}
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-faint)] mt-1 block">Cost value from production</span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-[var(--text-muted)]">Affected Designs</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.unique_designs}
            </span>
            <span className="text-xs text-[var(--text-faint)]">designs</span>
          </div>
          <span className="text-[11px] text-[var(--text-faint)] mt-1 block">With B-grade pieces</span>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)]">
          <span className="text-xs font-medium text-[var(--text-muted)]">Godown Locations</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">
              {stats.active_godowns}
            </span>
            <span className="text-xs text-[var(--text-faint)]">godowns</span>
          </div>
          <span className="text-[11px] text-[var(--text-faint)] mt-1 block">Holding B-grade inventory</span>
        </div>
      </div>

      {/* ── FILTER & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search by design code, lot number, godown, or defect reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-10 text-sm"
          >
            <option value="available">Available (In Stock)</option>
            <option value="partially_sold">Partially Sold</option>
            <option value="fully_sold">Fully Sold</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {/* ── DATA TABLE / PAGE STATE ─────────────────────────────────────── */}
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={error?.message}
        onRetry={refetch}
        isEmpty={stockList.length === 0}
        skeletonVariant="table"
        skeletonRows={6}
        skeletonColumns={6}
        emptyTitle="No B-Grade Stock Found"
        emptyDescription="There are currently no B-grade pieces recorded in your inventory. Any defects resolved as 'B-Grade' from production lots will appear here automatically."
      >
        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-3">
          {stockList.map((item) => {
            const sizes = item.size_quantities || {};
            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-[var(--text-primary)]">
                      {item.design?.design_number || item.design?.name || "N/A"}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                      {item.design?.name && item.design.design_number && (
                        <span>{item.design.name}</span>
                      )}
                      {item.lot && (
                        <Link
                          href={`/production/lots/${item.lot.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          Lot #{item.lot.lot_number}
                        </Link>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] font-medium px-2 py-0.5 rounded bg-[var(--page-bg)] border border-[var(--border)]">
                    <Warehouse className="h-3 w-3 text-[var(--text-faint)]" />
                    {item.godown?.name || "Unknown"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {item.colour && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-body)]">
                      <ColourDot colourHex={item.colour.colour_hex} size="sm" />
                      <span>{item.colour.colour_name}</span>
                    </div>
                  )}
                  {item.resolution?.defect && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                      {item.resolution.defect.defect_category} ({item.resolution.defect.defect_number})
                    </span>
                  )}
                </div>

                {/* Sizes */}
                {Object.keys(sizes).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {Object.entries(sizes).map(([sz, q]) => (
                      <span
                        key={sz}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--page-bg)] border border-[var(--border)] text-[11px] font-mono"
                      >
                        <span className="text-[var(--text-muted)]">{sz}:</span>
                        <strong className="text-orange-600 dark:text-orange-400">{q}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Quantity, Cost, Sale Price, Valuation */}
                <div className="pt-2 border-t border-[var(--border-light)] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text-faint)] text-[10px] block">Stock Quantity</span>
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      {item.total_quantity} <span className="text-xs font-normal text-[var(--text-faint)]">pcs</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[var(--text-faint)] text-[10px] block">Valuation</span>
                    <span className="font-bold font-mono text-[var(--text-primary)]">
                      {formatCurrency(item.total_value)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-faint)] text-[10px] block">Unit Cost</span>
                    <span className="font-mono text-[var(--text-muted)]">
                      {formatCurrency(item.cost_per_piece)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[var(--text-faint)] text-[10px] block">B-Grade Sale Price</span>
                    {item.b_grade_sale_price ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(item.b_grade_sale_price)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-faint)] italic">Not set</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-light)] flex gap-2 justify-end">
                  <button
                    onClick={() => handleOpenPriceModal(item)}
                    className="flex-1 py-1.5 bg-[var(--page-bg)] hover:bg-[var(--primary-light)] text-[var(--text-primary)] hover:text-primary border border-[var(--border)] rounded-lg text-xs font-semibold transition text-center"
                  >
                    {item.b_grade_sale_price ? "Edit Price" : "Set Price"}
                  </button>
                  <button
                    onClick={() => handleOpenSellModal(item)}
                    disabled={item.total_quantity <= 0}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Sell Stock
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block rounded-xl border border-[var(--border)] bg-[var(--card-bg)] shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Design & Lot</th>
                  <th className="p-3.5">Colour</th>
                  <th className="p-3.5">Godown</th>
                  <th className="p-3.5">Size Breakdown</th>
                  <th className="p-3.5 text-right">Total Qty</th>
                  <th className="p-3.5 text-right">Unit Cost</th>
                  <th className="p-3.5 text-right">B-Grade Sale Price</th>
                  <th className="p-3.5 text-right">Valuation</th>
                  <th className="p-3.5 text-center">Origin Defect</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {stockList.map((item) => {
                  const sizes = item.size_quantities || {};
                  return (
                    <tr key={item.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      {/* Design & Lot */}
                      <td className="p-3.5">
                        <div className="font-semibold text-sm text-[var(--text-primary)]">
                          {item.design?.design_number || item.design?.name || "N/A"}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                          {item.design?.name && item.design.design_number && (
                            <span>{item.design.name}</span>
                          )}
                          {item.lot && (
                            <Link
                              href={`/production/lots/${item.lot.id}`}
                              className="font-mono text-primary hover:underline"
                            >
                              Lot #{item.lot.lot_number}
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Colour */}
                      <td className="p-3.5">
                        {item.colour ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-body)]">
                            <ColourDot colourHex={item.colour.colour_hex} size="sm" />
                            <span>{item.colour.colour_name}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-faint)]">—</span>
                        )}
                      </td>

                      {/* Godown */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 text-[var(--text-secondary)] font-medium">
                          <Warehouse className="h-3.5 w-3.5 text-[var(--text-faint)]" />
                          {item.godown?.name || "Unknown"}
                        </span>
                      </td>

                      {/* Size Matrix Breakdown */}
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {Object.entries(sizes).map(([sz, q]) => (
                            <span
                              key={sz}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--page-bg)] border border-[var(--border)] text-[11px] font-mono"
                            >
                              <span className="text-[var(--text-muted)]">{sz}:</span>
                              <strong className="text-orange-600 dark:text-orange-400">{q}</strong>
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Total Quantity */}
                      <td className="p-3.5 text-right font-bold text-sm text-[var(--text-primary)]">
                        {item.total_quantity} <span className="text-xs font-normal text-[var(--text-faint)]">pcs</span>
                      </td>

                      {/* Unit Cost */}
                      <td className="p-3.5 text-right font-mono text-[var(--text-muted)]">
                        {formatCurrency(item.cost_per_piece)}
                      </td>

                      {/* B-Grade Sale Price */}
                      <td className="p-3.5 text-right">
                        {item.b_grade_sale_price ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                            {formatCurrency(item.b_grade_sale_price)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--text-faint)] italic">Not set</span>
                        )}
                      </td>

                      {/* Total Valuation */}
                      <td className="p-3.5 text-right font-bold font-mono text-[var(--text-primary)]">
                        {formatCurrency(item.total_value)}
                      </td>

                      {/* Origin Defect */}
                      <td className="p-3.5 text-center">
                        {item.resolution?.defect ? (
                          <div className="inline-block text-left">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              {item.resolution.defect.defect_category}
                            </span>
                            <span className="block text-[10px] font-mono text-[var(--text-faint)] mt-0.5">
                              {item.resolution.defect.defect_number}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-faint)]">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenPriceModal(item)}
                            className="px-2.5 py-1 bg-[var(--page-bg)] hover:bg-[var(--primary-light)] text-[var(--text-primary)] hover:text-primary border border-[var(--border)] rounded-md text-[11px] font-semibold transition"
                          >
                            {item.b_grade_sale_price ? "Edit Price" : "Set Price"}
                          </button>
                          <button
                            onClick={() => handleOpenSellModal(item)}
                            disabled={item.total_quantity <= 0}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold transition flex items-center gap-1"
                          >
                            <ShoppingCart className="h-3 w-3" />
                            Sell
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </PageState>

      {/* ── SET B-GRADE SALE PRICE MODAL ─────────────────────────────────── */}
      <Modal
        open={priceModalOpen}
        onOpenChange={setPriceModalOpen}
        title="Set B-Grade Selling Price"
        maxWidth="max-w-md"
      >
        {editingItem && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] text-xs space-y-1">
              <div>
                <strong>Design:</strong> {editingItem.design?.design_number || editingItem.design?.name}
              </div>
              <div>
                <strong>Stock Qty:</strong> {editingItem.total_quantity} pcs in {editingItem.godown?.name}
              </div>
              <div>
                <strong>Production Cost:</strong> {formatCurrency(editingItem.cost_per_piece)}/pc
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                B-Grade Discounted Selling Price (₹/pc) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 250"
                  value={salePriceInput}
                  onChange={(e) => setSalePriceInput(e.target.value)}
                  className="w-full pl-9 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                  autoFocus
                />
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                This price will be used when selling these B-grade pieces on sales bills.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setPriceModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition"
              >
                Cancel
              </button>
              <AsyncButton onClick={handleSavePrice} variant="primary">
                Save Price
              </AsyncButton>
            </div>
          </div>
        )}
      </Modal>

      {/* ── QUICK SELL B-GRADE STOCK MODAL ─────────────────────────────── */}
      <Modal
        open={sellModalOpen}
        onOpenChange={setSellModalOpen}
        title="Quick Sell B-Grade Stock"
        maxWidth="max-w-lg"
      >
        {sellingItem && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] text-xs space-y-1">
              <div className="flex justify-between">
                <span><strong>Design:</strong> {sellingItem.design?.design_number || sellingItem.design?.name}</span>
                <span><strong>Available:</strong> <span className="font-bold text-amber-600 dark:text-amber-400">{sellingItem.total_quantity} pcs</span></span>
              </div>
              <div className="flex justify-between">
                <span><strong>Godown:</strong> {sellingItem.godown?.name}</span>
                <span><strong>Unit Cost:</strong> {formatCurrency(sellingItem.cost_per_piece)}</span>
              </div>
            </div>

            {/* Customer Selection */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Customer / Buyer (Optional)
              </label>
              <select
                value={sellPartyId}
                onChange={(e) => setSellPartyId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              >
                <option value="">-- Cash / Direct Buyer --</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.city ? `(${c.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Sale Rate */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Sale Rate (₹/pc) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Rate per piece"
                  value={sellRateInput}
                  onChange={(e) => setSellRateInput(e.target.value)}
                  className="w-full pl-9 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                />
              </div>
            </div>

            {/* Size quantities breakdown */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Quantity to Sell by Size <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Object.entries(sellingItem.size_quantities || {}).map(([sz, avail]) => (
                  <div key={sz} className="p-2 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] text-center">
                    <div className="text-[11px] font-bold text-[var(--text-primary)] uppercase">{sz}</div>
                    <div className="text-[10px] text-[var(--text-faint)] mb-1">Avail: {Number(avail) || 0}</div>
                    <input
                      type="number"
                      min="0"
                      max={Number(avail) || 0}
                      value={sellSizeQuantities[sz] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setSellSizeQuantities((prev) => ({ ...prev, [sz]: val }));
                      }}
                      className="w-full text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded h-8 text-xs font-semibold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Summary & Remarks */}
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex justify-between items-center">
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">TOTAL PCS</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalSellQty} pcs</span>
              </div>
              <div className="text-right">
                <span className="text-[var(--text-muted)] block text-[10px]">TOTAL AMOUNT</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSellValue)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5">
                Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Clearance sale, lot clearance, cash received"
                value={sellRemarks}
                onChange={(e) => setSellRemarks(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSellModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--page-bg)] transition"
              >
                Cancel
              </button>
              <AsyncButton onClick={handleConfirmSell} variant="primary">
                Confirm & Deduct Stock
              </AsyncButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
