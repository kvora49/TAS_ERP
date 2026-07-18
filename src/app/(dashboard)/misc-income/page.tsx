"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ArrowDownLeft, Wallet, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
}

interface IncomeItem {
  id: string;
  income_number: string;
  income_type: "scrap_sale" | "machinery_rental" | "commission" | "other";
  income_date: string;
  amount: number;
  notes: string | null;
  bank_account: { id: string; account_name: string } | null;
  party: { id: string; name: string } | null;
}

export default function MiscIncomePage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Form States
  const [incomeType, setIncomeType] = useState<string>("scrap_sale");
  const [incomeDate, setIncomeDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [partyId, setPartyId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Fetch income list
  const { data: listData, isLoading, error } = useQuery<{ income: IncomeItem[] }>({
    queryKey: ["misc-income-list"],
    queryFn: async () => {
      const res = await fetch("/api/misc-income");
      if (!res.ok) throw new Error("Failed to load misc income list");
      return res.json();
    },
  });

  const incomeList = listData?.income || [];

  // Fetch form options
  const { data: formData } = useQuery<{
    parties: Party[];
    bankAccounts: BankAccount[];
  }>({
    queryKey: ["misc-income-form-data"],
    queryFn: async () => {
      const res = await fetch("/api/misc-income?form_data=true");
      if (!res.ok) throw new Error("Failed to load income options");
      return res.json();
    },
    enabled: showAddModal,
  });

  const parties = formData?.parties || [];
  const bankAccounts = formData?.bankAccounts || [];

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/misc-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to save income");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Income recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ["misc-income-list"] });
      setShowAddModal(false);
      // Reset form
      setIncomeType("scrap_sale");
      setAmount(0);
      setPartyId("");
      setNotes("");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const handleSubmit = async () => {
    if (amount <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    const payload = {
      income_type: incomeType,
      income_date: incomeDate,
      amount,
      received_in_account_id: bankAccountId || null,
      party_id: partyId || null,
      notes,
    };

    await saveMutation.mutateAsync(payload);
  };

  // Stats computation
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);

  const totalThisMonth = incomeList
    .filter((i) => new Date(i.income_date) >= thisMonthStart)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalBank = incomeList
    .filter((i) => i.bank_account !== null)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalCash = incomeList
    .filter((i) => i.bank_account === null)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Miscellaneous Income</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Non-Operating Inflows
            </p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white h-9.5 rounded-lg px-4 shadow-[var(--shadow-sm)]"
          >
            <Plus className="h-4.5 w-4.5" />
            Record Income
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-[var(--primary)]">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">Total This Month</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{formatCurrency(totalThisMonth)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">Received In Bank</span>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{formatCurrency(totalBank)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">Cash Received</span>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{formatCurrency(totalCash)}</p>
            </div>
          </div>
        </div>

        {/* Income List Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Income No.</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Income Type</th>
                  <th className="py-3 px-6">Received From (Party)</th>
                  <th className="py-3 px-6 text-right">Amount (₹)</th>
                  <th className="py-3 px-6">Deposited In</th>
                  <th className="py-3 px-6">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                {incomeList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                      No miscellaneous income recorded yet.
                    </td>
                  </tr>
                ) : (
                  incomeList.map((inc) => (
                    <tr key={inc.id} className="hover:bg-slate-50/50 transition-colors h-14">
                      <td className="py-3 px-6 font-mono font-bold text-slate-900">{inc.income_number}</td>
                      <td className="py-3 px-6 font-mono text-slate-500">
                        {new Date(inc.income_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-6 font-bold text-slate-900 capitalize">
                        {inc.income_type.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-6">{inc.party?.name || "—"}</td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(inc.amount)}
                      </td>
                      <td className="py-3 px-6">{inc.bank_account?.account_name || "Cash"}</td>
                      <td className="py-3 px-6 text-slate-500 truncate max-w-[220px]" title={inc.notes || ""}>
                        {inc.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Income Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Record Miscellaneous Income</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Income Type *</label>
                    <select
                      value={incomeType}
                      onChange={(e) => setIncomeType(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                    >
                      <option value="scrap_sale">Scrap Sale</option>
                      <option value="machinery_rental">Machinery Rental</option>
                      <option value="commission">Commission</option>
                      <option value="other">Other Inflow</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Date Received *</label>
                    <input
                      type="date"
                      value={incomeDate}
                      onChange={(e) => setIncomeDate(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Amount Received (₹) *</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount || ""}
                      onChange={(e) => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-slate-600">Received From (optional)</label>
                    <select
                      value={partyId}
                      onChange={(e) => setPartyId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                    >
                      <option value="">-- Choose Party --</option>
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.company_name ? `${p.company_name} (${p.name})` : p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Received In Account</label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                  >
                    <option value="">-- Cash --</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.account_name} ({b.bank_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-600">Notes / Details</label>
                  <textarea
                    value={notes}
                    rows={2}
                    placeholder="Enter details..."
                    onChange={(e) => setNotes(e.target.value)}
                    className="p-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none resize-none w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-5 py-4 bg-white border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 h-9 text-xs font-semibold text-[#64748B] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F8FAFC] transition-all"
                >
                  Cancel
                </button>
                <AsyncButton
                  onClick={handleSubmit}
                  className="px-4 h-9 text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded-lg transition-all shadow-md shadow-[#6366F1]/10 flex items-center gap-2 disabled:opacity-50"
                >
                  Record Income
                </AsyncButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}
