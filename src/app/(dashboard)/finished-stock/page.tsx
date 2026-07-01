"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Boxes,
  Palette,
  Droplets,
  Ruler,
  IndianRupee,
  Building2,
  ChevronRight,
  TrendingUp,
  Package,
  BarChart3,
  Plus,
  ArrowRight,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";
import ColourDot from "@/components/shared/ColourDot";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GodownBreakdown {
  godown_name: string;
  quantity: number;
  value: number;
}

interface SizeBreakdown {
  size: string;
  quantity: number;
}

interface TopDesign {
  design_id: string;
  design_code: string;
  design_name: string;
  total_quantity: number;
  total_value: number;
  colours: string[];
  sizes: string[];
  godown_count: number;
  godown_name: string;
}

interface Stats {
  total_stock: number;
  total_designs: number;
  total_colours: number;
  total_sizes: number;
  total_value: number;
  active_godowns: number;
  godown_breakdown: GodownBreakdown[];
  size_breakdown: SizeBreakdown[];
  top_designs: TopDesign[];
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];

export default function FinishedStockOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finished-stock");
      const data = await res.json();
      if (res.ok && data.stats) {
        setStats(data.stats);
      } else {
        toast.error(data.error || "Failed to load dashboard metrics");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not connect to API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <span className="text-[#334155]">Finished Stock</span>
          <span>/</span>
          <span className="text-[#334155] font-normal">Overview</span>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Sync Data</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Finished Stock Overview</h1>
          <p className="text-sm text-[#64748B]">Real-time garments inventory status and ledger control</p>
        </div>

        {/* Quick Actions Panel */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/finished-stock/adjustments/new"
            className="flex items-center gap-2 text-xs font-semibold text-[#DC2626] bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl hover:bg-red-100/70 active:bg-red-100 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Adjust Stock</span>
          </Link>
          <Link
            href="/finished-stock/transfers/new"
            className="flex items-center gap-2 text-xs font-semibold text-[#6366F1] bg-[#EEF2FF] border border-[#C7D2FE] px-4 py-2.5 rounded-xl hover:bg-[#E0E7FF] active:bg-[#C7D2FE] transition-all cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Transfer Stock</span>
          </Link>
          <Link
            href="/finished-stock/challans/new"
            className="flex items-center gap-2 text-xs font-semibold text-[#15803D] bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl hover:bg-green-100/70 active:bg-green-100 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Challan</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3 animate-pulse shadow-sm">
              <div className="w-10 h-10 bg-gray-200 rounded-xl" />
              <div className="space-y-1">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-6 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Card 1: Total Stock */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center mb-3">
                <Boxes className="h-5 w-5 text-[#6366F1]" />
              </div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider leading-none mb-1">
                Total Stock (Pcs)
              </p>
              <h3 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">
                {(stats?.total_stock || 0).toLocaleString()}
              </h3>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">
                All Godowns
              </p>
            </div>

            {/* Card 2: Total Designs */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-[#F0FDF4] rounded-xl flex items-center justify-center mb-3">
                <Palette className="h-5 w-5 text-[#16A34A]" />
              </div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider leading-none mb-1">
                Total Designs
              </p>
              <h3 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">
                {stats?.total_designs || 0}
              </h3>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">
                All Brands
              </p>
            </div>

            {/* Card 3: Total Colours */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-[#FFF7ED] rounded-xl flex items-center justify-center mb-3">
                <Droplets className="h-5 w-5 text-[#EA580C]" />
              </div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider leading-none mb-1">
                Total Colours
              </p>
              <h3 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">
                {stats?.total_colours || 0}
              </h3>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">
                All Designs
              </p>
            </div>

            {/* Card 4: Total Sizes */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-[#FEF9C3] rounded-xl flex items-center justify-center mb-3">
                <Ruler className="h-5 w-5 text-[#D97706]" />
              </div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider leading-none mb-1">
                Total Sizes
              </p>
              <h3 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">
                {stats?.total_sizes || 0}
              </h3>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">
                XS, S, M, L, XL, XXL
              </p>
            </div>

            {/* Card 5: Total Value */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-[#F5F3FF] rounded-xl flex items-center justify-center mb-3">
                <IndianRupee className="h-5 w-5 text-[#7C3AED]" />
              </div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider leading-none mb-1">
                Total Value
              </p>
              <h3 className="text-xl font-bold text-[#1E293B] tracking-tight mb-0.5 mt-0.5">
                {formatRupee(stats?.total_value || 0)}
              </h3>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">
                At Cost
              </p>
            </div>

            {/* Card 6: Active Godowns */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center mb-3">
                <Building2 className="h-5 w-5 text-[#6366F1]" />
              </div>
              <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider leading-none mb-1">
                Active Godowns
              </p>
              <h3 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">
                {stats?.active_godowns || 0}
              </h3>
              <p className="text-[10px] text-[#64748B] font-medium leading-none">
                All Locations
              </p>
            </div>
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Donut Chart: Godown Breakdown */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 lg:col-span-2 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-base font-bold text-[#1E293B] mb-1">Godown Stock Breakdown</h3>
            <p className="text-xs text-[#64748B] mb-4">Stock distribution across active warehouses</p>
          </div>
          <div className="h-[220px] flex items-center justify-center">
            {loading ? (
              <div className="w-32 h-32 rounded-full border-8 border-gray-200 border-t-gray-400 animate-spin" />
            ) : stats?.godown_breakdown && stats.godown_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.godown_breakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="quantity"
                    nameKey="godown_name"
                  >
                    {stats.godown_breakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${(value as number).toLocaleString()} Pcs`, 'Stock']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-400">No data available</div>
            )}
          </div>
          {/* Legend */}
          {!loading && stats?.godown_breakdown && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold">
              {stats.godown_breakdown.slice(0, 4).map((g, idx) => (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-[#475569] truncate">{g.godown_name}</span>
                  <span className="text-[#94A3B8] font-normal">({Math.round(((g.quantity || 0) / (stats.total_stock || 1)) * 100)}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bar Chart: Size Breakdown */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 lg:col-span-3 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-base font-bold text-[#1E293B] mb-1">Stock by Sizing</h3>
            <p className="text-xs text-[#64748B] mb-4">Total pieces stored grouped by garment sizes</p>
          </div>
          <div className="h-[220px]">
            {loading ? (
              <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg" />
            ) : stats?.size_breakdown && stats.size_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.size_breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="size" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "#F8FAFC" }} formatter={(value) => [`${(value as number).toLocaleString()} Pcs`, 'Stock']} />
                  <Bar dataKey="quantity" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Stock by Design Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1E293B]">Stock by Design (Top 10)</h3>
            <p className="text-xs text-[#64748B]">Top 10 garment designs ranked by stock levels</p>
          </div>
          <Link
            href="/finished-stock/designs"
            className="flex items-center gap-1 text-xs font-semibold text-[#6366F1] hover:text-[#4F46E5] hover:underline"
          >
            <span>View All Designs</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-[#475569]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                <th className="py-3 px-5 w-12 text-center">#</th>
                <th className="py-3 px-4">Design Code</th>
                <th className="py-3 px-4">Design Name</th>
                <th className="py-3 px-4 text-right">Total Qty (Pcs)</th>
                <th className="py-3 px-4">Colours</th>
                <th className="py-3 px-4">Sizes</th>
                <th className="py-3 px-4">Godown</th>
                <th className="py-3 px-4 text-right">Value (₹)</th>
                <th className="py-3 px-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-gray-200 rounded mx-auto w-4" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-12" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded ml-auto w-16" /></td>
                    <td className="py-4 px-5"><div className="h-6 bg-gray-200 rounded mx-auto w-12" /></td>
                  </tr>
                ))
              ) : stats?.top_designs && stats.top_designs.length > 0 ? (
                stats.top_designs.map((design, idx) => (
                  <tr key={design.design_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5 text-center text-xs text-[#94A3B8] font-bold">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-[#1E293B]">{design.design_code}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#475569]">{design.design_name}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#1E293B]">
                      {(design.total_quantity || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        {design.colours && design.colours.length > 0 ? (
                          design.colours.slice(0, 4).map((hex, index) => (
                            <ColourDot key={index} colourHex={hex} size="sm" />
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                        {design.colours && design.colours.length > 4 && (
                          <span className="text-[10px] font-bold text-[#94A3B8] shrink-0">+{design.colours.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {design.sizes && design.sizes.length > 0 ? (
                          design.sizes.slice(0, 3).map((sz, index) => (
                            <span key={index} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {sz}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                        {design.sizes && design.sizes.length > 3 && (
                          <span className="text-[10px] font-bold text-[#94A3B8] px-1 py-0.5">+{design.sizes.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-[#64748B]">
                      {design.godown_count > 1 ? `All (${design.godown_count})` : design.godown_name || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#6366F1]">
                      {formatRupee(design.total_value || 0)}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <Link
                        href={`/finished-stock/designs/${design.design_id}`}
                        className="inline-flex items-center justify-center p-1.5 bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#6366F1] hover:border-[#6366F1] rounded-lg transition-all"
                        title="View Details"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-gray-400">
                    No finished stock items found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
