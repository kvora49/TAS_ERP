"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  CheckCircle,
  Eye,
  Search,
  IndianRupee,
  Calendar,
  Building2,
  MapPin,
  Phone,
  ClipboardList,
  Clock,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import WorkerAvatar from "@/components/shared/WorkerAvatar";
import LotSummaryPanel from "@/components/shared/LotSummaryPanel";

interface LedgerRow {
  id: string;
  date: string;
  entry_type: "stage_entry" | "payment";
  ref_no: string;
  lot_id: string | null;
  lot_number: string;
  stage_name: string;
  qty: number | null;
  rate: number | null;
  amount: number;
  balance: number;
  payment_status?: string;
  bank_name?: string | null;
}

interface WorkerLedgerProps {
  params: { workerId: string };
}

export default function WorkerLedgerPage({ params }: WorkerLedgerProps) {
  const { workerId } = params;
  const router = useRouter();

  // Filters State
  const [search, setSearch] = useState("");
  const [lotFilter, setLotFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Query: Worker Ledger
  const { data: ledgerData, isLoading, error } = useQuery({
    queryKey: ["worker-ledger", workerId],
    queryFn: async () => {
      const res = await fetch(`/api/production/job-work/ledger/${workerId}`);
      if (!res.ok) throw new Error("Failed to fetch ledger details");
      return res.json();
    },
  });

  const worker = ledgerData?.worker || null;
  const ledger: LedgerRow[] = ledgerData?.ledger || [];
  const stats = ledgerData?.stats || { totalJobWorkAmount: 0, totalPaidAmount: 0, currentOutstanding: 0, totalEntries: 0 };

  // Filter ledger in-memory for quick reactivity
  const filteredLedger = ledger.filter((row) => {
    // Search filter
    const matchesSearch =
      row.ref_no.toLowerCase().includes(search.toLowerCase()) ||
      row.lot_number.toLowerCase().includes(search.toLowerCase()) ||
      row.stage_name.toLowerCase().includes(search.toLowerCase());

    // Lot filter
    const matchesLot = lotFilter === "all" || row.lot_number === lotFilter;

    // Stage filter
    const matchesStage = stageFilter === "all" || row.stage_name === stageFilter;

    // Status filter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "unpaid" && row.payment_status === "unpaid") ||
      (statusFilter === "partial" && row.payment_status === "partial") ||
      (statusFilter === "paid" && row.payment_status === "paid");

    // Date range
    const matchesDate =
      (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate);

    return matchesSearch && matchesLot && matchesStage && matchesStatus && matchesDate;
  });

  // Pagination logic
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLedger = filteredLedger.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(filteredLedger.length / pageSize) || 1;

  // Clear filters
  const handleClearFilters = () => {
    setSearch("");
    setLotFilter("all");
    setStageFilter("all");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  // Export CSV
  const handleExport = () => {
    if (filteredLedger.length === 0) {
      toast.error("No ledger entries to export");
      return;
    }
    const headers = ["Date", "Entry Type", "Ref. No.", "Lot No.", "Stage", "Qty Out", "Rate", "Amount", "Payment", "Outstanding Balance"];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...filteredLedger.map((row) =>
          [
            row.date,
            row.entry_type === "stage_entry" ? "Stage Entry" : "Payment",
            row.ref_no,
            row.lot_number,
            row.stage_name,
            row.qty || "",
            row.rate || "",
            row.entry_type === "stage_entry" ? row.amount : "",
            row.entry_type === "payment" ? Math.abs(row.amount) : "",
            row.balance,
          ].join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${worker?.name || "worker"}_ledger_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Ledger exported successfully");
  };

  // Unique lots and stages for dropdown lists
  const lotOptions = Array.from(new Set(ledger.map((r) => r.lot_number).filter((l) => l !== "—")));
  const stageOptions = Array.from(new Set(ledger.map((r) => r.stage_name).filter(Boolean)));

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  // Right Outstanding summary items
  const outstandingSummaryItems = [
    { label: "Total Job Work Amount", value: formatCurrency(stats.totalJobWorkAmount) },
    { label: "Total Paid Amount", value: formatCurrency(stats.totalPaidAmount) },
    {
      label: "Outstanding Amount",
      value: <span className="text-[#DC2626] font-bold">{formatCurrency(stats.currentOutstanding)}</span>,
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <span className="text-sm text-[#64748B]">Loading worker ledger...</span>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-2">
        <span className="text-sm font-semibold text-red-500">Failed to load worker ledger</span>
        <Link href="/production/job-work/list" className="text-xs text-[#6366F1] hover:underline">
          Back to Job Work List
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[#6366F1] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <Link href="/production/job-work/list" className="hover:text-[#6366F1] transition-colors">
              Job Work
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Job Worker Ledger</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Job Worker Ledger
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#374151] font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer bg-white"
          >
            <Download size={16} />
            Export Ledger
          </button>
          <button
            type="button"
            onClick={() => router.push(`/production/job-work/record-payment?worker_id=${workerId}`)}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
          >
            <CheckCircle className="h-4 w-4 text-white" />
            Record Payment
          </button>
        </div>
      </div>

      {/* WORKER HEADER CARD */}
      <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6 bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 pr-6 lg:border-r border-[#F3F4F6] w-full lg:max-w-[360px]">
          <WorkerAvatar name={worker.name} size="md" />
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">{worker.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#EDE9FE] text-[#7C3AED]">
                Job Worker
              </span>
              <span className="text-xs font-mono font-bold text-[#64748B]">{worker.worker_id}</span>
            </div>
            <div className="space-y-1 mt-2 text-xs text-[#64748B] font-semibold">
              {worker.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={12} className="text-[#94A3B8]" />
                  <span>{worker.phone}</span>
                </div>
              )}
              {worker.bank_name && worker.account_number && (
                <div className="flex items-center gap-1.5">
                  <Building2 size={12} className="text-[#94A3B8]" />
                  <span>
                    {worker.bank_name} - {worker.account_number}
                  </span>
                </div>
              )}
              {worker.address && (
                <div className="flex items-start gap-1.5">
                  <MapPin size={12} className="text-[#94A3B8] mt-0.5 shrink-0" />
                  <span className="leading-none">
                    {worker.address}, {worker.city}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 py-2 px-6">
          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Worker Type</span>
            <span className="text-sm font-semibold text-[#374151] mt-1 block capitalize">
              {worker.type.replace("_", " ")}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Rate (Per Pc)</span>
            <span className="text-sm font-semibold text-[#374151] mt-1 block font-mono">
              {formatCurrency(worker.default_rate || 0)}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Status</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1 ${
                worker.is_active ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#DC2626]"
              }`}
            >
              {worker.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          <div>
            <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider block">Joined</span>
            <span className="text-sm font-medium text-[#374151] mt-1 block">
              {worker.working_since
                ? new Date(worker.working_since).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* 4 STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Job Work Amount */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Job Work Amount</span>
            <p className="text-xl font-bold text-[#0F172A] mt-0.5">{formatCurrency(stats.totalJobWorkAmount)}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">All Time</span>
          </div>
        </div>

        {/* Total Paid Amount */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F0FDF4] rounded-lg text-[#16A34A] shrink-0">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Paid Amount</span>
            <p className="text-xl font-bold text-[#15803D] mt-0.5">{formatCurrency(stats.totalPaidAmount)}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">All Time</span>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEF9C3] rounded-lg text-[#D97706] shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Outstanding</span>
            <p className="text-xl font-bold text-[#D97706] mt-0.5">{formatCurrency(stats.currentOutstanding)}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">All Time</span>
          </div>
        </div>

        {/* Total Entries */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Entries</span>
            <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{stats.totalEntries}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">All Time</span>
          </div>
        </div>
      </div>

      {/* Main Ledger Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filter + Ledger Table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Table Container */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-5 py-4 border-b border-[#E5E7EB] gap-3">
              <span className="text-sm font-semibold text-[#374151]">Ledger Transactions</span>
              
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Search by Lot, Ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 rounded border border-[#E5E7EB] bg-white px-2.5 text-xs w-[140px]"
                />

                <select
                  value={lotFilter}
                  onChange={(e) => setLotFilter(e.target.value)}
                  className="h-8 rounded border border-[#E5E7EB] bg-white px-2.5 text-xs w-[110px]"
                >
                  <option value="all">All Lots</option>
                  {lotOptions.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>

                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="h-8 rounded border border-[#E5E7EB] bg-white px-2.5 text-xs w-[110px]"
                >
                  <option value="all">All Stages</option>
                  {stageOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                {(search || lotFilter !== "all" || stageFilter !== "all" || statusFilter !== "all" || startDate || endDate) && (
                  <button onClick={handleClearFilters} className="text-xs text-[#6366F1] font-semibold hover:underline">
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                    <th className="py-2.5 px-4 w-10">#</th>
                    <th className="py-2.5 px-4 w-28">Date</th>
                    <th className="py-2.5 px-4">Entry Type</th>
                    <th className="py-2.5 px-4">Ref. No.</th>
                    <th className="py-2.5 px-4">Lot No.</th>
                    <th className="py-2.5 px-4">Stage</th>
                    <th className="py-2.5 px-4 text-right">Qty</th>
                    <th className="py-2.5 px-4 text-right">Rate</th>
                    <th className="py-2.5 px-4 text-right">Amount (Dr)</th>
                    <th className="py-2.5 px-4 text-right">Payment (Cr)</th>
                    <th className="py-2.5 px-4 text-right font-bold">Balance</th>
                    <th className="py-2.5 px-4 text-center w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-sm">
                  {paginatedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-[#64748B]">
                        No ledger rows match the filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedLedger.map((row, index) => (
                      <tr key={row.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 text-[#64748B] font-medium">{startIndex + index + 1}</td>
                        <td className="py-3 px-4">{row.date}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              row.entry_type === "stage_entry"
                                ? "bg-[#DBEAFE] text-[#1D4ED8]"
                                : "bg-[#DCFCE7] text-[#15803D]"
                            }`}
                          >
                            {row.entry_type === "stage_entry" ? "Stage Entry" : "Payment"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{row.ref_no}</td>
                        <td className="py-3 px-4 font-mono text-xs text-[#6366F1] font-bold">
                          {row.lot_id ? (
                            <Link href={`/production/lots/${row.lot_id}`} className="hover:underline">
                              {row.lot_number}
                            </Link>
                          ) : (
                            row.lot_number
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold">{row.stage_name}</td>
                        <td className="py-3 px-4 text-right">{row.qty !== null ? row.qty : "—"}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          {row.rate !== null ? `₹${row.rate.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#0F172A]">
                          {row.entry_type === "stage_entry" ? formatCurrency(row.amount) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#15803D]">
                          {row.entry_type === "payment" ? formatCurrency(Math.abs(row.amount)) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-[#0F172A]">
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.entry_type === "stage_entry" && (
                            <Link
                              href={`/production/stage-entries/${row.id}`}
                              className="w-7 h-7 border border-[#E5E7EB] rounded flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors"
                              title="View Stage Entry"
                            >
                              <Eye size={12} />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="bg-[#F9FAFB] border-t border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-md text-xs font-semibold text-[#374151] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-6 h-6 rounded text-xs font-bold ${
                        currentPage === i + 1 ? "bg-[#6366F1] text-white" : "border text-[#374151] hover:bg-white"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-md text-xs font-semibold text-[#374151] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Summaries */}
        <div className="lg:col-span-1 space-y-6">
          {/* Outstanding Summary panel */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sticky top-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-semibold text-[#DC2626] mb-4">
              <ShoppingBag className="h-5 w-5 text-[#DC2626]" />
              <span>Outstanding Summary</span>
            </h3>

            <div className="text-center py-5 border-b border-[#F3F4F6]">
              <span className="text-3xl font-black text-[#DC2626] block">
                {formatCurrency(stats.currentOutstanding)}
              </span>
              <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider block mt-1.5">
                Outstanding Amount
              </span>
            </div>

            <div className="flex flex-col mt-4">
              {outstandingSummaryItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                  <span className="text-xs text-[#64748B] font-semibold">{item.label}</span>
                  <span className="text-sm font-semibold text-[#374151]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
