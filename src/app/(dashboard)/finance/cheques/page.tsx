"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Landmark,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  XCircle,
  Calendar,
  Layers,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ChequeStatsBar } from "./_components/ChequeStatsBar";
import { ChequeDetailDrawer } from "./_components/ChequeDetailDrawer";
import { NewChequeModal } from "./_components/NewChequeModal";
import { ClearChequeDialog } from "./_components/ClearChequeDialog";
import { DepositChequeDialog } from "./_components/DepositChequeDialog";
import { BounceChequeDialog } from "./_components/BounceChequeDialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface BankAccount {
  id: string;
  name?: string;
  bank_name?: string;
  account_number?: string;
  type?: string;
  account_category?: string;
  current_balance?: number;
}

interface Cheque {
  id: string;
  cheque_number: string;
  direction: "received" | "issued";
  party_id: string | null;
  bank_name: string;
  account_no: string | null;
  cheque_date: string;
  due_date: string | null;
  amount: number;
  status: "pending" | "deposited" | "cleared" | "bounced" | "cancelled";
  settlement_type?: "on_account" | "bill_wise";
  allocations?: any[];
  received_account_id: string | null;
  deposited_date: string | null;
  cleared_date: string | null;
  bounce_reason: string | null;
  bounce_charges: number;
  remarks: string | null;
  created_at: string;
  party?: Party;
  received_account?: BankAccount;
}

