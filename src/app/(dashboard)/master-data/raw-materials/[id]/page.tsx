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
  Package,
  ShoppingBag,
  Percent,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

interface Godown {
  id: string;
  name: string;
  code: string | null;
}

interface Stock {
  id: string;
  current_stock: number;
  unit_cost: number;
  stock_value: number;
  godown: Godown;
}

interface Purchase {
  id: string;
  quantity: number;
  rate: number;
  amount: number;
  purchaseId: string;
  invoiceNumber: string;
  purchaseDate: string;
  supplierName: string;
}

interface Movement {
  id: string;
  transaction_type: string;
  quantity_delta: number;
  value_delta: number;
  created_at: string;
  godown?: {
    name: string;
  };
}

interface Material {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  reorder_level: number | null;
  hsn_code: string | null;
  gst_percent: number | null;
  is_active: boolean;
  default_supplier?: {
    id: string;
    name: string;
  };
}

interface Rollups {
  totalCurrentStock: number;
  totalStockValue: number;
  averagePurchaseCost: number;
  reorderWarning: boolean;
}

interface RawMaterialDetailResponse {
  material: Material;
  stocks: Stock[];
  purchases: Purchase[];
  movements: Movement[];
  rollups: Rollups;
}

export default function RawMaterialDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("stock");

  const { data: detailData, isLoading, error } = useQuery<RawMaterialDetailResponse>({
    queryKey: ["raw-material-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/master-data/raw-materials/${id}`);
      if (!res.ok) throw new Error("Failed to fetch raw material details");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#64748B]">Loading material profile...</p>
        </div>
      </div>
    );
  }

  if (error || !detailData) {
    return (
      <div className="p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-[#0F172A]">Error Loading Raw Material</h3>
        <p className="text-sm text-[#64748B]">{error?.toString() || "Material not found"}</p>
        <button
          onClick={() => router.push("/master-data/raw-materials")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
        >
          Back to Raw Materials
        </button>
      </div>
    );
  }

  const { material, stocks, purchases, movements, rollups } = detailData;

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
        <Link href="/master-data/raw-materials" className="hover:text-[#0F172A] transition-colors">
          Raw Materials
        </Link>
        <ChevronRight size={12} />
        <span className="text-[#0F172A]">{material.name}</span>
      </div>

      {/* Reorder Warning Alert */}
      {rollups.reorderWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800 shadow-sm animate-pulse">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs font-semibold">
            <h4 className="font-bold text-amber-900">Reorder Level Warning</h4>
            <p>
              Current stock level ({rollups.totalCurrentStock.toLocaleString()} {material.unit}) is below or equal to the reorder level of {material.reorder_level?.toLocaleString()} {material.unit}. Please procure soon.
            </p>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl -z-10" />

        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-black text-xl shadow-sm">
            <Package size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-[#0F172A] tracking-tight">{material.name}</h1>
              {material.category && (
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                  {material.category}
                </span>
              )}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  material.is_active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-red-50 text-red-700 border-red-100"
                }`}
              >
                {material.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] font-semibold">
              {material.default_supplier && (
                <span className="flex items-center gap-1">
                  <Building2 size={13} className="text-[#94A3B8]" />
                  Default Supplier: {material.default_supplier.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push(`/master-data/raw-materials`)}
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
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Total Stock</span>
            <span className="text-lg font-black text-[#1E293B]">
              {rollups.totalCurrentStock.toLocaleString()} <span className="text-xs font-semibold text-[#64748B]">{material.unit}</span>
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Stock Valuation</span>
            <span className="text-lg font-black text-[#1E293B]">{formatCurrency(rollups.totalStockValue)}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Avg Cost / {material.unit}</span>
            <span className="text-lg font-black text-blue-600">{formatCurrency(rollups.averagePurchaseCost)}</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600 shrink-0">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] block font-bold uppercase tracking-wider">Reorder Level</span>
            <span className="text-lg font-black text-amber-600">
              {material.reorder_level ? material.reorder_level.toLocaleString() : "—"}{" "}
              <span className="text-xs font-semibold text-[#64748B]">{material.unit}</span>
            </span>
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
          Live Stock per Godown ({stocks.length})
        </button>
        <button
          onClick={() => setActiveTab("purchases")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "purchases"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Purchase History ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab("movements")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "movements"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Stock Movements ({movements.length})
        </button>
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "details"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#0F172A]"
          }`}
        >
          Material Specifications
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "stock" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5">Godown Name</th>
                  <th className="py-3 px-5 w-40">Godown Code</th>
                  <th className="py-3 px-5 text-right w-44">Quantity In Stock</th>
                  <th className="py-3 px-5 text-right w-44">Unit Cost</th>
                  <th className="py-3 px-5 text-right w-44">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {stocks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#64748B]">
                      No stock currently available in any godown.
                    </td>
                  </tr>
                ) : (
                  stocks.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/master-data/godowns/${item.godown.id}`)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-bold text-[#0F172A]">
                        {item.godown.name}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#64748B]">
                        {item.godown.code || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#1E293B]">
                        {Number(item.current_stock).toLocaleString()} {material.unit}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-[#475569]">
                        {formatCurrency(item.unit_cost)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#0F172A]">
                        {formatCurrency(item.stock_value)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "purchases" && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5 w-44">Purchase Date</th>
                  <th className="py-3 px-5">Invoice Number</th>
                  <th className="py-3 px-5">Supplier Name</th>
                  <th className="py-3 px-5 text-right w-40">Qty Purchased</th>
                  <th className="py-3 px-5 text-right w-40">Rate / Unit</th>
                  <th className="py-3 px-5 text-right w-44">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#64748B]">
                      No purchase history available for this material.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/raw-materials/purchases`)} // Link to purchase bill page
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 text-[#64748B] font-mono text-xs">
                        {p.purchaseDate ? formatDate(p.purchaseDate) : "—"}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#6366F1]">
                        {p.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                        {p.supplierName}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#374151]">
                        {p.quantity.toLocaleString()} {material.unit}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-[#475569]">
                        {formatCurrency(p.rate)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-[#0F172A]">
                        {formatCurrency(p.amount)}
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
                  <th className="py-3 px-5">Godown Location</th>
                  <th className="py-3 px-5">Transaction Type</th>
                  <th className="py-3 px-5 text-right w-44">Quantity Change</th>
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
                          {m.godown?.name || "—"}
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
                          {Number(m.quantity_delta).toLocaleString()} {material.unit}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Material configurations */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
              Catalog Properties
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs font-semibold">
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Category
                </span>
                <span className="text-sm text-[#1E293B]">{material.category || "N/A"}</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Default Unit of Measure
                </span>
                <span className="text-sm text-[#1E293B]">{material.unit}</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Reorder Level Limit
                </span>
                <span className="text-sm text-[#1E293B] font-mono">
                  {material.reorder_level ? material.reorder_level.toLocaleString() : "None"} {material.unit}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                Description / Specifications
              </span>
              <span className="text-sm text-[#475569] leading-relaxed block font-medium">
                {material.description || "No description provided."}
              </span>
            </div>
          </div>

          {/* Legal / HSN Configurations */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">
              GST & HSN Configurations
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  HSN / SAC Code
                </span>
                {material.hsn_code ? (
                  <Link
                    href={`/master-data/gst-rates`} // Matches GST lists or HSN details
                    className="text-sm font-mono font-bold text-[#6366F1] hover:underline"
                  >
                    {material.hsn_code}
                  </Link>
                ) : (
                  <span className="text-sm text-[#1E293B] font-mono">—</span>
                )}
              </div>
              <div>
                <span className="text-[#64748B] block font-bold mb-1 uppercase tracking-wider text-[10px]">
                  GST Tax Percent
                </span>
                <span className="text-sm text-[#1E293B] font-mono">
                  {material.gst_percent ? `${material.gst_percent}%` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
