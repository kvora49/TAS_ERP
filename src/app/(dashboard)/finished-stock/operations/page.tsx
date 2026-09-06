"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Boxes,
  Layers,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  ArrowRight,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  ChevronRight,
  Truck,
  FileText,
  Building2,
  DollarSign,
  AlertTriangle,
  ArrowLeftRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { PullToRefresh } from "@/components/shared/PullToRefresh";

interface StockAdjustment {
  id: string;
  adjustment_number: string;
  adjustment_type: "addition" | "deduction";
  adjustment_date: string;
  quantity_change: number;
  unit_cost: number;
  value_impact: number;
  reason: string;
  remarks?: string;
  size?: string;
  godown?: { name: string };
  design?: { code: string; name: string };
  colour?: { colour_name: string; colour_hex?: string };
}

interface GodownTransfer {
  id: string;
  transfer_number: string;
  transfer_date: string;
  source_godown?: { name: string };
  destination_godown?: { name: string };
  status: string;
  total_quantity: number;
  vehicle_number?: string;
}

interface DeliveryChallan {
  id: string;
  challan_number: string;
  challan_date: string;
  party_name?: string;
  transport_name?: string;
  total_quantity: number;
  total_amount: number;
  status: string;
}

export default function StockOperationsUnifiedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const tabFromUrl = (searchParams.get("tab") as "adjustments" | "transfers" | "challans") || "adjustments";
  const [activeTab, setActiveTab] = useState<"adjustments" | "transfers" | "challans">(tabFromUrl);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab && (currentTab === "adjustments" || currentTab === "transfers" || currentTab === "challans")) {
      setActiveTab(currentTab);
    }
  }, [searchParams]);

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments-list"] }),
      queryClient.invalidateQueries({ queryKey: ["godown-transfers-list"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-challans-list"] }),
    ]);
  };

  const handleTabChange = (tab: "adjustments" | "transfers" | "challans") => {
    setActiveTab(tab);
    router.push(`/finished-stock/operations?tab=${tab}`);
  };

  // 1. Fetch Stock Adjustments Data
  const { data: adjustmentsData, isLoading: loadingAdjustments } = useQuery<{ adjustments: StockAdjustment[] }>({
    queryKey: ["stock-adjustments-list"],
    queryFn: async () => {
      const res = await fetch("/api/finished-stock/adjustments");
      return res.json();
    },
  });
  const adjustmentsList = adjustmentsData?.adjustments || [];

  // 2. Fetch Godown Transfers Data
  const { data: transfersData, isLoading: loadingTransfers } = useQuery<{ transfers: GodownTransfer[] }>({
    queryKey: ["godown-transfers-list"],
    queryFn: async () => {
      const res = await fetch("/api/finished-stock/transfers");
      return res.json();
    },
  });
  const transfersList = transfersData?.transfers || [];

  // 3. Fetch Delivery Challans Data
  const { data: challansData, isLoading: loadingChallans } = useQuery<{ challans: DeliveryChallan[] }>({
    queryKey: ["delivery-challans-list"],
    queryFn: async () => {
      const res = await fetch("/api/finished-stock/challans");
      return res.json();
    },
  });
  const challansList = challansData?.challans || [];

  // Filtered Lists
  const filteredAdjustments = useMemo(() => {
    return adjustmentsList.filter(
      (a) =>
        a.adjustment_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.design?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.design?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.reason?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [adjustmentsList, searchQuery]);

  const filteredTransfers = useMemo(() => {
    return transfersList.filter(
      (t) =>
        t.transfer_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.source_godown?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destination_godown?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transfersList, searchQuery]);

  const filteredChallans = useMemo(() => {
    return challansList.filter(
      (c) =>
        c.challan_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.party_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [challansList, searchQuery]);
  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <Link href="/" className="hover:text-[var(--primary)] transition-colors">
            Dashboard
          </Link>
          <ChevronRight size={12} className="text-[var(--text-faint)]" />
          <Link href="/finished-stock" className="hover:text-[var(--primary)] transition-colors">
            Finished Stock
          </Link>
          <ChevronRight size={12} className="text-[var(--text-faint)]" />
          <span className="text-[var(--text-primary)] font-bold">Stock Operations</span>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "adjustments" && (
            <Link
              href="/finished-stock/adjustments/new"
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-4 py-2 rounded-xl transition-all shadow-md"
            >
              <Plus size={15} />
              <span>+ New Stock Adjustment</span>
            </Link>
          )}

          {activeTab === "transfers" && (
            <Link
              href="/finished-stock/transfers/new"
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-4 py-2 rounded-xl transition-all shadow-md"
            >
              <Plus size={15} />
              <span>+ New Godown Transfer</span>
            </Link>
          )}

          {activeTab === "challans" && (
            <Link
              href="/finished-stock/challans/new"
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-dark)] px-4 py-2 rounded-xl transition-all shadow-md"
            >
              <Plus size={15} />
              <span>+ Create Delivery Challan</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] p-4 sm:p-6 rounded-2xl shadow-[var(--shadow-sm)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">Stock Operations & Movements</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
              Manage stock reconciliations, inter-godown inventory transfers, and outgoing delivery challans in one place.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[var(--page-bg)] p-2 rounded-xl border border-[var(--border)]">
            <Search size={14} className="text-[var(--text-faint)] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher #, SKU, godown..."
              className="bg-transparent text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none w-full sm:w-64"
            />
          </div>
        </div>

        {/* 3 Main Workspace Navigation Tabs */}
        <div className="border-t border-[var(--border-light)] pt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleTabChange("adjustments")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === "adjustments"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-[var(--page-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--table-row-hover)]"
            }`}
          >
            <RotateCcw size={14} />
            <span>1. Adjustments</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === "adjustments" ? "bg-black/20 text-white" : "bg-[var(--card-bg)] text-[var(--text-secondary)]"}`}>
              {adjustmentsList.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("transfers")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === "transfers"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-[var(--page-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--table-row-hover)]"
            }`}
          >
            <ArrowLeftRight size={14} />
            <span>2. Transfers</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === "transfers" ? "bg-black/20 text-white" : "bg-[var(--card-bg)] text-[var(--text-secondary)]"}`}>
              {transfersList.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("challans")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === "challans"
                ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md"
                : "bg-[var(--page-bg)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--table-row-hover)]"
            }`}
          >
            <Truck size={14} />
            <span>3. Delivery Challans</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === "challans" ? "bg-black/20 text-white" : "bg-[var(--card-bg)] text-[var(--text-secondary)]"}`}>
              {challansList.length}
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: STOCK ADJUSTMENTS & COST RECALCULATION ENGINE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "adjustments" && (
        <div className="space-y-4">
          <div className="bg-[var(--primary-light)] border border-[var(--primary)]/20 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-[var(--primary)] h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--text-primary)] space-y-1">
              <p className="font-extrabold">Weighted Average Unit Cost (WAC) Adjustment Engine Enabled</p>
              <p className="leading-relaxed font-medium text-[var(--text-secondary)]">
                When physical stock is reduced (loss/damage), remaining item unit costs increase dynamically (New Unit Cost = Total Valuation / Remaining Qty). When surplus stock is added without cost, unit cost dilutes across total quantity.
              </p>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden p-4 sm:p-5 space-y-4">
            {loadingAdjustments ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto" />
                <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">Loading stock adjustments log...</p>
              </div>
            ) : filteredAdjustments.length === 0 ? (
              <div className="py-16 text-center bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
                <RotateCcw className="mx-auto text-[var(--text-faint)] h-10 w-10 mb-2" />
                <p className="text-sm font-bold text-[var(--text-primary)]">No Stock Adjustments Found</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Click &quot;+ New Stock Adjustment&quot; to record inventory reconciliation.</p>
              </div>
            ) : (
              <>
                {/* ── MOBILE: Adjustments Card List ── */}
                <div className="md:hidden space-y-3">
                  {filteredAdjustments.map((adj) => {
                    const isDeduction = adj.adjustment_type === "deduction";
                    return (
                      <div key={adj.id} className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-[var(--primary)]">{adj.adjustment_number || "ADJ-AUTO"}</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              isDeduction
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {adj.adjustment_type}
                          </span>
                        </div>

                        <div>
                          <p className="font-bold text-sm text-[var(--text-primary)]">
                            {adj.design?.code} - {adj.design?.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            Godown: <span className="font-semibold text-[var(--text-secondary)]">{adj.godown?.name || "—"}</span> · Size: <span className="font-semibold text-[var(--text-secondary)]">{adj.size || "All"}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-[var(--border-light)] pt-2 text-xs">
                          <div>
                            <span className="text-[10px] text-[var(--text-muted)]">Qty Change</span>
                            <p className={`font-bold font-mono ${isDeduction ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {isDeduction ? "-" : "+"}{Math.abs(adj.quantity_change)} Pcs
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--text-muted)]">Unit Cost</span>
                            <p className="font-bold font-mono text-[var(--text-primary)]">₹{Number(adj.unit_cost || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-[var(--text-muted)]">Impact</span>
                            <p className="font-bold font-mono text-[var(--text-primary)]">{formatCurrency(Number(adj.value_impact || 0))}</p>
                          </div>
                        </div>

                        {adj.reason && (
                          <div className="text-[11px] text-[var(--text-muted)] bg-[var(--card-bg)] p-2 rounded-lg border border-[var(--border-light)]">
                            Reason: <span className="font-medium text-[var(--text-secondary)]">{adj.reason}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── DESKTOP: Adjustments Table ── */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Voucher #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Godown</th>
                        <th className="py-3 px-4">Design SKU / Item</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Qty Change</th>
                        <th className="py-3 px-4 text-right">Original Cost</th>
                        <th className="py-3 px-4 text-right">Recalculated Unit Cost</th>
                        <th className="py-3 px-4 text-right">Total Impact</th>
                        <th className="py-3 px-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
                      {filteredAdjustments.map((adj) => {
                        const isDeduction = adj.adjustment_type === "deduction";
                        return (
                          <tr key={adj.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                            <td className="py-3 px-4 font-bold text-[var(--primary)]">{adj.adjustment_number || "ADJ-AUTO"}</td>
                            <td className="py-3 px-4 text-[var(--text-secondary)]">{adj.adjustment_date}</td>
                            <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{adj.godown?.name || "—"}</td>
                            <td className="py-3 px-4 font-bold">
                              {adj.design?.code} - {adj.design?.name} ({adj.size || "All"})
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  isDeduction
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {adj.adjustment_type}
                              </span>
                            </td>
                            <td className={`py-3 px-4 text-right font-extrabold ${isDeduction ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                              {isDeduction ? "-" : "+"}{Math.abs(adj.quantity_change)} Pcs
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--text-muted)]">₹{Number(adj.unit_cost || 0).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-extrabold text-[var(--primary)]">
                              ₹{Number(adj.unit_cost || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-[var(--text-primary)]">
                              {formatCurrency(Number(adj.value_impact || 0))}
                            </td>
                            <td className="py-3 px-4 text-[var(--text-secondary)] font-semibold">{adj.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: INTER-GODOWN TRANSFERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "transfers" && (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden p-4 sm:p-5 space-y-4">
          {loadingTransfers ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto" />
              <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">Loading godown transfers...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="py-16 text-center bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
              <ArrowLeftRight className="mx-auto text-[var(--text-faint)] h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-[var(--text-primary)]">No Inter-Godown Transfers Recorded</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Click &quot;+ New Godown Transfer&quot; to transfer stock between storage locations.</p>
            </div>
          ) : (
            <>
              {/* ── MOBILE: Transfers Card List ── */}
              <div className="md:hidden space-y-3">
                {filteredTransfers.map((tr) => (
                  <div key={tr.id} className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-[var(--primary)]">{tr.transfer_number}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {tr.status || "completed"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                      <span>{tr.source_godown?.name || "—"}</span>
                      <ArrowRight size={12} className="text-[var(--text-muted)]" />
                      <span className="text-emerald-600 dark:text-emerald-400">{tr.destination_godown?.name || "—"}</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Qty</span>
                        <p className="font-bold font-mono text-[var(--text-primary)]">{tr.total_quantity?.toLocaleString("en-IN")} Pcs</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Vehicle</span>
                        <p className="font-mono text-xs text-[var(--text-secondary)]">{tr.vehicle_number || "—"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Date</span>
                        <p className="text-xs text-[var(--text-secondary)]">{tr.transfer_date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: Transfers Table ── */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Transfer #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">From Godown</th>
                      <th className="py-3 px-4">To Godown</th>
                      <th className="py-3 px-4 text-right">Total Transferred Pcs</th>
                      <th className="py-3 px-4">Vehicle / Driver Ref</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
                    {filteredTransfers.map((tr) => (
                      <tr key={tr.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="py-3 px-4 font-bold text-[var(--primary)]">{tr.transfer_number}</td>
                        <td className="py-3 px-4 text-[var(--text-secondary)]">{tr.transfer_date}</td>
                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">{tr.source_godown?.name || "—"}</td>
                        <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">{tr.destination_godown?.name || "—"}</td>
                        <td className="py-3 px-4 text-right font-extrabold">{tr.total_quantity?.toLocaleString("en-IN")} Pcs</td>
                        <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{tr.vehicle_number || "—"}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {tr.status || "completed"}
                          </span>
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
      {/* ------------------------------------------------------------- */}
      {/* TAB 3: DELIVERY CHALLANS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "challans" && (
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden p-4 sm:p-5 space-y-4">
          {loadingChallans ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto" />
              <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">Loading delivery challans...</p>
            </div>
          ) : filteredChallans.length === 0 ? (
            <div className="py-16 text-center bg-[var(--page-bg)] rounded-xl border border-dashed border-[var(--border)]">
              <Truck className="mx-auto text-[var(--text-faint)] h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-[var(--text-primary)]">No Delivery Challans Found</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Click &quot;+ Create Delivery Challan&quot; to generate dispatch vouchers.</p>
            </div>
          ) : (
            <>
              {/* ── MOBILE: Challans Card List ── */}
              <div className="md:hidden space-y-3">
                {filteredChallans.map((ch) => (
                  <div key={ch.id} className="bg-[var(--page-bg)] border border-[var(--border)] rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-[var(--primary)]">{ch.challan_number}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {ch.status || "dispatched"}
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-sm text-[var(--text-primary)]">{ch.party_name || "—"}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Transport: {ch.transport_name || "—"}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-[var(--border-light)] pt-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Qty</span>
                        <p className="font-bold font-mono text-[var(--text-primary)]">{ch.total_quantity?.toLocaleString("en-IN")} Pcs</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Dispatched Value</span>
                        <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(ch.total_amount || 0))}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)]">Date</span>
                        <p className="text-xs text-[var(--text-secondary)]">{ch.challan_date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── DESKTOP: Challans Table ── */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Challan #</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Recipient Party</th>
                      <th className="py-3 px-4">Transport Ref</th>
                      <th className="py-3 px-4 text-right">Total Pcs</th>
                      <th className="py-3 px-4 text-right">Dispatched Value</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] font-medium text-[var(--text-primary)]">
                    {filteredChallans.map((ch) => (
                      <tr key={ch.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="py-3 px-4 font-bold text-[var(--primary)]">{ch.challan_number}</td>
                        <td className="py-3 px-4 text-[var(--text-secondary)]">{ch.challan_date}</td>
                        <td className="py-3 px-4 font-bold text-[var(--text-primary)]">{ch.party_name || "—"}</td>
                        <td className="py-3 px-4 text-[var(--text-muted)]">{ch.transport_name || "—"}</td>
                        <td className="py-3 px-4 text-right font-extrabold">{ch.total_quantity?.toLocaleString("en-IN")} Pcs</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(ch.total_amount || 0))}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {ch.status || "dispatched"}
                          </span>
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
      </div>
    </PullToRefresh>
  );
}