export default function ChequesPage() {
  // Tabs & filters
  const [activeTab, setActiveTab] = useState<"received" | "issued">("received");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [maturityFilter, setMaturityFilter] = useState(""); // 'due_7_days' | 'due_today' | 'stale'
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Modals & Drawers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isBounceOpen, setIsBounceOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected Cheque
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);

  // React Query: Fetch dependencies (parties & bank accounts)
  const { data: partiesData } = useERPQuery(["parties"], async () => {
    const res = await fetch("/api/parties");
    if (!res.ok) throw new Error("Failed to load parties");
    return (await res.json()).parties || [];
  });

  const { data: banksData } = useERPQuery(["master-data", "banks-upi"], async () => {
    const res = await fetch("/api/master-data/banks-upi");
    if (!res.ok) throw new Error("Failed to load bank accounts");
    return (await res.json()).accounts || [];
  });

  const parties: Party[] = partiesData || [];
  const bankAccounts: BankAccount[] = banksData || [];

  // React Query: Fetch Cheques
  const chequesParams = new URLSearchParams();
  chequesParams.append("direction", activeTab);
  chequesParams.append("page", page.toString());
  chequesParams.append("limit", limit.toString());
  if (statusFilter) chequesParams.append("status", statusFilter);
  if (maturityFilter) chequesParams.append("maturity", maturityFilter);
  if (search) chequesParams.append("search", search);

  const chequesQuery = useERPQuery(
    ["cheques", activeTab, statusFilter, maturityFilter, search, page],
    async () => {
      const res = await fetch(`/api/finance/cheques?${chequesParams.toString()}`);
      if (!res.ok) throw new Error("Failed to load cheques");
      return await res.json();
    },
    { skeleton: "table" }
  );

  const cheques: Cheque[] = chequesQuery.data?.data || [];
  const meta = chequesQuery.data?.meta || { page: 1, limit: 10, total: 0 };
  const stats = chequesQuery.data?.stats || {
    pendingValue: 0,
    pendingCount: 0,
    clearedValue: 0,
    clearedCount: 0,
    bouncedValue: 0,
    bouncedCount: 0,
    dueThisWeekValue: 0,
    dueThisWeekCount: 0,
    staleCount: 0,
  };

  // Mutations
  const createMutation = useERPMutation(
    async (newCheque: any) => {
      const res = await fetch("/api/finance/cheques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCheque),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record cheque");
      }
      return await res.json();
    },
    {
      successMessage: "Cheque recorded successfully!",
      invalidates: [["cheques"]],
      onSuccess: () => setIsAddOpen(false),
    }
  );

  const updateMutation = useERPMutation(
    async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/finance/cheques/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update cheque");
      }
      return await res.json();
    },
    {
      successMessage: "Cheque updated successfully",
      invalidates: [["cheques"], ["master-data", "banks-upi"], ["parties"]],
      onSuccess: () => {
        setIsDepositOpen(false);
        setIsClearOpen(false);
        setIsBounceOpen(false);
        setIsCancelOpen(false);
      },
    }
  );

  const deleteMutation = useERPMutation(
    async (id: string) => {
      const res = await fetch(`/api/finance/cheques/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete cheque");
      }
      return await res.json();
    },
    {
      successMessage: "Cheque record deleted",
      invalidates: [["cheques"]],
      onSuccess: () => setIsDeleteOpen(false),
    }
  );

  // Handlers
  const handleOpenAdd = () => {
    setIsAddOpen(true);
  };

  const handleOpenDetail = (c: Cheque) => {
    setSelectedCheque(c);
    setIsDetailOpen(true);
  };

  const handleOpenDeposit = (c: Cheque) => {
    setSelectedCheque(c);
    setIsDepositOpen(true);
  };

  const handleOpenClear = (c: Cheque) => {
    setSelectedCheque(c);
    setIsClearOpen(true);
  };

  const handleOpenBounce = (c: Cheque) => {
    setSelectedCheque(c);
    setIsBounceOpen(true);
  };

  const handleOpenCancel = (c: Cheque) => {
    setSelectedCheque(c);
    setIsCancelOpen(true);
  };

  const handleOpenDelete = (c: Cheque) => {
    setSelectedCheque(c);
    setIsDeleteOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedCheque) return;
    updateMutation.mutate({
      id: selectedCheque.id,
      data: { status: "cancelled" },
    });
  };

  const handleDeleteCheque = async () => {
    if (!selectedCheque) return;
    deleteMutation.mutate(selectedCheque.id);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Cheques & PDC Manager
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            Reconcile post-dated cheques, track bank deposits, clear items, and manage bounce incidents
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-[var(--shadow-sm)] transition-all active:scale-95 cursor-pointer"
        >
          <Plus size={16} />
          <span>Record Cheque Entry</span>
        </button>
      </div>

      {/* Tabs: Received vs Issued */}
      <div className="flex border-b border-[var(--border)] select-none">
        <button
          onClick={() => {
            setActiveTab("received");
            setStatusFilter("");
            setMaturityFilter("");
            setPage(1);
          }}
          className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "received"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <ArrowDownLeft size={16} className={activeTab === "received" ? "text-[var(--primary)]" : "text-[var(--text-faint)]"} />
          <span>Received (From Customers)</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("issued");
            setStatusFilter("");
            setMaturityFilter("");
            setPage(1);
          }}
          className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "issued"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <ArrowUpRight size={16} className={activeTab === "issued" ? "text-[var(--primary)]" : "text-[var(--text-faint)]"} />
          <span>Issued (To Suppliers & Workers)</span>
        </button>
      </div>

      {/* Stats Bar */}
      <ChequeStatsBar
        pendingValue={stats.pendingValue}
        pendingCount={stats.pendingCount}
        clearedValue={stats.clearedValue}
        clearedCount={stats.clearedCount}
        bouncedValue={stats.bouncedValue}
        bouncedCount={stats.bouncedCount}
        dueThisWeekValue={stats.dueThisWeekValue}
        dueThisWeekCount={stats.dueThisWeekCount}
        staleCount={stats.staleCount}
        onFilterMaturity={(m) => {
          setMaturityFilter(m);
          setPage(1);
        }}
        activeMaturity={maturityFilter}
      />

      {/* Filters Bar */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] p-3.5 sm:p-4 shadow-[var(--shadow-sm)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-faint)]" />
            <input
              type="text"
              placeholder="Search cheque no, bank, party..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-xl pl-9 pr-3 h-9 text-xs transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-40 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-xl px-3 h-9 text-xs transition-colors cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending (In Hand)</option>
            <option value="deposited">Deposited in Bank</option>
            <option value="cleared">Cleared</option>
            <option value="bounced">Bounced</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Maturity Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto select-none py-1">
          <button
            onClick={() => {
              setMaturityFilter("");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !maturityFilter
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            All Dates
          </button>
          <button
            onClick={() => {
              setMaturityFilter("due_today");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              maturityFilter === "due_today"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Due Today
          </button>
          <button
            onClick={() => {
              setMaturityFilter("due_7_days");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              maturityFilter === "due_7_days"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            Due In 7 Days
          </button>
          <button
            onClick={() => {
              setMaturityFilter("stale");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              maturityFilter === "stale"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-[var(--page-bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500"
            }`}
          >
            Stale (&gt;60 Days)
          </button>
        </div>
      </div>

      {/* Cheques Table */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden">
        {chequesQuery.isPending ? (
          chequesQuery.Skeleton
        ) : cheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)] gap-2">
            <Landmark className="h-8 w-8 text-[var(--text-faint)]" />
            <span className="text-sm font-semibold">No cheque records found matching the criteria.</span>
            <button
              onClick={handleOpenAdd}
              className="mt-2 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
            >
              + Record your first cheque entry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] font-bold text-[var(--text-muted)]">
                  <th className="p-3.5">Cheque Date</th>
                  <th className="p-3.5">Cheque No. & Settlement</th>
                  <th className="p-3.5">Drawee Bank</th>
                  <th className="p-3.5">Party</th>
                  <th className="p-3.5 text-right">Amount (₹)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Company Bank A/C</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {cheques.map((c) => {
                  const isBillWise = c.settlement_type === "bill_wise";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => handleOpenDetail(c)}
                      className="hover:bg-[var(--table-row-hover)] transition-colors cursor-pointer"
                    >
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--text-primary)]">
                            {formatDate(c.cheque_date)}
                          </span>
                          {c.due_date && c.due_date !== c.cheque_date && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                              Due: {formatDate(c.due_date)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-mono font-bold text-[var(--text-primary)] text-sm tracking-wide">
                            {c.cheque_number}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                              isBillWise
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                            }`}
                          >
                            {isBillWise ? "Bill-Wise" : "On-Account"}
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--text-primary)]">{c.bank_name}</span>
                          {c.account_no && (
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              A/C: {c.account_no}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 font-semibold text-[var(--text-primary)]">
                        {c.party?.company_name || c.party?.name || "—"}
                      </td>

                      <td className="p-3.5 text-right font-bold text-[var(--text-primary)] font-mono text-sm">
                        {formatCurrency(c.amount)}
                      </td>

                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            c.status === "cleared"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
                              : c.status === "deposited"
                              ? "bg-sky-500/10 text-sky-500 border border-sky-500/30"
                              : c.status === "bounced"
                              ? "bg-red-500/10 text-red-500 border border-red-500/30"
                              : c.status === "cancelled"
                              ? "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-[var(--text-secondary)] font-semibold">
                        {c.received_account?.name || c.received_account?.bank_name || "—"}
                      </td>

                      <td
                        className="p-3.5 text-right"
                        onClick={(e) => e.stopPropagation()} // Prevent row click
                      >
                        <div className="flex justify-end items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(c)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--table-row-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                            title="View Cheque Leaf & History"
                          >
                            <Eye size={13} />
                          </button>

                          {c.status === "pending" && (
                            <button
                              onClick={() => handleOpenDeposit(c)}
                              className="px-2.5 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 font-bold rounded-lg transition-all cursor-pointer"
                            >
                              Deposit
                            </button>
                          )}

                          {(c.status === "pending" || c.status === "deposited") && (
                            <>
                              <button
                                onClick={() => handleOpenClear(c)}
                                className="px-2.5 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold rounded-lg transition-all cursor-pointer"
                              >
                                Clear
                              </button>
                              <button
                                onClick={() => handleOpenBounce(c)}
                                className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold rounded-lg transition-all cursor-pointer"
                              >
                                Bounce
                              </button>
                            </>
                          )}

                          {c.status === "cleared" && (
                            <button
                              onClick={() => handleOpenBounce(c)}
                              className="px-2 py-1 text-[11px] border border-red-500/30 hover:bg-red-500/10 text-red-500 font-bold rounded-lg transition-all cursor-pointer"
                              title="Mark as returned/bounced after clearance"
                            >
                              Bounce
                            </button>
                          )}

                          {c.status === "pending" && (
                            <button
                              onClick={() => handleOpenCancel(c)}
                              className="px-2 py-1 text-xs border border-[var(--border)] hover:bg-[var(--table-row-hover)] font-bold text-[var(--text-muted)] rounded-lg transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}

                          {(c.status === "cancelled" || c.status === "bounced") && (
                            <button
                              onClick={() => handleOpenDelete(c)}
                              className="w-7 h-7 border border-red-500/30 hover:bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                              title="Delete Cheque"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.total > meta.limit && (
          <div className="flex items-center justify-between px-6 py-4 bg-[var(--card-bg)] border-t border-[var(--border)] text-xs font-semibold text-[var(--text-muted)]">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, meta.total)} of {meta.total} records
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * limit >= meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Dialogs */}
      <NewChequeModal
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        defaultDirection={activeTab}
        parties={parties}
        bankAccounts={bankAccounts}
        onSave={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      <ChequeDetailDrawer
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        cheque={selectedCheque}
        onDeposit={handleOpenDeposit}
        onClear={handleOpenClear}
        onBounce={handleOpenBounce}
        onCancel={handleOpenCancel}
        onDelete={handleOpenDelete}
      />

      <ClearChequeDialog
        open={isClearOpen}
        onOpenChange={setIsClearOpen}
        cheque={selectedCheque}
        bankAccounts={bankAccounts}
        onConfirm={async (data) => {
          if (!selectedCheque) return;
          await updateMutation.mutateAsync({
            id: selectedCheque.id,
            data: { status: "cleared", ...data },
          });
        }}
      />

      <DepositChequeDialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        cheque={selectedCheque}
        bankAccounts={bankAccounts}
        onDeposit={async (data) => {
          if (!selectedCheque) return;
          await updateMutation.mutateAsync({
            id: selectedCheque.id,
            data: { status: "deposited", ...data },
          });
        }}
      />

      <BounceChequeDialog
        open={isBounceOpen}
        onOpenChange={setIsBounceOpen}
        cheque={selectedCheque}
        onBounce={async (data) => {
          if (!selectedCheque) return;
          await updateMutation.mutateAsync({
            id: selectedCheque.id,
            data: { status: "bounced", ...data },
          });
        }}
      />

      <ConfirmDialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        title="Cancel Cheque"
        description={`Are you sure you want to cancel Cheque #${selectedCheque?.cheque_number}?`}
        onConfirm={handleConfirmCancel}
        confirmText="Cancel Cheque"
        cancelText="Close"
      />

      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Cheque Record"
        description={`Are you sure you want to permanently delete cheque #${selectedCheque?.cheque_number}? This cannot be undone.`}
        onConfirm={handleDeleteCheque}
        confirmText="Delete Permanently"
        cancelText="Close"
      />
    </div>
  );
}
