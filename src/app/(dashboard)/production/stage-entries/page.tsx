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
  TrendingUp,
  Trash2,
  Pencil,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Modal } from "@/components/shared/Modal";

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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<StageEntry | null>(null);

  // Fetch all stage entries from API
  const { data, isLoading, error } = useQuery<{ entries: StageEntry[] }>({
    queryKey: ["stage-entries", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/production/stage-entries?search=${encodeURIComponent(debouncedSearch)}`);
      if (!res.ok) throw new Error("Failed to fetch stage entries");
      return res.json();
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/production/stage-entries/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete stage entry");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Stage entry deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["stage-entries"] });
      queryClient.invalidateQueries({ queryKey: ["lot-detail"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete stage entry");
    },
  });

  const entries = data?.entries || [];

  // Filter entries based on search query
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
          <nav className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2 font-semibold uppercase tracking-wider">
            <Link href="/" className="hover:text-[var(--primary)] transition-colors">
              Production
            </Link>
            <ChevronRight size={12} className="text-[var(--text-faint)]" />
            <span className="text-[var(--text-secondary)]">Stage Entries</span>
          </nav>
          <h1 className="text-[28px] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
            Stage Entries
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push("/production/stage-entries/new")}
          className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white font-semibold text-sm px-4 h-10 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[var(--primary)]/10 self-start sm:self-center"
        >
          <Plus className="h-4 w-4 text-white" />
          Log Stage Entry
        </button>
      </div>

      {/* ── MOBILE: snap-scroll KPI cards ── */}
      <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
        {[
          { label: "Total Logs",    value: `${entries.length}`, icon: ClipboardList, bg: "bg-[var(--primary-light)]", color: "text-[var(--primary)]" },
          { label: "Processed",     value: `${totalProcessed.toLocaleString()} pcs`, icon: TrendingUp, bg: "bg-emerald-500/10", color: "text-emerald-600" },
          { label: "Wastage",       value: `${totalWastage.toLocaleString()} pcs`, icon: Clock, bg: "bg-red-500/10", color: "text-red-500" },
          { label: "Labor Cost",    value: `₹${totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: Calendar, bg: "bg-amber-500/10", color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="snap-start shrink-0 w-[152px] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)] flex items-center gap-2.5">
            <div className={cn("p-2 rounded-lg shrink-0", bg)}><Icon className={cn("h-4 w-4", color)} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">{label}</p>
              <p className={cn("text-xs font-black mt-0.5 truncate", color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── DESKTOP: KPI grid ── */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-[var(--primary-light)] rounded-lg text-[var(--primary)] shrink-0"><ClipboardList className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Logs</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{entries.length}</h3>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0"><TrendingUp className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Processed Qty</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{totalProcessed.toLocaleString()} pcs</h3>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-red-500/10 rounded-lg text-red-500 shrink-0"><Clock className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total Wastage</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{totalWastage.toLocaleString()} pcs</h3>
          </div>
        </div>
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500 shrink-0"><Calendar className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Labor Cost</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">₹{totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] h-4 w-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Entry #, Lot #, Stage, or Worker..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="pl-9 pr-4 h-10 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* ── MOBILE: Entry card list ── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)] font-medium">Loading stage entries...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500 font-medium">Failed to load stage entries.</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)] font-medium">No stage entries found.</div>
        ) : paginatedEntries.map((entry) => (
          <div key={entry.id}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden active:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
            onClick={() => router.push(`/production/stage-entries/${entry.id}`)}
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <span className="font-mono font-black text-[var(--primary)] text-sm">{entry.entry_number}</span>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Link href={`/production/stage-entries/${entry.id}`}
                  className="w-7 h-7 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                  title="View Detail"
                ><Eye size={13} /></Link>
                <Link href={`/production/stage-entries/${entry.id}/edit`}
                  className="w-7 h-7 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
                  title="Edit Entry"
                ><Pencil size={13} /></Link>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(entry)}
                  className="w-7 h-7 border border-[var(--border)] rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Delete Entry"
                ><Trash2 size={13} /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 px-4 pb-2">
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Lot</p>
                <Link href={`/production/lots/${entry.lot?.id}`} onClick={(e) => e.stopPropagation()}
                  className="text-xs font-bold text-[var(--primary)] hover:underline"
                >{entry.lot?.lot_number || "—"}</Link>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Stage</p>
                <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 truncate">{entry.stage?.stage_name || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Worker</p>
                <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 truncate">{entry.worker?.name || "Unassigned"}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 border-t border-[var(--border-light)] mx-4 py-2">
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">In</p>
                <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{entry.qty_in.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Out</p>
                <p className="text-xs font-bold mt-0.5 text-emerald-600">{entry.qty_out.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Wastage</p>
                <p className="text-xs font-bold mt-0.5 text-red-500">{entry.wastage_qty.toLocaleString()}{entry.wastage_qty > 0 && <span className="text-[10px] font-normal"> ({(entry.wastage_percent * 100).toFixed(1)}%)</span>}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Labor</p>
                <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">₹{entry.total_job_work_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 pb-3 border-t border-[var(--border-light)] pt-2">
              <span className="text-[11px] text-[var(--text-muted)]">
                {new Date(entry.entry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <span className={cn("ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                entry.payment_status === "paid" ? "bg-emerald-500/10 text-emerald-500" :
                entry.payment_status === "partial" ? "bg-amber-500/10 text-amber-500" :
                "bg-rose-500/10 text-rose-500"
              )}>{entry.payment_status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── DESKTOP: Table Section ── */}
      <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)] font-medium">
            Loading stage entries...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-red-500 font-medium">
            Failed to load stage entries.
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)] font-medium">
            No stage entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
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
              <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text-body)]">
                {paginatedEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => router.push(`/production/stage-entries/${entry.id}`)}
                    className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-5 font-bold font-mono text-[var(--text-primary)]">
                      {entry.entry_number}
                    </td>
                    <td className="py-3.5 px-5 text-[var(--text-muted)] font-mono text-xs">
                      {new Date(entry.entry_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-5 font-bold text-[var(--primary)] hover:underline">
                      <Link
                        href={`/production/lots/${entry.lot?.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.lot?.lot_number || "N/A"}
                      </Link>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-[var(--text-primary)]">
                      {entry.stage?.stage_name || "N/A"}
                    </td>
                    <td className="py-3.5 px-5">
                      {entry.worker ? (
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{entry.worker.name}</p>
                          <p className="text-[11px] font-mono text-[var(--text-faint)]">{entry.worker.worker_id}</p>
                        </div>
                      ) : (
                        <span className="text-[var(--text-faint)]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-semibold text-[var(--text-secondary)] font-mono">
                      {entry.qty_in.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-emerald-600 font-mono">
                      {entry.qty_out.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-5 text-right text-red-500 font-semibold font-mono">
                      {entry.wastage_qty.toLocaleString()}
                      {entry.wastage_qty > 0 && (
                        <span className="text-[11px] block font-normal">
                          ({(entry.wastage_percent * 100).toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-[var(--text-primary)] font-mono">
                      ₹{entry.total_job_work_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/production/stage-entries/${entry.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-colors"
                          title="View Detail"
                        >
                          <Eye size={15} />
                        </Link>
                        <Link
                          href={`/production/stage-entries/${entry.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-colors"
                          title="Edit Entry"
                        >
                          <Pencil size={15} />
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(entry);
                          }}
                          className="w-8 h-8 border border-[var(--border)] rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 size={15} />
                        </button>
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--card-bg)] text-xs text-[var(--text-muted)]">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of{" "}
              {filteredEntries.length} entries
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 rounded-md bg-[var(--primary)] text-white font-bold">
                {currentPage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--table-row-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title={`Delete Entry ${deleteTarget.entry_number}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-[var(--text-body)]">
              Are you sure you want to delete stage entry{" "}
              <strong className="text-[var(--text-primary)]">{deleteTarget.entry_number}</strong> for stage{" "}
              <strong>{deleteTarget.stage?.stage_name}</strong>?
            </p>
            <p className="text-[11px] text-[var(--text-faint)]">
              This will reconcile completed quantities and lot progress. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 h-9 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--table-row-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Entry"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
