"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  IndianRupee,
  CheckCircle,
  Clock,
  Download,
  Plus,
  Eye,
  MoreVertical,
  RotateCcw,
  ChevronRight,
  BookOpen,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface JobWorkEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  qty_out: number;
  job_work_rate: number;
  total_job_work_amount: number;
  paid_amount: number;
  payment_status: "unpaid" | "partial" | "paid";
  lot_id: string;
  lot?: { lot_number: string };
  stage?: { stage_name: string };
  worker?: { id: string; name: string; worker_id: string };
}

interface Worker {
  id: string;
  name: string;
  worker_id: string;
}

interface Lot {
  id: string;
  lot_number: string;
}

export default function JobWorkListPage() {
  const router = useRouter();

  // Filters State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [lotFilter, setLotFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<string>("entry_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Queries
  const { data: workersData } = useQuery<{ workers: Worker[] }>({
    queryKey: ["workers-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/workers");
      return res.json();
    },
  });

  const { data: lotsData } = useQuery<{ lots: Lot[] }>({
    queryKey: ["lots-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/production/lots");
      return res.json();
    },
  });

  const { data: jobWorkData, isLoading } = useQuery({
    queryKey: ["job-work-list", workerFilter, stageFilter, lotFilter, statusFilter, search, startDate, endDate],
    queryFn: async () => {
      const wParam = workerFilter !== "all" ? `&worker_id=${workerFilter}` : "";
      const sParam = stageFilter !== "all" ? `&stage_id=${stageFilter}` : "";
      const lParam = lotFilter !== "all" ? `&lot_id=${lotFilter}` : "";
      const stParam = statusFilter !== "all" ? `&payment_status=${statusFilter}` : "";
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const sdParam = startDate ? `&startDate=${startDate}` : "";
      const edParam = endDate ? `&endDate=${endDate}` : "";

      const res = await fetch(`/api/production/job-work/list?${wParam}${sParam}${lParam}${stParam}${searchParam}${sdParam}${edParam}`);
      if (!res.ok) throw new Error("Failed to fetch job work list");
      return res.json();
    },
  });

  const entries: JobWorkEntry[] = jobWorkData?.entries || [];
  const stats = jobWorkData?.stats || { totalEntries: 0, totalJobWorkAmount: 0, totalPaidAmount: 0, totalOutstanding: 0 };
  const workers = workersData?.workers || [];
  const lots = lotsData?.lots || [];

  // Sort logic
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedEntries = [...entries].sort((a: any, b: any) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortField === "entry_date") {
      aVal = new Date(a.entry_date).getTime();
      bVal = new Date(b.entry_date).getTime();
    }

    if (aVal === bVal) return 0;
    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Pagination logic
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEntries = sortedEntries.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(sortedEntries.length / pageSize) || 1;

  // Clear filters
  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setWorkerFilter("all");
    setStageFilter("all");
    setLotFilter("all");
    setStatusFilter("all");
    setSearch("");
    setCurrentPage(1);
  };

  // Export CSV
  const handleExport = () => {
    if (entries.length === 0) {
      toast.error("No entries to export");
      return;
    }
    const headers = ["Entry Number", "Date", "Lot No.", "Stage", "Worker", "Qty Out", "Rate", "Total Amount", "Outstanding", "Status"];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...entries.map((e) =>
          [
            e.entry_number,
            e.entry_date,
            e.lot?.lot_number || "",
            e.stage?.stage_name || "",
            e.worker?.name || "",
            e.qty_out,
            e.job_work_rate,
            e.total_job_work_amount,
            e.total_job_work_amount - e.paid_amount,
            e.payment_status,
          ].join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `job_work_list_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Job Work entries exported successfully");
  };

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  // Extract unique stages for dropdown
  const stageOptions = Array.from(new Set(entries.map((e) => e.stage?.stage_name).filter(Boolean)));

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[#6366F1] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Job Work</span>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Job Work List</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Job Work List
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <Download size={16} />
            Export
          </button>
          <button
            type="button"
            onClick={() => router.push("/production/stage-entries/new")}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
          >
            <Plus className="h-4 w-4 text-white" />
            Add Stage Entry
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-2 h-10 bg-white">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border-0 p-0 focus:ring-0 w-[110px]"
            />
            <span className="text-[#94A3B8] text-xs font-semibold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border-0 p-0 focus:ring-0 w-[110px]"
            />
          </div>

          {/* Worker Filter */}
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            className="h-10 w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="all">All Workers</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-10 w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
          >
            <option value="all">All Stages</option>
            {stageOptions.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Lot Filter */}
          <select
            value={lotFilter}
            onChange={(e) => setLotFilter(e.target.value)}
            className="h-10 w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
          >
            <option value="all">All Lots</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lot_number}
              </option>
            ))}
          </select>

          {/* Payment Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 w-[160px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm"
          >
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] h-4 w-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Lot No., Worker..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
            />
          </div>

          {/* Clear Filters */}
          {(startDate || endDate || workerFilter !== "all" || stageFilter !== "all" || lotFilter !== "all" || statusFilter !== "all" || search) && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-[#6366F1] font-semibold hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <RotateCcw size={12} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Entries */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Entries</span>
            <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{stats.totalEntries}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">This Period</span>
          </div>
        </div>

        {/* Total Job Work Amount */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F0FDF4] rounded-lg text-[#16A34A] shrink-0">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Job Work Amount</span>
            <p className="text-xl font-bold text-[#0F172A] mt-0.5">{formatCurrency(stats.totalJobWorkAmount)}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">This Period</span>
          </div>
        </div>

        {/* Total Paid Amount */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#DBEAFE] rounded-lg text-[#1D4ED8] shrink-0">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Paid Amount</span>
            <p className="text-xl font-bold text-[#0F172A] mt-0.5">{formatCurrency(stats.totalPaidAmount)}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">This Period</span>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEF2F2] rounded-lg text-[#DC2626] shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Outstanding</span>
            <p className="text-xl font-bold text-[#DC2626] mt-0.5">{formatCurrency(stats.totalOutstanding)}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">This Period</span>
          </div>
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <span className="text-sm font-semibold text-[#374151]">Job Work Entries</span>
          <div className="flex items-center gap-4 text-xs text-[#64748B]">
            <span>
              Showing {entries.length === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(startIndex + pageSize, entries.length)} of {entries.length} entries
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="h-8 rounded border border-[#E5E7EB] bg-white px-2 text-xs focus:ring-1 focus:ring-[#6366F1]"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort("entry_date")}>
                  <div className="flex items-center gap-1">
                    Entry Date
                    <ArrowUpDown size={12} className="text-[#94A3B8]" />
                  </div>
                </th>
                <th className="py-3 px-4">Lot No.</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Worker/Tailor</th>
                <th className="py-3 px-4 text-right cursor-pointer select-none" onClick={() => handleSort("qty_out")}>
                  <div className="flex items-center justify-end gap-1">
                    Qty Out
                    <ArrowUpDown size={12} className="text-[#94A3B8]" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right cursor-pointer select-none" onClick={() => handleSort("total_job_work_amount")}>
                  <div className="flex items-center justify-end gap-1">
                    Total Amount
                    <ArrowUpDown size={12} className="text-[#94A3B8]" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Payment Status</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[#64748B]">
                    Loading entries...
                  </td>
                </tr>
              ) : paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-[#64748B]">
                    No entries found.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry, index) => {
                  const outstanding = entry.total_job_work_amount - entry.paid_amount;
                  return (
                    <tr key={entry.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3.5 px-4 text-[#64748B] font-medium">{startIndex + index + 1}</td>
                      <td className="py-3.5 px-4">{entry.entry_date}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-[#6366F1]">
                        <Link href={`/production/lots/${entry.lot_id}`} className="hover:underline">
                          {entry.lot?.lot_number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">{entry.stage?.stage_name || "—"}</td>
                      <td className="py-3.5 px-4 font-semibold">{entry.worker?.name || "—"}</td>
                      <td className="py-3.5 px-4 text-right font-medium">{entry.qty_out}</td>
                      <td className="py-3.5 px-4 text-right">₹{(entry.job_work_rate || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-[#0F172A]">
                        {formatCurrency(entry.total_job_work_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            entry.payment_status === "paid"
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : entry.payment_status === "partial"
                              ? "bg-[#FEF3C7] text-[#D97706]"
                              : "bg-[#FEE2E2] text-[#DC2626]"
                          }`}
                        >
                          {entry.payment_status}
                        </span>
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold ${
                          outstanding > 0 ? "text-[#DC2626]" : "text-[#374151]"
                        }`}
                      >
                        {formatCurrency(outstanding)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/production/stage-entries/${entry.id}`}
                            className="w-7 h-7 border border-[#E5E7EB] rounded flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors"
                            title="View Detail"
                          >
                            <Eye size={14} />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-7 h-7 border border-[#E5E7EB] rounded flex items-center justify-center text-[#64748B] hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                              <MoreVertical size={14} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[150px]">
                              {entry.payment_status !== "paid" && (
                                <DropdownMenuItem
                                  onClick={() => router.push(`/production/job-work/record-payment?worker_id=${entry.worker?.id}`)}
                                >
                                  <IndianRupee size={12} className="mr-2" />
                                  Record Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => router.push(`/production/lots/${entry.lot_id}`)}
                              >
                                <BookOpen size={12} className="mr-2" />
                                View Lot
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
    </div>
  );
}
