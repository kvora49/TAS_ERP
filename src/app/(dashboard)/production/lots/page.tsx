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
  Plus,
  Eye,
  MoreVertical,
  Edit,
  Boxes,
  Search,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import ProgressBar from "@/components/shared/ProgressBar";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { useChartTheme } from "@/hooks/useChartTheme";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { staggerContainer, cardVariants, hoverLift, tableRowVariants } from "@/lib/animations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileFilterSheet, MobileFilterField } from "@/components/shared/MobileFilterSheet";

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
  defect_quantity?: number;
  reworked_quantity?: number;
  b_grade_quantity?: number;
  scrapped_quantity?: number;
  status: "draft" | "in_progress" | "completed" | "on_hold" | "cancelled";
  brand?: { name: string };
  design?: { name: string; code: string; size_set?: { id?: string; name?: string; sizes: string[] } };
  colour?: { colour_name: string; hex_code: string | null };
  colours?: Array<{ id?: string; colour_name: string; hex_code: string | null }>;
  size_set?: { id?: string; name?: string; sizes: string[] };
  is_moved_to_stock?: boolean;
  days_in_working_stage?: number;
  days_taken_to_complete?: number | null;
  lot_payment_status?: "paid" | "unpaid" | "partial" | "none";
  total_labor_cost?: number;
  total_paid_amount?: number;
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

interface Worker {
  id: string;
  name: string;
  worker_id: string;
}

