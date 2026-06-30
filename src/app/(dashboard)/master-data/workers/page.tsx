"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Scissors,
  UserCheck,
  UserX,
  Download,
  Plus,
  Eye,
  MoreVertical,
  Edit,
  Trash2,
  Lock,
  Unlock,
  ChevronRight,
  Search,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WorkerAvatar from "@/components/shared/WorkerAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Worker {
  id: string;
  name: string;
  worker_id: string;
  type: "job_worker" | "permanent";
  phone: string | null;
  email: string | null;
  specialization: string | null;
  default_rate: number;
  is_active: boolean;
  bank_name: string | null;
  account_number: string | null;
}

export default function WorkersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filters state
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Fetch Workers Query
  const { data: workersData, isLoading, refetch } = useQuery<{ workers: Worker[] }>({
    queryKey: ["workers", typeFilter, statusFilter, search],
    queryFn: async () => {
      const typeParam = typeFilter !== "all" ? `&type=${typeFilter}` : "";
      const activeParam = statusFilter !== "all" ? `&active=${statusFilter === "active"}` : "";
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/workers?${typeParam}${activeParam}${searchParam}`);
      if (!res.ok) throw new Error("Failed to fetch workers");
      return res.json();
    },
  });

  const workers = workersData?.workers || [];

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/workers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workers.find((w) => w.id === id)?.name || "",
          type: workers.find((w) => w.id === id)?.type || "job_worker",
          is_active,
        }),
      });
      if (!res.ok) throw new Error("Failed to update worker status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker status updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  // Calculate statistics from the full worker list (or fetched stats)
  // To ensure UI stats are accurate, let's derive them
  const totalWorkersCount = workers.length;
  const jobWorkersCount = workers.filter((w) => w.type === "job_worker" && w.is_active).length;
  const permanentWorkersCount = workers.filter((w) => w.type === "permanent" && w.is_active).length;
  const inactiveWorkersCount = workers.filter((w) => !w.is_active).length;

  // Pagination logic
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedWorkers = workers.slice(startIndex, startIndex + pageSize);
  const totalPages = Math.ceil(workers.length / pageSize) || 1;

  // Clear filters
  const handleClearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("active");
    setSearch("");
    setCurrentPage(1);
  };

  // Export CSV
  const handleExport = () => {
    if (workers.length === 0) {
      toast.error("No workers to export");
      return;
    }
    const headers = ["Worker ID", "Name", "Type", "Phone", "Specialization", "Rate (Per Pc)", "Status", "Bank Account"];
    const rows = workers.map((w) => [
      w.worker_id,
      w.name,
      w.type === "job_worker" ? "Job Worker" : "Permanent",
      w.phone || "",
      w.specialization || "",
      w.type === "job_worker" ? `INR ${w.default_rate}` : "—",
      w.is_active ? "Active" : "Inactive",
      w.bank_name && w.account_number ? `${w.bank_name} - ${w.account_number}` : "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `workers_export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Workers list exported successfully");
  };

  return (
    <div className="p-6 space-y-6 select-none">
      {/* Header and Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-[#64748B] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[#6366F1] transition-colors">
              Master Data
            </Link>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Workers</span>
            <ChevronRight size={12} className="text-[#94A3B8]" />
            <span className="text-[#374151]">Workers List</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
            Workers List
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
            onClick={() => router.push("/master-data/workers/new")}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10"
          >
            <Plus className="h-4 w-4 text-white" />
            Add Worker
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] h-4 w-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Name, Phone, Worker ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-4 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent transition-all"
            />
          </div>

          {/* Type dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-[200px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="all">All Types</option>
            <option value="job_worker">Job Worker</option>
            <option value="permanent">Permanent</option>
          </select>

          {/* Status dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-[200px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Clear Filters Link */}
        {(typeFilter !== "all" || statusFilter !== "active" || search) && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-[#6366F1] font-semibold hover:underline self-end sm:self-center shrink-0 cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Workers */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#EEF2FF] rounded-lg text-[#6366F1] shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Workers</span>
            <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{totalWorkersCount}</p>
            <span className="text-[10px] text-[#64748B] font-medium block mt-0.5">All Types</span>
          </div>
        </div>

        {/* Job Workers */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F0FDF4] rounded-lg text-[#16A34A] shrink-0">
            <Scissors className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Job Workers</span>
            <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{jobWorkersCount}</p>
            <span className="text-[10px] text-[#15803D] font-medium block mt-0.5">Active</span>
          </div>
        </div>

        {/* Permanent Workers */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FFF7ED] rounded-lg text-[#EA580C] shrink-0">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Permanent Workers</span>
            <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{permanentWorkersCount}</p>
            <span className="text-[10px] text-[#EA580C] font-medium block mt-0.5">Active</span>
          </div>
        </div>

        {/* Inactive Workers */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEF2F2] rounded-lg text-[#DC2626] shrink-0">
            <UserX className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Inactive Workers</span>
            <p className="text-2xl font-bold text-[#0F172A] mt-0.5">{inactiveWorkersCount}</p>
            <span className="text-[10px] text-[#DC2626] font-medium block mt-0.5">Inactive</span>
          </div>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
        {/* Table Title and Pagination controls */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <span className="text-sm font-semibold text-[#374151]">Workers</span>
          <div className="flex items-center gap-4 text-xs text-[#64748B]">
            <span>
              Showing {workers.length === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(startIndex + pageSize, workers.length)} of {workers.length} workers
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

        {/* Raw HTML Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-bold text-[#64748B] uppercase tracking-wider">
                <th className="py-3 px-5 w-10">#</th>
                <th className="py-3 px-5 w-28">Worker ID</th>
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Phone</th>
                <th className="py-3 px-5 text-right">Rate (Per Pc)</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5">Bank Account</th>
                <th className="py-3 px-5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#64748B]">
                    Loading workers...
                  </td>
                </tr>
              ) : paginatedWorkers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#64748B]">
                    No workers found.
                  </td>
                </tr>
              ) : (
                paginatedWorkers.map((worker, index) => {
                  const bankAccStr =
                    worker.bank_name && worker.account_number
                      ? `${worker.bank_name} - ${worker.account_number}`
                      : "—";

                  return (
                    <tr key={worker.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3.5 px-5 text-[#64748B] font-medium">
                        {startIndex + index + 1}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs font-bold text-[#374151]">
                        {worker.worker_id}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <WorkerAvatar name={worker.name} size="sm" />
                          <span className="font-semibold text-[#0F172A]">{worker.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 capitalize text-[#374151]">
                        {worker.type.replace("_", " ")}
                      </td>
                      <td className="py-3.5 px-5 text-[#374151]">
                        {worker.phone || "—"}
                      </td>
                      <td className="py-3.5 px-5 text-right font-medium text-[#374151]">
                        {worker.type === "job_worker" ? (
                          `₹${parseFloat(worker.default_rate as any || 0).toFixed(2)}`
                        ) : (
                          <span className="text-[#94A3B8] font-normal">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider select-none ${
                            worker.is_active
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : "bg-[#FEE2E2] text-[#DC2626]"
                          }`}
                        >
                          {worker.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-[#374151]">
                        <span className="truncate max-w-[150px] block" title={bankAccStr}>
                          {bankAccStr}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/master-data/workers/${worker.id}`}
                            className="w-8 h-8 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#6366F1] hover:bg-[#F9FAFB] transition-colors"
                            title="View Profile"
                          >
                            <Eye size={16} />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-8 h-8 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F9FAFB] transition-colors cursor-pointer">
                              <MoreVertical size={16} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[140px]">
                              <DropdownMenuItem
                                onClick={() => router.push(`/master-data/workers/${worker.id}/edit`)}
                              >
                                <Edit size={14} className="mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleActiveMutation.mutate({
                                    id: worker.id,
                                    is_active: !worker.is_active,
                                  })
                                }
                              >
                                {worker.is_active ? (
                                  <>
                                    <Lock size={14} className="mr-2 text-red-500" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Unlock size={14} className="mr-2 text-green-500" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/production/job-work/ledger/${worker.id}`)}
                              >
                                <BookOpen size={14} className="mr-2" />
                                View Ledger
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

        {/* Footer / Pagination */}
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
