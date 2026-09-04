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
  Package,
  Plus,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Layers,
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
} from "recharts";
import ColourDot from "@/components/shared/ColourDot";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { staggerContainer, cardVariants, hoverLift } from "@/lib/animations";
import { ModuleSubNav } from "@/components/shared/ModuleSubNav";
import { FINISHED_STOCK_NAV } from "@/lib/moduleNav";

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
  grade_a_quantity?: number;
  grade_b_quantity?: number;
  total_value: number;
  colours: string[];
  sizes: string[];
  godown_count: number;
  godown_name: string;
}

interface Stats {
  total_stock: number;
  grade_a_stock?: number;
  grade_b_stock?: number;
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
  const [gradeFilter, setGradeFilter] = useState<"all" | "A" | "B">("all");

  const fetchStats = async (grade = gradeFilter) => {
    setLoading(true);
    try {
      const params = grade !== "all" ? `?grade=${grade}` : "";
      const res = await fetch(`/api/finished-stock${params}`);
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
    fetchStats(gradeFilter);
  }, [gradeFilter]);

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <span className="text-[var(--text-body)]">Finished Stock</span>
          <span>/</span>
          <span className="text-[var(--text-body)] font-normal">Overview</span>
        </div>
        <button
          onClick={() => fetchStats(gradeFilter)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--card-bg)] border border-[var(--border)] px-3 py-1.5 rounded-lg hover:bg-[var(--table-row-hover)] active:bg-[var(--table-row-hover)] transition-all cursor-pointer shadow-[var(--shadow-sm)] disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Sync Data</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Finished Stock Overview</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Real-time garments inventory status, grade classification, and warehouse ledger control
          </p>
        </div>

        {/* Quick Actions Panel */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/finished-stock/adjustments/new"
            className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl hover:bg-rose-500/20 active:bg-rose-500/20 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Adjust Stock</span>
          </Link>
          <Link
            href="/finished-stock/transfers/new"
            className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--border)] px-3.5 py-2 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Transfer Stock</span>
          </Link>
          <Link
            href="/finished-stock/challans/new"
            className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl hover:bg-emerald-500/20 active:bg-emerald-500/20 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Challan</span>
          </Link>
        </div>
      </div>

      <ModuleSubNav items={FINISHED_STOCK_NAV} />

      {/* Stock Grade Filter Tabs */}
      <div className="flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--border)] p-1.5 rounded-xl w-fit shadow-[var(--shadow-sm)]">
        <button
          type="button"
          onClick={() => setGradeFilter("all")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            gradeFilter === "all"
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
          }`}
        >
          All Finished Stock
        </button>
        <button
          type="button"
          onClick={() => setGradeFilter("A")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            gradeFilter === "A"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Grade A (Fresh Quality)</span>
        </button>
        <button
          type="button"
          onClick={() => setGradeFilter("B")}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            gradeFilter === "B"
              ? "bg-orange-600 text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]"
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Grade B (Aatri / Second Quality)</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 space-y-3 animate-pulse shadow-[var(--shadow-sm)]"
            >
              <div className="w-10 h-10 bg-[var(--skeleton-base)] rounded-xl" />
              <div className="space-y-1">
                <div className="h-4 bg-[var(--skeleton-base)] rounded w-1/2" />
                <div className="h-6 bg-[var(--skeleton-base)] rounded w-3/4" />
              </div>
            </div>
          ))
        ) : (
          <>
            <motion.div
              variants={cardVariants}
              whileHover={hoverLift.hover}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow"
            >
              <div className="w-10 h-10 bg-[var(--primary-light)] rounded-xl flex items-center justify-center mb-3">
                <Boxes className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider leading-none mb-1">
                Total Stock (Pcs)
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-0.5">
                {(stats?.total_stock || 0).toLocaleString()}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none">All Godowns</p>
            </motion.div>

            <motion.div
              variants={cardVariants}
              whileHover={hoverLift.hover}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow"
            >
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider leading-none mb-1">
                Grade A (Fresh)
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 tracking-tight mb-0.5">
                {(stats?.grade_a_stock || 0).toLocaleString()} <span className="text-xs font-normal">pcs</span>
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none">Prime Inventory</p>
            </motion.div>

            <Link href="/finished-stock/b-grade" className="block">
              <motion.div
                variants={cardVariants}
                whileHover={hoverLift.hover}
                className="bg-[var(--card-bg)] border border-[var(--border)] hover:border-orange-500/50 rounded-2xl p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all cursor-pointer group"
              >
                <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider leading-none mb-1 group-hover:text-orange-600 transition-colors">
                  Grade B (Aatri) →
                </p>
                <h3 className="text-2xl font-bold text-orange-600 tracking-tight mb-0.5">
                  {(stats?.grade_b_stock || 0).toLocaleString()} <span className="text-xs font-normal">pcs</span>
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none">View B-Grade Register</p>
              </motion.div>
            </Link>

            <motion.div
              variants={cardVariants}
              whileHover={hoverLift.hover}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow"
            >
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3">
                <Palette className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider leading-none mb-1">
                Total Designs
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-0.5">
                {stats?.total_designs || 0}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none">All Brands</p>
            </motion.div>

            <motion.div
              variants={cardVariants}
              whileHover={hoverLift.hover}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow"
            >
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-3">
                <IndianRupee className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider leading-none mb-1">
                Total Value
              </p>
              <h3 className="text-xl font-bold text-[var(--text-primary)] tracking-tight mb-0.5 mt-0.5">
                {formatRupee(stats?.total_value || 0)}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none">Valuation at Cost</p>
            </motion.div>

            <motion.div
              variants={cardVariants}
              whileHover={hoverLift.hover}
              className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow"
            >
              <div className="w-10 h-10 bg-[var(--primary-light)] rounded-xl flex items-center justify-center mb-3">
                <Building2 className="h-5 w-5 text-[var(--primary)]" />
              </div>
              <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider leading-none mb-1">
                Active Godowns
              </p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-0.5">
                {stats?.active_godowns || 0}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] font-medium leading-none">Storage Locations</p>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Charts Section */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Donut Chart: Godown Breakdown */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 lg:col-span-2 flex flex-col justify-between shadow-[var(--shadow-sm)]">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Godown Stock Breakdown</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">Stock distribution across active warehouses</p>
          </div>
          <div className="h-[220px] flex items-center justify-center">
            {loading ? (
              <div className="w-32 h-32 rounded-full border-8 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
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
                  <Tooltip formatter={(value) => [`${(value as number).toLocaleString()} Pcs`, "Stock"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No warehouse distribution data</p>
            )}
          </div>
        </div>

        {/* Bar Chart: Size Breakdown */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5 lg:col-span-3 flex flex-col justify-between shadow-[var(--shadow-sm)]">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Size Breakdown</h3>
            <p className="text-xs text-[var(--text-muted)] mb-4">Total pieces available per size</p>
          </div>
          <div className="h-[220px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            ) : stats?.size_breakdown && stats.size_breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.size_breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="size" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <Tooltip formatter={(value) => [`${(value as number).toLocaleString()} Pcs`, "Quantity"]} />
                  <Bar dataKey="quantity" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-[var(--text-muted)]">No size breakdown available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock by Design Table */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Stock by Design (Top 10)</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {gradeFilter === "all"
                ? "Top 10 garment designs ranked by stock levels"
                : gradeFilter === "A"
                ? "Top Grade A (Fresh) designs"
                : "Top Grade B (Aatri / Second Quality) designs"}
            </p>
          </div>
          <Link
            href="/finished-stock/designs"
            className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-dark)] hover:underline"
          >
            <span>View All Designs</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* ── MOBILE: design cards ── */}
        <div className="md:hidden divide-y divide-[var(--border-light)]">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse space-y-2">
                <div className="h-4 bg-[var(--skeleton-base)] rounded w-1/3" />
                <div className="h-3 bg-[var(--skeleton-base)] rounded w-1/2" />
              </div>
            ))
          ) : stats?.top_designs && stats.top_designs.length > 0 ? (
            stats.top_designs.map((design, idx) => (
              <div key={design.design_id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-black text-[var(--text-faint)] w-5 shrink-0">#{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-[var(--primary)] text-sm truncate">{design.design_code}</p>
                        {design.grade_b_quantity && design.grade_b_quantity > 0 ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
                            B-Grade: {design.grade_b_quantity}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">{design.design_name}</p>
                    </div>
                  </div>
                  <Link
                    href={`/master-data/designs/${design.design_id}`}
                    className="ml-2 shrink-0 inline-flex items-center justify-center w-7 h-7 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--primary)] rounded-lg transition-all"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-1 mb-2">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Qty</p>
                    <p className="text-xs font-black text-[var(--text-primary)] mt-0.5">
                      {(design.total_quantity || 0).toLocaleString()} pcs
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Value</p>
                    <p className="text-xs font-black text-[var(--primary)] mt-0.5">
                      {formatRupee(design.total_value || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Godown</p>
                    <p className="text-xs font-semibold text-[var(--text-body)] mt-0.5 truncate">
                      {design.godown_count > 1 ? `All (${design.godown_count})` : design.godown_name || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {design.colours &&
                      design.colours.slice(0, 5).map((hex, index) => (
                        <ColourDot key={index} colourHex={hex} size="sm" />
                      ))}
                    {design.colours && design.colours.length > 5 && (
                      <span className="text-[10px] font-bold text-[var(--text-faint)]">
                        +{design.colours.length - 5}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 ml-2">
                    {design.sizes &&
                      design.sizes.slice(0, 4).map((sz, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-bold bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded"
                        >
                          {sz}
                        </span>
                      ))}
                    {design.sizes && design.sizes.length > 4 && (
                      <span className="text-[10px] font-bold text-[var(--text-faint)] px-1 py-0.5">
                        +{design.sizes.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">No finished stock items found.</div>
          )}
        </div>

        {/* ── DESKTOP: table ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-[var(--text-body)]">
            <thead>
              <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <th className="py-3 px-5 w-12 text-center">#</th>
                <th className="py-3 px-4">Design Code</th>
                <th className="py-3 px-4">Design Name</th>
                <th className="py-3 px-4 text-right">Total Qty (Pcs)</th>
                <th className="py-3 px-4">Grade Breakdown</th>
                <th className="py-3 px-4">Colours</th>
                <th className="py-3 px-4">Sizes</th>
                <th className="py-3 px-4">Godown</th>
                <th className="py-3 px-4 text-right">Value (₹)</th>
                <th className="py-3 px-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)]">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded mx-auto w-4" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded w-16" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded w-28" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded ml-auto w-12" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded w-16" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded w-16" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded w-16" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-[var(--skeleton-base)] rounded ml-auto w-16" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-6 bg-[var(--skeleton-base)] rounded mx-auto w-12" />
                    </td>
                  </tr>
                ))
              ) : stats?.top_designs && stats.top_designs.length > 0 ? (
                stats.top_designs.map((design, idx) => (
                  <tr key={design.design_id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="py-3.5 px-5 text-center text-xs text-[var(--text-faint)] font-bold">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-[var(--text-primary)]">{design.design_code}</td>
                    <td className="py-3.5 px-4 font-semibold text-[var(--text-body)]">{design.design_name}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-[var(--text-primary)]">
                      {(design.total_quantity || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          A: {design.grade_a_quantity || 0}
                        </span>
                        {design.grade_b_quantity && design.grade_b_quantity > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
                            B: {design.grade_b_quantity}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        {design.colours && design.colours.length > 0 ? (
                          design.colours.slice(0, 4).map((hex, index) => (
                            <ColourDot key={index} colourHex={hex} size="sm" />
                          ))
                        ) : (
                          <span className="text-xs text-[var(--text-faint)]">None</span>
                        )}
                        {design.colours && design.colours.length > 4 && (
                          <span className="text-[10px] font-bold text-[var(--text-faint)] shrink-0">
                            +{design.colours.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {design.sizes && design.sizes.length > 0 ? (
                          design.sizes.slice(0, 3).map((sz, index) => (
                            <span
                              key={index}
                              className="text-[10px] font-bold bg-[var(--page-bg)] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded"
                            >
                              {sz}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--text-faint)]">None</span>
                        )}
                        {design.sizes && design.sizes.length > 3 && (
                          <span className="text-[10px] font-bold text-[var(--text-faint)] px-1 py-0.5">
                            +{design.sizes.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-[var(--text-muted)]">
                      {design.godown_count > 1 ? `All (${design.godown_count})` : design.godown_name || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[var(--primary)]">
                      {formatRupee(design.total_value || 0)}
                    </td>
                    <td className="py-3.5 px-5 text-center">
                      <Link
                        href={`/master-data/designs/${design.design_id}`}
                        className="inline-flex items-center justify-center p-1.5 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] rounded-lg transition-all"
                        title="View Details"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-[var(--text-muted)]">
                    No finished stock items found for selected grade filter.
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
