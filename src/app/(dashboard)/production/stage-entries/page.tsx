"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ClipboardList,
  ChevronRight,
  Search,
  Plus,
  Eye,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface StageEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  qty_in: number;
  qty_out: number;
  wastage_qty: number;
  wastage_percent: number;
  total_job_work_amount: number;
  payment_status: "unpaid" | "partial" | "paid";
  remarks: string | null;
  lot?: {
    id: string;
    lot_number: string;
    total_quantity: number;
  };
  stage?: {
    id: string;
    stage_name: string;
    sequence_no: number;
  };
  worker?: {
    id: string;
    name: string;
    worker_id: string;
  };
}

export default function StageEntriesListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all stage entries from API
  const { data, isLoading, error } = useQuery<{ entries: StageEntry[] }>({
    queryKey: ["stage-entries", search],
    queryFn: async () => {
      const res = await fetch(`/api/production/stage-entries?search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error("Failed to fetch stage entries");
      return res.json();
    },
  });

  const entries = data?.entries || [];

  // Filter entries based on search query (by entry number, lot number, stage name, or worker name)
  const filteredEntries = entries.filter((entry) => {
    const searchLower = search.toLowerCase();
    return (
      entry.entry_number.toLowerCase().includes(searchLower) ||
      (entry.lot?.lot_number || "").toLowerCase().includes(searchLower) ||
      (entry.stage?.stage_name || "").toLowerCase().includes(searchLower) ||
      (entry.worker?.name || "").toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Compute Stats
  const totalProcessed = entries.reduce((acc, curr) => acc + curr.qty_out, 0);
  const totalWastage = entries.reduce((acc, curr) => acc + curr.wastage_qty, 0);
  const totalLaborCost = entries.reduce((acc, curr) => acc + curr.total_job_work_amount, 0);

  return (
    <div className="p-6 space-y-6 select-none max-w-[1400px] mx-auto">
      {/* Breadcrumb and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[#6366F1] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Stage Entries</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Stage Entries
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push("/production/stage-entries/new")}
          className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10 self-start sm:self-center"
        >
          <Plus className="h-4 w-4 text-white" />
          Log Stage Entry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Logs</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-0.5">{entries.length}</h3>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#ECFDF5] rounded-lg text-[#10B981] shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Processed Qty</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-0.5">{totalProcessed.toLocaleString()} pcs</h3>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEF2F2] rounded-lg text-[#EF4444] shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Wastage</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-0.5">{totalWastage.toLocaleString()} pcs</h3>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FFF7ED] rounded-lg text-[#F97316] shrink-0">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Labor Cost</p>
            <h3 className="text-2xl font-bold text-[#0F172A] mt-0.5">₹{totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Entry #, Lot #, Stage, or Worker..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 pr-4 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[#64748B] font-medium">
            Loading stage entries...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-[#EF4444] font-medium">
            Failed to load stage entries.
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#64748B] font-medium">
            No stage entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-xs font-bold text-[#475569] uppercase tracking-wider">
                  <th className="py-3 px-5">Entry Number</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Lot Number</th>
                  <th className="py-3 px-5">Stage</th>
                  <th className="py-3 px-5">Worker</th>
                  <th className="py-3 px-5 text-right">Qty In</th>
                  <th className="py-3 px-5 text-right">Qty Out</th>
                  <th className="py-3 px-5 text-right">Wastage</th>
                  <th className="py-3 px-5 text-right">Labor Cost</th>
                  <th className="py-3 px-5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#334155]">
                {paginatedEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => router.push(`/production/stage-entries/${entry.id}`)}
                    className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-5 font-bold text-[#0F172A]">
                      {entry.entry_number}
                    </td>
                    <td className="py-3.5 px-5 text-[#64748B]">
                      {new Date(entry.entry_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-[#4F46E5] hover:underline">
                      <Link
                        href={`/production/lots/${entry.lot?.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.lot?.lot_number || "N/A"}
                      </Link>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-[#334155]">
                      {entry.stage?.stage_name || "N/A"}
                    </td>
                    <td className="py-3.5 px-5">
                      {entry.worker ? (
                        <div>
                          <p className="font-semibold text-[#0F172A]">{entry.worker.name}</p>
                          <p className="text-[11px] text-[#64748B]">{entry.worker.worker_id}</p>
                        </div>
                      ) : (
                        <span className="text-[#94A3B8]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-medium">
                      {entry.qty_in.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-[#16A34A]">
                      {entry.qty_out.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-right text-[#DC2626] font-medium">
                      {entry.wastage_qty.toLocaleString()}
                      {entry.wastage_qty > 0 && (
                        <span className="text-[11px] block font-normal">
                          ({(entry.wastage_percent * 100).toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-[#0F172A]">
                      ₹{entry.total_job_work_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <Link
                          href={`/production/stage-entries/${entry.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors"
                          title="View Detail"
                        >
                          <Eye size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredEntries.length > 0 && (
          <div className="bg-[#F8FAFC] border-t border-[#E5E7EB] px-5 py-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of{" "}
              {filteredEntries.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-[#E5E7EB] rounded-md text-xs font-semibold text-[#374151] hover:bg-white disabled:opacity-50 disabled:hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-7 h-7 rounded text-xs font-bold transition-colors cursor-pointer ${
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
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-[#E5E7EB] rounded-md text-xs font-semibold text-[#374151] hover:bg-white disabled:opacity-50 disabled:hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
