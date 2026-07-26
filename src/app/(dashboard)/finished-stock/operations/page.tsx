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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <Link href="/" className="hover:text-[#6366F1] transition-colors">
            Dashboard
          </Link>
          <ChevronRight size={12} className="text-slate-400" />
          <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
            Finished Stock
          </Link>
          <ChevronRight size={12} className="text-slate-400" />
          <span className="text-[#334155] font-extrabold">Stock Operations & Movements</span>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "adjustments" && (
            <Link
              href="/finished-stock/adjustments/new"
              className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-[#5B63D3] hover:bg-[#4F55C3] px-4 py-2 rounded-xl transition-all shadow-md"
            >
              <Plus size={15} />
              <span>+ New Stock Adjustment</span>
            </Link>
          )}

          {activeTab === "transfers" && (
            <Link
              href="/finished-stock/transfers/new"
              className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-[#5B63D3] hover:bg-[#4F55C3] px-4 py-2 rounded-xl transition-all shadow-md"
            >
              <Plus size={15} />
              <span>+ New Godown Transfer</span>
            </Link>
          )}

          {activeTab === "challans" && (
            <Link
              href="/finished-stock/challans/new"
              className="flex items-center gap-1.5 text-xs font-extrabold text-white bg-[#5B63D3] hover:bg-[#4F55C3] px-4 py-2 rounded-xl transition-all shadow-md"
            >
              <Plus size={15} />
              <span>+ Create Delivery Challan</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="bg-white border border-[#E2E8F0] p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1E293B] tracking-tight">Stock Operations & Movements</h1>
            <p className="text-xs text-[#64748B] mt-0.5 font-medium">
              Manage stock reconciliations, inter-godown inventory transfers, and outgoing delivery challans in one place.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher #, design SKU, godown..."
              className="bg-transparent text-xs font-bold text-slate-800 outline-none w-48 sm:w-64"
            />
          </div>
        </div>

        {/* 3 Main Workspace Navigation Tabs */}
        <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleTabChange("adjustments")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border ${
              activeTab === "adjustments"
                ? "bg-[#5B63D3] text-white border-[#5B63D3] shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <RotateCcw size={15} />
            <span>1. Stock Adjustments & Cost Engine</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === "adjustments" ? "bg-white text-[#5B63D3]" : "bg-slate-200 text-slate-700"}`}>
              {adjustmentsList.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("transfers")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border ${
              activeTab === "transfers"
                ? "bg-[#5B63D3] text-white border-[#5B63D3] shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <ArrowLeftRight size={15} />
            <span>2. Inter-Godown Transfers</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === "transfers" ? "bg-white text-[#5B63D3]" : "bg-slate-200 text-slate-700"}`}>
              {transfersList.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("challans")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border ${
              activeTab === "challans"
                ? "bg-[#5B63D3] text-white border-[#5B63D3] shadow-md"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Truck size={15} />
            <span>3. Delivery Challans</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${activeTab === "challans" ? "bg-white text-[#5B63D3]" : "bg-slate-200 text-slate-700"}`}>
              {challansList.length}
            </span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: STOCK ADJUSTMENTS & COST RECALCULATION ENGINE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "adjustments" && (
        <div className="space-y-6">
          {/* Info Banner: Dynamic Unit Cost Accounting Engine */}
          <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-[#6366F1] h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950 space-y-1">
              <p className="font-extrabold">Weighted Average Unit Cost (WAC) Adjustment Engine Enabled</p>
              <p className="leading-relaxed font-medium text-indigo-900">
                When physical stock is reduced (loss/damage), remaining item unit costs increase dynamically (New Unit Cost = Total Valuation / Remaining Qty). When surplus stock is added without cost, unit cost dilutes across total quantity.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden p-5 space-y-4">
            {loadingAdjustments ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
                <p className="text-xs text-slate-500 mt-2 font-medium">Loading stock adjustments log...</p>
              </div>
            ) : filteredAdjustments.length === 0 ? (
              <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <RotateCcw className="mx-auto text-slate-300 h-10 w-10 mb-2" />
                <p className="text-sm font-bold text-slate-700">No Stock Adjustments Found</p>
                <p className="text-xs text-slate-500 mt-0.5">Click "+ New Stock Adjustment" to record inventory reconciliation.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#475569] font-bold uppercase tracking-wider">
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
                  <tbody className="divide-y divide-[#E5E7EB] font-medium text-[#0F172A]">
                    {filteredAdjustments.map((adj) => {
                      const isDeduction = adj.adjustment_type === "deduction";
                      return (
                        <tr key={adj.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#6366F1]">{adj.adjustment_number || "ADJ-AUTO"}</td>
                          <td className="py-3 px-4 text-slate-600">{adj.adjustment_date}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{adj.godown?.name || "—"}</td>
                          <td className="py-3 px-4 font-bold">
                            {adj.design?.code} - {adj.design?.name} ({adj.size || "All"})
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                isDeduction
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {adj.adjustment_type}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-extrabold ${isDeduction ? "text-rose-600" : "text-emerald-600"}`}>
                            {isDeduction ? "-" : "+"}{Math.abs(adj.quantity_change)} Pcs
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">₹{Number(adj.unit_cost || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-extrabold text-indigo-600">
                            ₹{Number(adj.unit_cost || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                            {formatCurrency(Number(adj.value_impact || 0))}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-semibold">{adj.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: INTER-GODOWN TRANSFERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "transfers" && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden p-5 space-y-4">
          {loadingTransfers ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Loading godown transfers...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <ArrowLeftRight className="mx-auto text-slate-300 h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-slate-700">No Inter-Godown Transfers Recorded</p>
              <p className="text-xs text-slate-500 mt-0.5">Click "+ New Godown Transfer" to transfer stock between storage locations.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#475569] font-bold uppercase tracking-wider">
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
                <tbody className="divide-y divide-[#E5E7EB] font-medium text-[#0F172A]">
                  {filteredTransfers.map((tr) => (
                    <tr key={tr.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#6366F1]">{tr.transfer_number}</td>
                      <td className="py-3 px-4 text-slate-600">{tr.transfer_date}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{tr.source_godown?.name || "—"}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">{tr.destination_godown?.name || "—"}</td>
                      <td className="py-3 px-4 text-right font-extrabold">{tr.total_quantity?.toLocaleString("en-IN")} Pcs</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{tr.vehicle_number || "—"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {tr.status || "completed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: DELIVERY CHALLANS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "challans" && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden p-5 space-y-4">
          {loadingChallans ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1] mx-auto" />
              <p className="text-xs text-slate-500 mt-2 font-medium">Loading delivery challans...</p>
            </div>
          ) : filteredChallans.length === 0 ? (
            <div className="py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Truck className="mx-auto text-slate-300 h-10 w-10 mb-2" />
              <p className="text-sm font-bold text-slate-700">No Delivery Challans Found</p>
              <p className="text-xs text-slate-500 mt-0.5">Click "+ Create Delivery Challan" to generate dispatch vouchers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-[#E5E7EB] text-[#475569] font-bold uppercase tracking-wider">
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
                <tbody className="divide-y divide-[#E5E7EB] font-medium text-[#0F172A]">
                  {filteredChallans.map((ch) => (
                    <tr key={ch.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#6366F1]">{ch.challan_number}</td>
                      <td className="py-3 px-4 text-slate-600">{ch.challan_date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{ch.party_name || "—"}</td>
                      <td className="py-3 px-4 text-slate-500">{ch.transport_name || "—"}</td>
                      <td className="py-3 px-4 text-right font-extrabold">{ch.total_quantity?.toLocaleString("en-IN")} Pcs</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(Number(ch.total_amount || 0))}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ch.status || "dispatched"}
                        </span>
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
