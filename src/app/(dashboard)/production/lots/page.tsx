"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Play,
  Bell,
  Plus,
  Eye,
  MoreVertical,
  Edit,
  SlidersHorizontal,
  ChevronRight,
  Search,
  PlusCircle,
  ArrowRight,
  Scissors,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import ProgressBar from "@/components/shared/ProgressBar";
import { formatDate } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Lot {
  id: string;
  lot_number: string;
  brand_id: string;
  design_id: string;
  colour_id: string | null;
  size_set_id: string | null;
  lot_date: string;
  target_start_date: string | null;
  target_due_date: string | null;
  total_quantity: number;
  completed_quantity: number;
  status: "draft" | "in_progress" | "completed" | "on_hold" | "cancelled";
  brand?: { name: string };
  design?: { name: string; code: string };
  colour?: { colour_name: string; hex_code: string | null };
  size_set?: { name: string; sizes: string[] };
}

interface Brand {
  id: string;
  name: string;
}

interface Design {
  id: string;
  name: string;
  code: string;
}

export default function ProductionLotsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filter States
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [designFilter, setDesignFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Queries
  // React Query: Fetch dependencies
  const { data: brandsData } = useERPQuery(["brands-list"], async () => {
    const res = await fetch("/api/master-data/brands");
    if (!res.ok) throw new Error("Failed to fetch brands");
    return res.json();
  });

  const { data: designsData } = useERPQuery(["designs-list"], async () => {
    const res = await fetch("/api/master-data/designs");
    if (!res.ok) throw new Error("Failed to fetch designs");
    return res.json();
  });

  const { data: statsData } = useERPQuery(["lots-stats"], async () => {
    const res = await fetch("/api/production/lots/stats");
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  });

  const lotsQuery = useERPQuery(
    ["lots-list", brandFilter, designFilter, statusFilter, search, startDate, endDate, currentPage],
    async () => {
      const bParam = brandFilter !== "all" ? `&brand_id=${brandFilter}` : "";
      const dParam = designFilter !== "all" ? `&design_id=${designFilter}` : "";
      const sParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const sdParam = startDate ? `&startDate=${startDate}` : "";
      const edParam = endDate ? `&endDate=${endDate}` : "";
      const pgParam = `&page=${currentPage}&limit=${pageSize}`;

      const res = await fetch(`/api/production/lots?${bParam}${dParam}${sParam}${searchParam}${sdParam}${edParam}${pgParam}`);
      if (!res.ok) throw new Error("Failed to fetch lots");
      return res.json();
    },
    { skeleton: "table" }
  );

  const lotsResult = lotsQuery.data;
  const isLoading = lotsQuery.isPending;
  const lots = lotsResult?.data || [];
  const meta = lotsResult?.meta || { page: 1, limit: 10, total: 0 };
  const startIndex = (meta.page - 1) * meta.limit;
  const stats = statsData?.stats || { total: 0, draft: 0, in_progress: 0, completed: 0, on_hold: 0, cancelled: 0 };
  const percentages = statsData?.percentages || { in_progress: "0", completed: "0", on_hold: "0", cancelled: "0" };
  const topDesigns = statsData?.topDesigns || [];
  const recentActivity = statsData?.recentActivity || [];

  // Update Status Mutation
  const updateStatusMutation = useERPMutation(
    async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/production/lots/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update lot status");
      return res.json();
    },
    {
      successMessage: "Lot status updated successfully",
      invalidates: [["lots-list"], ["lots-stats"]],
    }
  );

  // Pagination logic
  const totalPages = Math.ceil(meta.total / pageSize) || 1;

  // Clear filters
  const handleClearFilters = () => {
    setSearch("");
    setBrandFilter("all");
    setDesignFilter("all");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  // Recharts Chart Data
  const chartData = [
    { name: "In Progress", value: stats.in_progress, color: "#6366F1" },
    { name: "Completed", value: stats.completed, color: "#15803D" },
    { name: "On Hold", value: stats.on_hold, color: "#D97706" },
    { name: "Cancelled", value: stats.cancelled, color: "#DC2626" },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Production Lots
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5 font-medium">
            View and manage all production lots
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
            onClick={() => toast.info("Tutorial is coming soon!")}
          >
            <Play size={14} className="fill-[#374151]" />
            Tutorial
          </button>
          <button
            type="button"
            onClick={() => router.push("/production/lots/new")}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
          >
            <Plus className="h-4 w-4 text-white" />
            Create Lot
          </button>
        </div>
      </div>

      {/* 5 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Lots */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Lots</span>
            <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{stats.total}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">All time</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#DBEAFE] rounded-lg text-[#1D4ED8] shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">In Progress</span>
            <p className="text-2xl font-bold text-[#1D4ED8] mt-0.5">{stats.in_progress}</p>
            <span className="text-[10px] text-[#1D4ED8] font-semibold block mt-0.5">
              {percentages.in_progress}%
            </span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#DCFCE7] rounded-lg text-[#15803D] shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Completed</span>
            <p className="text-2xl font-bold text-[#15803D] mt-0.5">{stats.completed}</p>
            <span className="text-[10px] text-[#15803D] font-semibold block mt-0.5">
              {percentages.completed}%
            </span>
          </div>
        </div>

        {/* On Hold */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEF3C7] rounded-lg text-[#D97706] shrink-0">
            <PauseCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">On Hold</span>
            <p className="text-2xl font-bold text-[#D97706] mt-0.5">{stats.on_hold}</p>
            <span className="text-[10px] text-[#D97706] font-semibold block mt-0.5">
              {percentages.on_hold}%
            </span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEE2E2] rounded-lg text-[#DC2626] shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Cancelled</span>
            <p className="text-2xl font-bold text-[#DC2626] mt-0.5">{stats.cancelled}</p>
            <span className="text-[10px] text-[#DC2626] font-semibold block mt-0.5">
              {percentages.cancelled}%
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] h-4 w-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Lot No. or Design..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-4 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
            />
          </div>

          {/* Brand Dropdown */}
          <select
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="all">All Brands</option>
            {brandsData?.brands?.map((b: Brand) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Design Dropdown */}
          <select
            value={designFilter}
            onChange={(e) => {
              setDesignFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="all">All Designs</option>
            {designsData?.designs?.map((d: Design) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-2 h-10 bg-white">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs border-0 p-0 focus:ring-0 w-[110px]"
            />
            <span className="text-[#94A3B8] text-xs font-semibold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs border-0 p-0 focus:ring-0 w-[110px]"
            />
          </div>

          {/* Clear Filters */}
          {(brandFilter !== "all" || designFilter !== "all" || statusFilter !== "all" || search || startDate || endDate) && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-[#6366F1] font-semibold hover:underline shrink-0 cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Production Lots Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <span className="text-sm font-semibold text-[#374151]">Lots Directory</span>
          <div className="flex items-center gap-4 text-xs text-[#64748B]">
            <span>
              Showing {lots.length === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(startIndex + pageSize, lots.length)} of {lots.length} entries
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="h-8 rounded border border-[#E5E7EB] bg-white px-2 text-xs focus:ring-1 focus:ring-[#6366F1]"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                <th className="py-3 px-5">Lot No.</th>
                <th className="py-3 px-5">Brand</th>
                <th className="py-3 px-5">Design</th>
                <th className="py-3 px-5">Colour</th>
                <th className="py-3 px-5">Size Set</th>
                <th className="py-3 px-5 text-right">Total Qty</th>
                <th className="py-3 px-5 w-48">Completed Qty</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5">Start Date</th>
                <th className="py-3 px-5">Due Date</th>
                <th className="py-3 px-5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="p-0">
                    {lotsQuery.Skeleton || (
                      <div className="py-8 text-center text-[#64748B]">Loading lots...</div>
                    )}
                  </td>
                </tr>
              ) : lots.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[#64748B]">
                    No lots found.
                  </td>
                </tr>
              ) : (
                lots.map((lot: Lot) => {
                  const sizesStr = lot.size_set?.sizes ? lot.size_set.sizes.join(", ") : "—";
                  const colourStr = lot.colour?.colour_name || "—";

                  return (
                    <tr
                      key={lot.id}
                      onClick={() => router.push(`/production/lots/${lot.id}`)}
                      className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#6366F1]">
                        <Link
                          href={`/production/lots/${lot.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {lot.lot_number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-5 text-[#374151]">
                        {lot.brand?.name || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-[#374151] font-medium">
                        {lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : "—"}
                      </td>
                      <td className="py-3.5 px-5 text-[#374151]">
                        <div className="flex items-center gap-2">
                          {lot.colour?.hex_code && (
                            <span
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: lot.colour.hex_code }}
                            />
                          )}
                          <span>{colourStr}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-[#374151] truncate max-w-[120px]" title={sizesStr}>
                        {sizesStr}
                      </td>
                      <td className="py-3.5 px-5 text-right font-medium text-[#374151]">
                        {lot.total_quantity}
                      </td>
                      <td className="py-3.5 px-5">
                        <ProgressBar value={lot.completed_quantity} total={lot.total_quantity} />
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            lot.status === "in_progress"
                              ? "bg-[#DBEAFE] text-[#1D4ED8]"
                              : lot.status === "completed"
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : lot.status === "on_hold"
                              ? "bg-[#FEF3C7] text-[#D97706]"
                              : lot.status === "cancelled"
                              ? "bg-[#FEE2E2] text-[#DC2626]"
                              : "bg-[#F1F5F9] text-[#64748B]"
                          }`}
                        >
                          {lot.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[#374151] font-mono text-xs">
                        {formatDate(lot.target_start_date)}
                      </td>
                      <td className="py-3.5 px-5 text-[#374151] font-mono text-xs">
                        {formatDate(lot.target_due_date)}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/production/lots/${lot.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors"
                            title="View Detail"
                          >
                            <Eye size={16} />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="w-8 h-8 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                            >
                              <MoreVertical size={16} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[150px]">
                              <DropdownMenuItem
                                onClick={() => router.push(`/production/lots/${lot.id}/edit`)}
                              >
                                <Edit size={14} className="mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/production/stage-entries/new?lot_id=${lot.id}`)}
                              >
                                <PlusCircle size={14} className="mr-2" />
                                Add Stage Entry
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: lot.id,
                                    status: lot.status === "on_hold" ? "in_progress" : "on_hold",
                                  })
                                }
                              >
                                <PauseCircle size={14} className="mr-2" />
                                {lot.status === "on_hold" ? "Resume Lot" : "Put on Hold"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm("Are you sure you want to cancel this production lot?")) {
                                    updateStatusMutation.mutate({
                                      id: lot.id,
                                      status: "cancelled",
                                    });
                                  }
                                }}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <XCircle size={14} className="mr-2" />
                                Cancel Lot
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="bg-[#F9FAFB] border-t border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-[#E5E7EB] rounded-md text-xs font-semibold text-[#374151] hover:bg-white disabled:opacity-50 disabled:hover:bg-[#F9FAFB] transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                    currentPage === i + 1
                      ? "bg-[#6366F1] text-white"
                      : "border border-[#E5E7EB] text-[#374151] hover:bg-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-[#E5E7EB] rounded-md text-xs font-semibold text-[#374151] hover:bg-white disabled:opacity-50 disabled:hover:bg-[#F9FAFB] transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Bottom Section: Recharts Pie + Top Designs + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart: Lots by Status */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider mb-4">
            Lots by Status
          </h3>

          <div className="h-44 w-full relative">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
                No lots stats available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Lots`, "Count"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs font-medium text-[#475569]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6366F1]" />
              <span>In Progress ({stats.in_progress})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#15803D]" />
              <span>Completed ({stats.completed})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
              <span>On Hold ({stats.on_hold})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
              <span>Cancelled ({stats.cancelled})</span>
            </div>
          </div>
        </div>

        {/* Top Designs (By Lots) */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] border-b border-[#F3F4F6] pb-3 uppercase tracking-wider mb-3">
              Top Designs (By Lots)
            </h3>
            {topDesigns.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                No design lot details logged yet.
              </div>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {topDesigns.map((td: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-2.5">
                    <span className="text-sm text-[#374151] font-semibold">
                      {td.code} - {td.name}
                    </span>
                    <span className="text-sm font-bold text-[#0F172A]">{td.count} Lots</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/master-data/designs"
            className="text-xs font-bold text-[#6366F1] hover:underline flex items-center gap-1 mt-3"
          >
            View all designs
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center border-b border-[#F3F4F6] pb-3 mb-3">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
              Recent Activity
            </h3>
            <Link href="/settings/audit-logs" className="text-xs font-bold text-[#6366F1] hover:underline">
              View All
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#94A3B8]">
              No recent activity recorded.
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6] max-h-[220px] overflow-y-auto pr-1">
              {recentActivity.map((act: any) => (
                <div key={act.id} className="flex items-start gap-3 py-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      act.icon === "completed"
                        ? "bg-[#DCFCE7] text-[#15803D]"
                        : act.icon === "stage_entry"
                        ? "bg-[#DBEAFE] text-[#1D4ED8]"
                        : act.icon === "on_hold"
                        ? "bg-[#FEF3C7] text-[#D97706]"
                        : act.icon === "cancelled"
                        ? "bg-[#FEE2E2] text-[#DC2626]"
                        : "bg-[#EEF2FF] text-[#6366F1]"
                    }`}
                  >
                    {act.icon === "completed" ? (
                      <CheckCircle2 size={14} />
                    ) : act.icon === "stage_entry" ? (
                      <ClipboardList size={14} />
                    ) : act.icon === "on_hold" ? (
                      <PauseCircle size={14} />
                    ) : act.icon === "cancelled" ? (
                      <XCircle size={14} />
                    ) : (
                      <PlusCircle size={14} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#374151] leading-snug">
                      {act.actionText}
                    </p>
                    <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">
                      by {act.userName}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#94A3B8] font-medium shrink-0">
                    {new Date(act.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