export default function ProductionLotsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const chartTheme = useChartTheme();

  // Filter States
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [brandFilter, setBrandFilter] = useState("all");
  const [designFilter, setDesignFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [workerLotStatusFilter, setWorkerLotStatusFilter] = useState("all"); // 'all' | 'working' | 'completed'
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all"); // 'all' | 'paid' | 'unpaid'
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Queries
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

  const { data: workersData } = useERPQuery(["workers-list-active"], async () => {
    const res = await fetch("/api/workers?active=true");
    if (!res.ok) throw new Error("Failed to fetch workers");
    return res.json();
  });

  const { data: statsData } = useERPQuery(["lots-stats"], async () => {
    const res = await fetch("/api/production/lots/stats");
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  });

  const lotsQuery = useERPQuery(
    [
      "lots-list",
      brandFilter,
      designFilter,
      statusFilter,
      workerFilter,
      workerLotStatusFilter,
      paymentStatusFilter,
      debouncedSearch,
      startDate,
      endDate,
      currentPage,
      pageSize,
    ],
    async () => {
      const bParam = brandFilter !== "all" ? `&brand_id=${brandFilter}` : "";
      const dParam = designFilter !== "all" ? `&design_id=${designFilter}` : "";
      const sParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const wParam = workerFilter !== "all" ? `&worker_id=${workerFilter}` : "";
      const wlsParam = workerLotStatusFilter !== "all" ? `&worker_lot_status=${workerLotStatusFilter}` : "";
      const pParam = paymentStatusFilter !== "all" ? `&payment_status=${paymentStatusFilter}` : "";
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : "";
      const sdParam = startDate ? `&startDate=${startDate}` : "";
      const edParam = endDate ? `&endDate=${endDate}` : "";
      const pgParam = `&page=${currentPage}&limit=${pageSize}`;

      const res = await fetch(
        `/api/production/lots?${bParam}${dParam}${sParam}${wParam}${wlsParam}${pParam}${searchParam}${sdParam}${edParam}${pgParam}`
      );
      if (!res.ok) throw new Error("Failed to fetch lots");
      return res.json();
    },
    { skeleton: "table" }
  );

  const lotsResult = lotsQuery.data;
  const isLoading = lotsQuery.isPending;
  const isError = lotsQuery.isError;
  const error = lotsQuery.error;
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

  const totalPages = Math.ceil(meta.total / pageSize) || 1;

  const handleClearFilters = () => {
    setSearch("");
    setBrandFilter("all");
    setDesignFilter("all");
    setStatusFilter("all");
    setWorkerFilter("all");
    setWorkerLotStatusFilter("all");
    setPaymentStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const chartData = [
    { name: "In Progress", value: stats.in_progress, color: "#6366F1" },
    { name: "Completed", value: stats.completed, color: "#15803D" },
    { name: "On Hold", value: stats.on_hold, color: "#D97706" },
    { name: "Cancelled", value: stats.cancelled, color: "#DC2626" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
            Production Lots
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 font-medium">
            View and manage all production lots
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AsyncButton
            onClick={() => router.push("/production/lots/new")}
            variant="primary"
            className="h-10 px-4 text-sm font-semibold flex items-center gap-2"
          >
            <Plus className="h-4 w-4 text-white" />
            Create Lot
          </AsyncButton>
        </div>
      </div>

        {/* 5 Stat Cards */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4"
        >
          <motion.div variants={cardVariants} whileHover={hoverLift.hover} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-2.5 sm:gap-4 transition-shadow">
            <div className="p-2 sm:p-3 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0">
              <ClipboardList className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate block">Total Lots</span>
              <p className="text-base sm:text-2xl font-bold text-[var(--text-primary)] mt-0.5">{stats.total}</p>
              <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] font-medium block mt-0.5">All time</span>
            </div>
          </motion.div>

          <motion.div variants={cardVariants} whileHover={hoverLift.hover} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-2.5 sm:gap-4 transition-shadow">
            <div className="p-2 sm:p-3 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
              <Clock className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate block">In Progress</span>
              <p className="text-base sm:text-2xl font-bold text-blue-500 mt-0.5">{stats.in_progress}</p>
              <span className="text-[9px] sm:text-[10px] text-blue-500 font-semibold block mt-0.5">
                {percentages.in_progress}%
              </span>
            </div>
          </motion.div>

          <motion.div variants={cardVariants} whileHover={hoverLift.hover} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-2.5 sm:gap-4 transition-shadow">
            <div className="p-2 sm:p-3 bg-green-500/10 rounded-lg text-green-500 shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate block">Completed</span>
              <p className="text-base sm:text-2xl font-bold text-green-500 mt-0.5">{stats.completed}</p>
              <span className="text-[9px] sm:text-[10px] text-green-500 font-semibold block mt-0.5">
                {percentages.completed}%
              </span>
            </div>
          </motion.div>

          <motion.div variants={cardVariants} whileHover={hoverLift.hover} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-2.5 sm:gap-4 transition-shadow">
            <div className="p-2 sm:p-3 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
              <PauseCircle className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate block">On Hold</span>
              <p className="text-base sm:text-2xl font-bold text-amber-500 mt-0.5">{stats.on_hold}</p>
              <span className="text-[9px] sm:text-[10px] text-amber-500 font-semibold block mt-0.5">
                {percentages.on_hold}%
              </span>
            </div>
          </motion.div>

          <motion.div variants={cardVariants} whileHover={hoverLift.hover} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex items-center gap-2.5 sm:gap-4 transition-shadow col-span-2 sm:col-span-1">
            <div className="p-2 sm:p-3 bg-red-500/10 rounded-lg text-red-500 shrink-0">
              <XCircle className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate block">Cancelled</span>
              <p className="text-base sm:text-2xl font-bold text-red-500 mt-0.5">{stats.cancelled}</p>
              <span className="text-[9px] sm:text-[10px] text-red-500 font-semibold block mt-0.5">
                {percentages.cancelled}%
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* Mobile: compact search bar + filter sheet trigger */}
        <div className="md:hidden flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search Lot No., Design..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-3 h-10 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-colors"
            />
          </div>
          <MobileFilterSheet
            activeCount={[
              brandFilter !== "all",
              designFilter !== "all",
              statusFilter !== "all",
              workerFilter !== "all",
              workerLotStatusFilter !== "all",
              paymentStatusFilter !== "all",
              startDate,
              endDate,
            ].filter(Boolean).length}
            onClearAll={handleClearFilters}
          >
            <MobileFilterField label="Brand">
              <select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="all">All Brands</option>
                {brandsData?.brands?.map((b: Brand) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </MobileFilterField>

            <MobileFilterField label="Design">
              <select
                value={designFilter}
                onChange={(e) => {
                  setDesignFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="all">All Designs</option>
                {designsData?.designs?.map((d: Design) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </MobileFilterField>

            <MobileFilterField label="Lot Status">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </MobileFilterField>

            <MobileFilterField label="Worker">
              <select
                value={workerFilter}
                onChange={(e) => {
                  setWorkerFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="all">All Workers</option>
                {workersData?.workers?.map((w: Worker) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.worker_id})
                  </option>
                ))}
              </select>
            </MobileFilterField>

            <MobileFilterField label="Payment Status">
              <select
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid Lots</option>
                <option value="unpaid">Unpaid Lots</option>
              </select>
            </MobileFilterField>

            <MobileFilterField label="Date From">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </MobileFilterField>

            <MobileFilterField label="Date To">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
              />
            </MobileFilterField>
          </MobileFilterSheet>
        </div>

        {/* Desktop Filter Bar — unchanged */}
        <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by Lot No. or Design..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-4 h-10 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] transition-all"
              />
            </div>

            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-[160px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="all">All Brands</option>
              {brandsData?.brands?.map((b: Brand) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={designFilter}
              onChange={(e) => {
                setDesignFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-[160px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="all">All Designs</option>
              {designsData?.designs?.map((d: Design) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-[140px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={workerFilter}
              onChange={(e) => {
                setWorkerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-[150px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="all">All Workers</option>
              {workersData?.workers?.map((w: Worker) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.worker_id})
                </option>
              ))}
            </select>

            <select
              value={workerLotStatusFilter}
              onChange={(e) => {
                setWorkerLotStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-[165px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="all">All Worker Lots</option>
              <option value="working">Currently Working</option>
              <option value="completed">Completed by Worker</option>
            </select>

            <select
              value={paymentStatusFilter}
              onChange={(e) => {
                setPaymentStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-[140px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid Lots</option>
              <option value="unpaid">Unpaid Lots</option>
            </select>

            <div className="flex items-center gap-2 border border-[var(--input-border)] rounded-lg px-2 h-10 bg-[var(--input-bg)]">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs border-0 p-0 focus:ring-0 w-[110px] bg-transparent text-[var(--text-primary)]"
              />
              <span className="text-[var(--text-faint)] text-xs font-semibold">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs border-0 p-0 focus:ring-0 w-[110px] bg-transparent text-[var(--text-primary)]"
              />
            </div>

            {(brandFilter !== "all" ||
              designFilter !== "all" ||
              statusFilter !== "all" ||
              workerFilter !== "all" ||
              workerLotStatusFilter !== "all" ||
              paymentStatusFilter !== "all" ||
              search ||
              startDate ||
              endDate) && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-[var(--primary)] font-semibold hover:underline shrink-0 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Production Lots Table */}
        <PageState
          isLoading={isLoading}
          isError={isError}
          error={error ? (error instanceof Error ? error.message : "Failed to load production lots") : undefined}
          onRetry={lotsQuery.refetch}
          isEmpty={lots.length === 0}
          emptyTitle="No Production Lots Found"
          emptyMessage="No production lots match the selected filters or search terms."
          emptyAction={
            (brandFilter !== "all" ||
              designFilter !== "all" ||
              statusFilter !== "all" ||
              workerFilter !== "all" ||
              workerLotStatusFilter !== "all" ||
              paymentStatusFilter !== "all" ||
              search ||
              startDate ||
              endDate) ? (
              <button
                onClick={handleClearFilters}
                className="px-4 h-9 bg-[var(--primary)] text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <AsyncButton onClick={() => router.push("/production/lots/new")} variant="primary">
                + Create First Lot
              </AsyncButton>
            )
          }
          skeletonVariant="table"
          skeletonRows={8}
          skeletonColumns={13}
        >
          {/* ── MOBILE: Lot card list ── */}
          <div className="md:hidden space-y-2.5">
            {lots.map((lot: Lot) => {
              const effectiveSizeSet = lot.size_set || lot.design?.size_set || null;
              const sizesStr = effectiveSizeSet?.name
                ? `${effectiveSizeSet.name}${effectiveSizeSet.sizes ? ` (${effectiveSizeSet.sizes.join(", ")})` : ""}`
                : effectiveSizeSet?.sizes ? effectiveSizeSet.sizes.join(", ") : "";
              const activeColours = lot.colours && lot.colours.length > 0 ? lot.colours : lot.colour ? [lot.colour] : [];
              const pct = Math.min(Math.round((lot.completed_quantity / (lot.total_quantity || 1)) * 100), 100);
              return (
                <div key={lot.id}
                  className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden active:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                  onClick={() => router.push(`/production/lots/${lot.id}`)}
                >
                  {/* Header: Lot# + Status badge */}
                  <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5">
                    <Link href={`/production/lots/${lot.id}`} onClick={(e) => e.stopPropagation()}
                      className="font-mono font-bold text-[var(--primary)] text-sm hover:underline"
                    >{lot.lot_number}</Link>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      lot.status === "in_progress" ? "bg-blue-500/10 text-blue-500" :
                      lot.status === "completed" ? "bg-green-500/10 text-green-500" :
                      lot.status === "on_hold" ? "bg-amber-500/10 text-amber-500" :
                      lot.status === "cancelled" ? "bg-red-500/10 text-red-500" :
                      "bg-[var(--page-bg)] text-[var(--text-muted)]"
                    )}>{lot.status.replace("_", " ")}</span>
                  </div>

                  {/* Brand & Design */}
                  <div className="px-3.5 pb-1.5">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {lot.brand?.name || "—"} &bull; {lot.design?.code ? `${lot.design.code} – ${lot.design.name}` : "—"}
                    </p>
                  </div>

                  {/* Colours + Sizes */}
                  <div className="flex items-center flex-wrap gap-1.5 px-3.5 pb-1.5">
                    {activeColours.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-primary)] bg-[var(--page-bg)] px-1.5 py-0.5 rounded-full border border-[var(--border)]">
                        {c.hex_code && <span className="w-2 h-2 rounded-full border border-[var(--border)]" style={{ backgroundColor: c.hex_code }} />}
                        {c.colour_name}
                      </span>
                    ))}
                    {sizesStr && <span className="text-[11px] text-[var(--text-muted)] font-medium">{sizesStr}</span>}
                  </div>

                  {/* Progress bar */}
                  <div className="px-3.5 pb-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-[var(--text-muted)] mb-1">
                      <span>{lot.completed_quantity}/{lot.total_quantity} pcs</span>
                      <span>{pct}%</span>
                    </div>
                    <ProgressBar value={lot.completed_quantity} total={lot.total_quantity} />
                    {(Number(lot.b_grade_quantity || 0) > 0 || Number(lot.scrapped_quantity || 0) > 0 || Number(lot.reworked_quantity || 0) > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                        {Number(lot.b_grade_quantity || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
                            📦 {lot.b_grade_quantity} B-Grade
                          </span>
                        )}
                        {Number(lot.scrapped_quantity || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-medium">
                            🗑️ {lot.scrapped_quantity} Scrap
                          </span>
                        )}
                        {Number(lot.reworked_quantity || 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                            ⚠️ {lot.reworked_quantity} Reworked
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Meta strip: payment status + dates */}
                  <div className="flex items-center flex-wrap gap-2 px-3.5 pb-1.5 border-t border-[var(--border-light)] pt-1.5">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      lot.lot_payment_status === "paid" ? "bg-emerald-500/10 text-emerald-500" :
                      lot.lot_payment_status === "partial" ? "bg-amber-500/10 text-amber-500" :
                      lot.lot_payment_status === "unpaid" ? "bg-rose-500/10 text-rose-500" :
                      "bg-[var(--page-bg)] text-[var(--text-muted)]"
                    )}>{lot.lot_payment_status || "none"}</span>
                    {lot.target_due_date && (
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">Due: {formatDate(lot.target_due_date)}</span>
                    )}
                    {lot.status === "completed" ? (
                      <span className="text-[10px] font-semibold text-emerald-500">🏁 {lot.days_taken_to_complete || lot.days_in_working_stage || 1}d</span>
                    ) : lot.status === "in_progress" ? (
                      <span className="text-[10px] font-semibold text-blue-500">⏱️ {lot.days_in_working_stage || 1}d in stage</span>
                    ) : null}
                  </div>

                  {/* Action footer */}
                  <div className="flex items-center gap-1.5 px-3.5 pb-2.5 border-t border-[var(--border-light)] pt-1.5" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/production/lots/${lot.id}`} onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-[var(--primary)] flex items-center justify-center cursor-pointer" title="View"
                    ><Eye size={13} /></Link>
                    <Link href={`/production/lots/${lot.id}/edit`} onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-amber-500 flex items-center justify-center cursor-pointer" title="Edit"
                    ><Edit size={13} /></Link>
                    <Link href={`/production/stage-entries/new?lot_id=${lot.id}`} onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-blue-500 flex items-center justify-center cursor-pointer" title="Add Stage Entry"
                    ><PlusCircle size={13} /></Link>
                    {!lot.is_moved_to_stock && (
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); router.push(`/production/lots/${lot.id}`); }}
                        className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-emerald-500 flex items-center justify-center cursor-pointer" title="Move to Stock"
                      ><Boxes size={13} /></button>
                    )}
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: lot.id, status: lot.status === "on_hold" ? "in_progress" : "on_hold" }); }}
                      className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--page-bg)] text-amber-500 flex items-center justify-center cursor-pointer" title={lot.status === "on_hold" ? "Resume" : "Hold"}
                    >{lot.status === "on_hold" ? <Play size={13} /> : <PauseCircle size={13} />}</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP: existing table ── */}
          <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Lots Directory</span>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
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
                className="h-8 rounded border border-[var(--input-border)] bg-[var(--input-bg)] pl-2.5 pr-7 text-xs font-semibold text-[var(--text-primary)] cursor-pointer focus:ring-1 focus:ring-[var(--input-focus)]"
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
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="py-3 px-4 w-[130px]">Lot No.</th>
                  <th className="py-3 px-4">Brand & Design</th>
                  <th className="py-3 px-4">Colour & Size Set</th>
                  <th className="py-3 px-4 w-44">Progress & Qty</th>
                  <th className="py-3 px-4 text-center">Status & Duration</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Timeline</th>
                  <th className="py-3 px-4 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm">
                {lots.map((lot: Lot) => {
                  const effectiveSizeSet = lot.size_set || lot.design?.size_set || null;
                  const sizesStr = effectiveSizeSet?.name
                    ? `${effectiveSizeSet.name}${effectiveSizeSet.sizes ? ` (${effectiveSizeSet.sizes.join(", ")})` : ""}`
                    : effectiveSizeSet?.sizes
                    ? effectiveSizeSet.sizes.join(", ")
                    : "—";
                  const activeColours = lot.colours && lot.colours.length > 0
                    ? lot.colours
                    : lot.colour ? [lot.colour] : [];

                  return (
                    <motion.tr
                      key={lot.id}
                      variants={tableRowVariants}
                      initial="initial"
                      animate="animate"
                      onClick={() => router.push(`/production/lots/${lot.id}`)}
                      className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-[var(--primary)] whitespace-nowrap">
                        <Link
                          href={`/production/lots/${lot.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {lot.lot_number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-body)]">
                        <div className="font-semibold text-xs text-[var(--text-primary)]">{lot.brand?.name || "—"}</div>
                        <div className="text-xs text-[var(--text-muted)] font-medium mt-0.5 truncate max-w-[180px]" title={lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : undefined}>
                          {lot.design?.code ? `${lot.design.code} - ${lot.design.name}` : "—"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-body)]">
                        <div className="flex flex-wrap items-center gap-1">
                          {activeColours.length === 0 ? (
                            <span className="text-xs text-[var(--text-faint)]">—</span>
                          ) : (
                            activeColours.map((c, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-primary)] bg-[var(--page-bg)] px-1.5 py-0.5 rounded-full border border-[var(--border)]">
                                {c.hex_code && (
                                  <span
                                    className="w-2 h-2 rounded-full border border-[var(--border)]"
                                    style={{ backgroundColor: c.hex_code }}
                                  />
                                )}
                                {c.colour_name}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-medium mt-1 truncate max-w-[140px]" title={sizesStr}>
                          {sizesStr}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] mb-1">
                          <span>{lot.total_quantity} Pcs</span>
                          <span className="text-[11px] text-[var(--text-muted)] font-medium">
                            {Math.min(Math.round((lot.completed_quantity / (lot.total_quantity || 1)) * 100), 100)}%
                          </span>
                        </div>
                        <ProgressBar value={lot.completed_quantity} total={lot.total_quantity} />
                        {(Number(lot.b_grade_quantity || 0) > 0 || Number(lot.scrapped_quantity || 0) > 0 || Number(lot.reworked_quantity || 0) > 0) && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[10px]">
                            {Number(lot.b_grade_quantity || 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium" title="Diverted to B-Grade stock">
                                📦 {lot.b_grade_quantity} B-Grade
                              </span>
                            )}
                            {Number(lot.scrapped_quantity || 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-medium" title="Scrapped / written off">
                                🗑️ {lot.scrapped_quantity} Scrap
                              </span>
                            )}
                            {Number(lot.reworked_quantity || 0) > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium" title="Reworked">
                                ⚠️ {lot.reworked_quantity} Rework
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              lot.status === "in_progress"
                                ? "bg-blue-500/10 text-blue-500"
                                : lot.status === "completed"
                                ? "bg-green-500/10 text-green-500"
                                : lot.status === "on_hold"
                                ? "bg-amber-500/10 text-amber-500"
                                : lot.status === "cancelled"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-[var(--page-bg)] text-[var(--text-muted)]"
                            }`}
                          >
                            {lot.status.replace("_", " ")}
                          </span>

                          {lot.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500" title="Days taken to complete">
                              🏁 {lot.days_taken_to_complete || lot.days_in_working_stage || 1}d completed
                            </span>
                          ) : lot.status === "in_progress" || lot.status === "on_hold" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500" title="Days in working stage">
                              ⏱️ {lot.days_in_working_stage || 1}d in stage
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            lot.lot_payment_status === "paid"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : lot.lot_payment_status === "partial"
                              ? "bg-amber-500/10 text-amber-500"
                              : lot.lot_payment_status === "unpaid"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-[var(--page-bg)] text-[var(--text-muted)]"
                          }`}
                        >
                          {lot.lot_payment_status || "none"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-[11px] font-mono text-[var(--text-body)]">
                        <div>Start: {formatDate(lot.target_start_date)}</div>
                        <div className="text-[var(--text-muted)] mt-0.5">Due: {formatDate(lot.target_due_date)}</div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/production/lots/${lot.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-colors"
                            title="View Detail"
                          >
                            <Eye size={16} />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="w-8 h-8 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                            >
                              <MoreVertical size={16} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[150px] bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-primary)]">
                              <DropdownMenuItem
                                onClick={() => router.push(`/production/lots/${lot.id}/edit`)}
                              >
                                <Edit size={14} className="mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {!lot.is_moved_to_stock && (
                                <DropdownMenuItem
                                  onClick={() => router.push(`/production/lots/${lot.id}`)}
                                  className="text-emerald-500 font-semibold"
                                >
                                  <Boxes size={14} className="mr-2" />
                                  Move to Finished Stock
                                </DropdownMenuItem>
                              )}
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
                                className="text-red-500 hover:bg-red-500/10"
                              >
                                <XCircle size={14} className="mr-2" />
                                Cancel Lot
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="bg-[var(--table-header-bg)] border-t border-[var(--border)] px-5 py-3.5 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-[var(--border)] rounded-md text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--card-bg)] disabled:opacity-50 transition-colors"
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
                        ? "bg-[var(--primary)] text-white"
                        : "border border-[var(--border)] text-[var(--text-body)] hover:bg-[var(--card-bg)]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-[var(--border)] rounded-md text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--card-bg)] disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </PageState>

      {/* Bottom Section: Recharts Pie + Top Designs + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pie Chart: Lots by Status */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider mb-4">
              Lots by Status
            </h3>

            <div className="h-44 w-full relative">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-[var(--text-faint)]">
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
                    <Tooltip
                      contentStyle={{
                        background: chartTheme.tooltipBg,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        color: chartTheme.text,
                      }}
                      formatter={(value) => [`${value} Lots`, "Count"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs font-medium text-[var(--text-muted)]">
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
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] border-b border-[var(--border)] pb-3 uppercase tracking-wider mb-3">
                Top Designs (By Lots)
              </h3>
              {topDesigns.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-faint)]">
                  No design lot details logged yet.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {topDesigns.map((td: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center py-2.5">
                      <span className="text-sm text-[var(--text-body)] font-semibold">
                        {td.code} - {td.name}
                      </span>
                      <span className="text-sm font-bold text-[var(--text-primary)]">{td.count} Lots</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/master-data/designs"
              className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 mt-3"
            >
              View all designs
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* Recent Activity */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)]">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 mb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Recent Activity
              </h3>
              <Link href="/settings/audit-logs" className="text-xs font-bold text-[var(--primary)] hover:underline">
                View All
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-faint)]">
                No recent activity recorded.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] max-h-[220px] overflow-y-auto pr-1">
                {recentActivity.map((act: any) => (
                  <div key={act.id} className="flex items-start gap-3 py-2.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        act.icon === "completed"
                          ? "bg-green-500/10 text-green-500"
                          : act.icon === "stage_entry"
                          ? "bg-blue-500/10 text-blue-500"
                          : act.icon === "on_hold"
                          ? "bg-amber-500/10 text-amber-500"
                          : act.icon === "cancelled"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-[var(--primary-light)] text-[var(--primary)]"
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
                      <p className="text-xs font-semibold text-[var(--text-body)] leading-snug">
                        {act.actionText}
                      </p>
                      <span className="text-[10px] text-[var(--text-muted)] font-medium block mt-0.5">
                        by {act.userName}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-faint)] font-medium shrink-0">
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
