"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Calendar, FileText, ArrowUpRight, ArrowDownLeft, Landmark, CheckCircle2, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

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

    const confirmClear = window.confirm(`Mark Cheque #${c.cheque_number} as Cleared? This will reconcile financial balances.`);
    if (!confirmClear) return;

    updateMutation.mutate({
      id: c.id,
      data: { status: "cleared" },
    });
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
    const confirmCancel = window.confirm(`Mark Cheque #${c.cheque_number} as Cancelled?`);
    if (!confirmCancel) return;

    updateMutation.mutate({
      id: c.id,
      data: { status: "cancelled" },
    });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cheques & PDC Manager</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Reconcile post-dated cheques, track bank deposits, clear items, and manage bounce incidents
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center gap-2">
          <Plus size={16} />
          <span>Record Cheque Entry</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] select-none">
        <button
          onClick={() => {
            setActiveTab("received");
            setStatusFilter("");
          }}
          className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "received"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#374151]"
          }`}
        >
          <ArrowDownLeft size={16} className={activeTab === "received" ? "text-[#6366F1]" : "text-slate-400"} />
          <span>Received (From Customers)</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("issued");
            setStatusFilter("");
          }}
          className={`px-5 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "issued"
              ? "border-[#6366F1] text-[#6366F1]"
              : "border-transparent text-[#64748B] hover:text-[#374151]"
          }`}
        >
          <ArrowUpRight size={16} className={activeTab === "issued" ? "text-[#6366F1]" : "text-slate-400"} />
          <span>Issued (To Suppliers)</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEF3C7] text-[#D97706] rounded-lg">
            <Landmark className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Outstanding PDC / Pending</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{pendingValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#DCFCE7] text-[#16A34A] rounded-lg">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Value Cleared</span>
            <span className="text-xl font-bold text-slate-800">
              ₹{clearedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FEE2E2] text-[#DC2626] rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Value Bounced</span>
            <span className="text-xl font-bold text-[#DC2626]">
              ₹{bouncedValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search cheque no, bank, party..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-44 h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
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
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {chequesQuery.isPending ? (
          chequesQuery.Skeleton
        ) : cheques.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
            <Landmark className="h-8 w-8 text-slate-300" />
            <span className="text-sm font-semibold">No cheque records found matching the filters.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-slate-50 font-bold text-slate-600">
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
              <tbody className="divide-y divide-[#F3F4F6]">
                {cheques.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-700">{c.cheque_date}</td>
                    <td className="p-4 font-bold text-slate-700 font-mono">{c.cheque_number}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{c.bank_name}</span>
                        {c.account_no && (
                          <span className="text-[10px] text-slate-400 font-mono">A/C: {c.account_no}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-slate-800">{c.party?.name || "—"}</td>
                    <td className="p-4 text-right font-bold text-slate-800">
                      ₹{c.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === "cleared"
                            ? "bg-[#DCFCE7] text-[#15803D]"
                            : c.status === "deposited"
                            ? "bg-[#E0F2FE] text-[#0369A1]"
                            : c.status === "bounced"
                            ? "bg-[#FEE2E2] text-[#DC2626]"
                            : c.status === "cancelled"
                            ? "bg-slate-100 text-slate-500"
                            : "bg-[#FEF3C7] text-[#D97706]"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-600 font-semibold">
                      {c.received_account?.bank_name || "—"}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        {c.status === "pending" && c.direction === "received" && (
                          <Button
                            size="xs"
                            onClick={() => handleOpenDeposit(c)}
                            className="bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BFDBFE] font-bold"
                          >
                            Deposit
                          </Button>
                        )}
                        {(c.status === "pending" || c.status === "deposited") && (
                          <>
                            <Button
                              size="xs"
                              onClick={() => handleClearCheque(c)}
                              className="bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#16A34A] border border-[#BBF7D0] font-bold"
                            >
                              Clear
                            </Button>
                            <Button
                              size="xs"
                              onClick={() => handleOpenBounce(c)}
                              className="bg-[#FEE2E2] hover:bg-[#FCD3D3] text-[#DC2626] border border-[#FCA5A5] font-bold"
                            >
                              Bounce
                            </Button>
                          </>
                        )}
                        {c.status === "pending" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleCancelCheque(c)}
                            className="font-bold text-slate-600"
                          >
                            Cancel
                          </Button>
                        )}
                        {(c.status === "cancelled" || c.status === "bounced") && (
                          <button
                            onClick={() => handleOpenDelete(c)}
                            className="w-7 h-7 border border-[#FEE2E2] hover:bg-[#FEF2F2] text-[#DC2626] rounded-lg flex items-center justify-center cursor-pointer transition-all self-center"
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
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-[#E5E7EB] text-xs font-semibold text-slate-500">
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
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Record Cheque Transaction</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCheque} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Direction *</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as any)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
                >
                  <option value="received">Received (From Customer)</option>
                  <option value="issued">Issued (To Supplier)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Party / Contact</label>
                <select
                  value={partyId}
                  onChange={(e) => setPartyId(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cheque Number *</label>
                <input
                  type="text"
                  required
                  placeholder="6 digit micr no"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cheque Date *</label>
                <input
                  type="date"
                  required
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cheque Bank Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cheque Account No</label>
                <input
                  type="text"
                  placeholder="e.g. 50100982348"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">PDC Release/Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Remarks / Description</label>
              <input
                type="text"
                placeholder="PDC against bill number or other references"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Record Cheque</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Deposit Cheque to Bank</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleDepositCheque} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Settlement Bank Account *</label>
              <select
                value={receivedAccountId}
                required
                onChange={(e) => setReceivedAccountId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none cursor-pointer"
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Deposit Date *</label>
              <input
                type="date"
                required
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsDepositOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#6366F1] hover:bg-[#4F46E5] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Deposit Cheque</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bounce Modal */}
      <Dialog open={isBounceOpen} onOpenChange={setIsBounceOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#DC2626]">Record Bounced Cheque</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleBounceCheque} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reason for Bounce *</label>
              <input
                type="text"
                required
                placeholder="e.g. Insufficient Funds or Signature Mismatch"
                value={bounceReason}
                onChange={(e) => setBounceReason(e.target.value)}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bounce Penalty Charges (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={bounceCharges}
                onChange={(e) => setBounceCharges(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full h-10 px-3 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsBounceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
                {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
                <span>Record Bounce</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm bg-white rounded-xl shadow-lg border border-[#E5E7EB] p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#DC2626]">Delete Cheque Record</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-500 leading-normal">
              Are you sure you want to delete cheque booking <span className="font-bold text-slate-700">#{selectedCheque?.cheque_number}</span>?
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeleteCheque} size="sm" disabled={saving} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
              {saving && <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" />}
              <span>Delete Permanently</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
