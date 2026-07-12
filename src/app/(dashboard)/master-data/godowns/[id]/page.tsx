"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  TrendingUp,
  History,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

interface MaterialType {
  name: string;
  category: string;
  unit: string;
}

interface StockItem {
  id: string;
  current_stock: number;
  stock_value: number;
  material_type: MaterialType;
}

interface Movement {
  id: string;
  item_type: "raw_material" | "finished_good";
  transaction_type: string;
  quantity_delta: number;
  value_delta: number;
  created_at: string;
  itemName: string;
  unit: string;
}

interface Godown {
  id: string;
  name: string;
  code: string | null;
  location: string | null;
  description: string | null;
  is_active: boolean;
}

interface FinishedStockItem {
  id: string;
  total_quantity: number;
  cost_per_piece: number;
  total_value: number;
  size_quantities: Record<string, number>;
  design?: { id: string; name: string; code: string };
  colour?: { id: string; colour_name: string };
}

interface GodownDetailResponse {
  godown: Godown;
  stock: StockItem[];
  movements: Movement[];
  finishedStock: FinishedStockItem[];
}

export default function GodownDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("stock");

  const { data: detailData, isLoading, error } = useQuery<GodownDetailResponse>({
    queryKey: ["godown-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/godowns/${id}`);
      if (!res.ok) throw new Error("Failed to fetch godown details");
      return res.json();
    },
  });

  const isDataStale = detailData && detailData.godown.id !== id;

  if (isLoading || isDataStale) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#64748B]">Loading godown profile...</p>
        </div>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-[#0F172A]">Error Loading Godown</h3>
        <p className="text-sm text-[#64748B]">{error?.toString() || "Godown not found"}</p>
        <button
          onClick={() => router.push("/master-data/godowns")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
        >
          Back to Godowns
        </button>
      </div>
    );
  }

  const { godown, stock, movements, finishedStock = [] } = detailData;

  // Compute rollups
  const totalStockItems = stock.length;
  const totalValuation = stock.reduce((acc, curr) => acc + Number(curr.stock_value || 0), 0);
  const totalInwardCount = movements.filter((m) => m.quantity_delta > 0).length;
  const totalOutwardCount = movements.filter((m) => m.quantity_delta < 0).length;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "purchase":
        return "Purchase Inward";
      case "purchase_return":
        return "Purchase Return Outward";
      case "production_lot_allocation":
        return "Lot Allocation Outward";
      case "production_lot_finished_good_push":
        return "Lot FG Push Inward";
      case "stock_in":
        return "Stock Inward";
      case "stock_out":
        return "Stock Outward";
      case "adjustment":
        return "Stock Adjustment";
      case "transfer":
        return "Stock Transfer";
      default:
        return type.replace(/_/g, " ");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Navigation breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-bold text-[#64748B] select-none">
        <Link href="/" className="hover:text-[#0F172A] transition-colors">
          Dashboard
        </Link>
        <ChevronRight size={12} />
        <span>Master Data</span>
        <ChevronRight size={12} />
        <Link href="/master-data/godowns" className="hover:text-[#0F172A] transition-colors">
          Godowns
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#0F172A]">{godown.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10" />

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-xl shadow-sm">
            <Building2 size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">{godown.name}</h1>
              {godown.code && (
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase font-mono">
                  {godown.code}
                </span>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  godown.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                }`}
              >
                {godown.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] font-semibold">
              {godown.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-[#94A3B8]" />
                  {godown.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push(`/master-data/godowns`)}
          className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ArrowLeft size={14} /> Back to List
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Stock Items</span>
            <span className="text-lg font-black text-[#1E293B]">{totalStockItems}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Total Value</span>
            <span className="text-lg font-black text-[#1E293B]">{formatCurrency(totalValuation)}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 shrink-0">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Inward Entries</span>
            <span className="text-lg font-black text-[#1E293B]">{totalInwardCount}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600 shrink-0">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Outward Entries</span>
            <span className="text-lg font-black text-[#1E293B]">{totalOutwardCount}</span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex gap-1 border-b border-[#E2E8F0] pb-px select-none">
        <button
          onClick={() => setActiveTab("stock")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "stock"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Raw Materials Stock ({totalStockItems})
        </button>
        <button
          onClick={() => setActiveTab("finished-stock")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "finished-stock"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Finished Goods Stock ({finishedStock.length})
        </button>
        <button
          onClick={() => setActiveTab("movements")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "movements"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Movement History ({movements.length})
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "details"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Godown Details
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "finished-stock" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5">Design / Style</th>
                  <th className="py-3 px-5">Colour</th>
                  <th className="py-3 px-5 text-right w-44">In Stock Qty</th>
                  <th className="py-3 px-5 text-right w-44">Cost Per Piece</th>
                  <th className="py-3 px-5 text-right w-44">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {finishedStock.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No finished goods stock in this godown yet.
                    </td>
                  </tr>
                ) : (
                  finishedStock.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                        {item.design?.code ? `${item.design.code} - ${item.design.name}` : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#475569] font-medium">
                        {item.colour?.colour_name || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#1E293B]">
                        {item.total_quantity.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-xs text-[#475569]">
                        ₹{item.cost_per_piece ? item.cost_per_piece.toFixed(2) : "0.00"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#6366F1]">
                        ₹{item.total_value ? item.total_value.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "stock" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5">Material Name</th>
                  <th className="py-3 px-5 w-40">Category</th>
                  <th className="py-3 px-5 text-right w-44">Current Stock</th>
                  <th className="py-3 px-5 text-right w-44">Stock Value</th>
                  <th className="py-3 px-5 w-32">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {stock.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No items currently in stock in this godown.
                    </td>
                  </tr>
                ) : (
                  stock.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="py-3.5 px-5 font-bold text-[#0F172A]">
                        {item.material_type.name}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="bg-slate-100 text-[#475569] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                          {item.material_type.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#1E293B]">
                        {item.current_stock.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#0F172A]">
                        {formatCurrency(item.stock_value)}
                      </td>
                      <td className="py-3.5 px-5 text-[#64748B] font-semibold">
                        {item.material_type.unit}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "movements" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5 w-44">Date & Time</th>
                  <th className="py-3 px-5">Item Details</th>
                  <th className="py-3 px-5">Transaction Type</th>
                  <th className="py-3 px-5 text-right w-40">Qty Change</th>
                  <th className="py-3 px-5 text-right w-44">Value Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No movement history recorded in stock ledger yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = m.quantity_delta > 0;
                    return (
                      <tr key={m.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3.5 px-5 text-[#64748B] font-mono text-xs">
                          {new Date(m.created_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                          <div className="flex flex-col">
                            <span>{m.itemName}</span>
                            <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
                              {m.item_type.replace("_", " ")}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="font-semibold text-xs text-[#475569]">
                            {getTransactionLabel(m.transaction_type)}
                          </span>
                        </td>
                        <td
                          className={`py-3.5 px-5 text-right font-mono font-bold ${
                            isPositive ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {m.quantity_delta.toLocaleString()} {m.unit}
                        </td>
                        <td
                          className={`py-3.5 px-5 text-right font-mono font-bold ${
                            isPositive ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {formatCurrency(m.value_delta)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "details" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6 max-w-2xl">
          <div className="space-y-4">
            <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
              Godown Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Godown Name
                </span>
                <span className="text-sm text-[#1E293B]">{godown.name}</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Unique Code
                </span>
                <span className="text-sm text-[#1E293B] font-mono">{godown.code || "—"}</span>
              </div>
            </div>
            <div>
              <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                Location / Address
              </span>
              <span className="text-sm text-[#1E293B] flex items-center gap-1.5 font-medium leading-relaxed">
                <MapPin size={14} className="text-[#94A3B8] shrink-0" />
                {godown.location || "No location address provided."}
              </span>
            </div>
            <div>
              <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                Description / Internal Notes
              </span>
              <span className="text-sm text-[#64748B] leading-relaxed block font-medium">
                {godown.description || "No description provided."}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
