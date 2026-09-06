"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Calendar, FileText, ArrowUpRight, ArrowDownLeft, Landmark, CheckCircle2, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { ChequeStatsBar } from "./_components/ChequeStatsBar";
import { formatCurrency } from "@/lib/utils";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
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

import { useERPQuery, useERPMutation } from "@/hooks/useERPQuery";

export default function ChequesPage() {
  // Tabs & filters
  const [activeTab, setActiveTab] = useState<"received" | "issued">("received");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isBounceOpen, setIsBounceOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  // Selected states
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);

  // Form states: New Cheque
  const [chequeNumber, setChequeNumber] = useState("");
  const [direction, setDirection] = useState<"received" | "issued">("received");
  const [partyId, setPartyId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [receivedAccountId, setReceivedAccountId] = useState("");
  const [remarks, setRemarks] = useState("");

  // Form states: Deposit
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);

  // Form states: Bounce
  const [bounceReason, setBounceReason] = useState("");
  const [bounceCharges, setBounceCharges] = useState<number | "">("");

  // React Query: Fetch dependencies
  const { data: partiesData } = useERPQuery(["parties"], async () => {
    const res = await fetch("/api/parties");
    if (!res.ok) throw new Error("Failed to load parties");
    return (await res.json()).parties || [];
  });

  const { data: banksData } = useERPQuery(["banks-upi"], async () => {
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
  if (search) chequesParams.append("search", search);

  const chequesQuery = useERPQuery(
    ["cheques", activeTab, statusFilter, search, page],
    async () => {
      const res = await fetch(`/api/finance/cheques?${chequesParams.toString()}`);
      if (!res.ok) throw new Error("Failed to load cheques");
      return await res.json();
    },
    { skeleton: "table" }
  );

  const cheques: Cheque[] = chequesQuery.data?.data || [];
  const meta = chequesQuery.data?.meta || { page: 1, limit: 10, total: 0 };
  const stats = chequesQuery.data?.stats || { pendingValue: 0, clearedValue: 0, bouncedValue: 0 };

  const pendingValue = stats.pendingValue;
  const clearedValue = stats.clearedValue;
  const bouncedValue = stats.bouncedValue;

  // React Query: Mutations
  const createMutation = useERPMutation(
    async (newCheque: any) => {
      const res = await fetch("/api/finance/cheques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCheque),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save cheque");
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
      invalidates: [["cheques"]],
      onSuccess: () => {
        setIsDepositOpen(false);
        setIsBounceOpen(false);
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

  const handleOpenAdd = () => {
    setChequeNumber("");
    setDirection(activeTab);
    setPartyId("");
    setBankName("");
    setAccountNo("");
    setChequeDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setAmount("");
    setReceivedAccountId("");
    setRemarks("");
    setIsAddOpen(true);
  };

  const handleCreateCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chequeNumber) {
      toast.error("Please enter a cheque number");
      return;
    }
    if (!bankName) {
      toast.error("Please enter bank name");
      return;
    }
    if (!chequeDate) {
      toast.error("Please enter cheque date");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    createMutation.mutate({
      cheque_number: chequeNumber,
      direction,
      party_id: partyId || null,
      bank_name: bankName,
      account_no: accountNo,
      cheque_date: chequeDate,
      due_date: dueDate || null,
      amount: Number(amount),
      received_account_id: receivedAccountId || null,
      remarks,
    });
  };

  const handleOpenDeposit = (c: Cheque) => {
    setSelectedCheque(c);
    setReceivedAccountId("");
    setDepositDate(new Date().toISOString().split("T")[0]);
    setIsDepositOpen(true);
  };

  const handleDepositCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;
    if (!receivedAccountId) {
      toast.error("Please select a target bank account");
      return;
    }

    updateMutation.mutate({
      id: selectedCheque.id,
      data: {
        status: "deposited",
        received_account_id: receivedAccountId,
        deposited_date: depositDate,
      },
    });
  };

  const handleClearCheque = async (c: Cheque) => {
    if (c.direction === "received" && !c.received_account_id) {
      handleOpenDeposit(c);
      return;
    }
    setSelectedCheque(c);
    setIsClearOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!selectedCheque) return;
    updateMutation.mutate({
      id: selectedCheque.id,
      data: { status: "cleared" },
    });
    setIsClearOpen(false);
  };

  const handleOpenBounce = (c: Cheque) => {
    setSelectedCheque(c);
    setBounceReason("");
    setBounceCharges("");
    setIsBounceOpen(true);
  };

  const handleBounceCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCheque) return;

    updateMutation.mutate({
      id: selectedCheque.id,
      data: {
        status: "bounced",
        bounce_reason: bounceReason,
        bounce_charges: Number(bounceCharges || 0),
      },
    });
  };

  const handleCancelCheque = async (c: Cheque) => {
    setSelectedCheque(c);
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedCheque) return;
    updateMutation.mutate({
      id: selectedCheque.id,
      data: { status: "cancelled" },
    });
    setIsCancelOpen(false);
  };

  const handleOpenDelete = (c: Cheque) => {
    setSelectedCheque(c);
    setIsDeleteOpen(true);
  };

  const handleDeleteCheque = async () => {
    if (!selectedCheque) return;
    deleteMutation.mutate(selectedCheque.id);
  };

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Cheques & PDC Manager</h1>
          <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            Reconcile post-dated cheques, track bank deposits, clear items, and manage bounce incidents
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-[var(--shadow-sm)] transition-all active:scale-95 cursor-pointer"
        >
          <Plus size={16} />
          <span>Record Cheque Entry</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] select-none">
        <button
          onClick={() => {
            setActiveTab("received");
            setStatusFilter("");
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
          }}
          className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "issued"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <ArrowUpRight size={16} className={activeTab === "issued" ? "text-[var(--primary)]" : "text-[var(--text-faint)]"} />
          <span>Issued (To Suppliers)</span>
        </button>
      </div>

      {/* Stats */}
      <ChequeStatsBar
        pendingValue={pendingValue}
        clearedValue={clearedValue}
        bouncedValue={bouncedValue}
      />

      {/* Filters */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] p-4 shadow-[var(--shadow-sm)] flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search cheque no, bank, party..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg pl-10 pr-3 h-10 text-sm transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-44 bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="deposited">Deposited</option>
          <option value="cleared">Cleared</option>
          <option value="bounced">Bounced</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Cheques Table */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden">
        {chequesQuery.isPending ? (
          chequesQuery.Skeleton
        ) : cheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)] gap-2">
            <Landmark className="h-8 w-8 text-[var(--text-faint)]" />
            <span className="text-sm font-semibold">No cheque records found matching the filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] font-bold text-[var(--text-muted)]">
                  <th className="p-4">Cheque Date</th>
                  <th className="p-4">Cheque Number</th>
                  <th className="p-4">Bank Name</th>
                  <th className="p-4">Party</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Settlement Bank</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-light)]">
                {cheques.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="p-4 font-semibold text-[var(--text-secondary)]">{c.cheque_date}</td>
                    <td className="p-4 font-bold text-[var(--text-primary)] font-mono">{c.cheque_number}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--text-primary)]">{c.bank_name}</span>
                        {c.account_no && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">A/C: {c.account_no}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-[var(--text-primary)]">{c.party?.name || "—"}</td>
                    <td className="p-4 text-right font-bold text-[var(--text-primary)] font-mono">
                      {formatCurrency(c.amount)}
                    </td>
                    <td className="p-4 text-center">
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
                    <td className="p-4 text-center text-[var(--text-muted)] font-semibold">
                      {c.received_account?.bank_name || "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        {c.status === "pending" && c.direction === "received" && (
                          <button
                            onClick={() => handleOpenDeposit(c)}
                            className="px-2.5 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/30 font-bold rounded-lg transition-all"
                          >
                            Deposit
                          </button>
                        )}
                        {(c.status === "pending" || c.status === "deposited") && (
                          <>
                            <button
                              onClick={() => handleClearCheque(c)}
                              className="px-2.5 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 font-bold rounded-lg transition-all"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => handleOpenBounce(c)}
                              className="px-2.5 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold rounded-lg transition-all"
                            >
                              Bounce
                            </button>
                          </>
                        )}
                        {c.status === "pending" && (
                          <button
                            onClick={() => handleCancelCheque(c)}
                            className="px-2.5 py-1 text-xs border border-[var(--border)] hover:bg-[var(--table-row-hover)] font-bold text-[var(--text-muted)] rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                        )}
                        {(c.status === "cancelled" || c.status === "bounced") && (
                          <button
                            onClick={() => handleOpenDelete(c)}
                            className="w-7 h-7 border border-red-500/30 hover:bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center cursor-pointer transition-all self-center"
                            title="Delete Cheque"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination Controls */}
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

      {/* Add Modal */}
      <Modal open={isAddOpen} onOpenChange={setIsAddOpen} title="Record Cheque Transaction" maxWidth="max-w-md">
        <form onSubmit={handleCreateCheque} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Direction *</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors cursor-pointer"
              >
                <option value="received">Received (From Customer)</option>
                <option value="issued">Issued (To Supplier)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Party / Contact</label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors cursor-pointer"
              >
                <option value="">Select Contact</option>
                {parties
                  .filter((p) => {
                    if (direction === "received") return p.type.includes("customer");
                    return p.type.includes("supplier");
                  })
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.company_name ? `(${p.company_name})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Cheque Number *</label>
              <input
                type="text"
                required
                placeholder="6 digit micr no"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Cheque Date *</label>
              <input
                type="date"
                required
                value={chequeDate}
                onChange={(e) => setChequeDate(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Cheque Bank Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Cheque Account No</label>
              <input
                type="text"
                placeholder="e.g. 50100982348"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">PDC Release/Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Remarks / Description</label>
            <input
              type="text"
              placeholder="PDC against bill number or other references"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 h-9 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Record Cheque</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Deposit Modal */}
      <Modal open={isDepositOpen} onOpenChange={setIsDepositOpen} title="Deposit Cheque to Bank" maxWidth="max-w-sm">
        <form onSubmit={handleDepositCheque} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Settlement Bank Account *</label>
            <select
              value={receivedAccountId}
              required
              onChange={(e) => setReceivedAccountId(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors cursor-pointer"
            >
              <option value="">Select Account</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} ({b.account_number})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Deposit Date *</label>
            <input
              type="date"
              required
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsDepositOpen(false)}
              className="px-4 h-9 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Deposit Cheque</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Bounce Modal */}
      <Modal open={isBounceOpen} onOpenChange={setIsBounceOpen} title="Record Bounced Cheque" maxWidth="max-w-sm">
        <form onSubmit={handleBounceCheque} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Reason for Bounce *</label>
            <input
              type="text"
              required
              placeholder="e.g. Insufficient Funds or Signature Mismatch"
              value={bounceReason}
              onChange={(e) => setBounceReason(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Bounce Penalty Charges (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={bounceCharges}
              onChange={(e) => setBounceCharges(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors font-mono"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setIsBounceOpen(false)}
              className="px-4 h-9 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Record Bounce</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Cheque Record"
        description={`Are you sure you want to delete cheque booking #${selectedCheque?.cheque_number}? This action cannot be undone.`}
        onConfirm={handleDeleteCheque}
        confirmText="Delete Permanently"
        cancelText="Cancel"
      />

      <ConfirmDialog
        open={isClearOpen}
        onOpenChange={setIsClearOpen}
        title="Clear Cheque"
        description={`Mark Cheque #${selectedCheque?.cheque_number} as Cleared? This will reconcile financial balances.`}
        onConfirm={handleConfirmClear}
        confirmText="Clear Cheque"
        cancelText="Cancel"
      />

      <ConfirmDialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        title="Cancel Cheque"
        description={`Are you sure you want to cancel Cheque #${selectedCheque?.cheque_number}?`}
        onConfirm={handleConfirmCancel}
        confirmText="Cancel Cheque"
        cancelText="Cancel"
      />
    </div>
  );
}
