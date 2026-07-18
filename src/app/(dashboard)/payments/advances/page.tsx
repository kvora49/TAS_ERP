"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownLeft, X, Save, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import Link from "next/link";

interface Party {
  id: string;
  name: string;
  company_name: string | null;
  type: string[];
  phone: string | null;
}

interface Payment {
  id: string;
  payment_date: string;
  payment_mode: string;
  reference_no: string | null;
}

interface Advance {
  id: string;
  advance_amount: number;
  settled_amount: number;
  remaining_amount: number;
  is_settled: boolean;
  created_at: string;
  party: Party;
  payment: Payment;
}

export default function AdvancePaymentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"given" | "received">("received");
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [settleAmount, setSettleAmount] = useState<number>(0);

  // Fetch advances
  const { data: advancesData, isLoading, error } = useQuery<{
    given: Advance[];
    received: Advance[];
  }>({
    queryKey: ["advances"],
    queryFn: async () => {
      const res = await fetch("/api/payments/advances");
      if (!res.ok) throw new Error("Failed to load advances");
      return res.json();
    },
  });

  const list = activeTab === "received" ? advancesData?.received || [] : advancesData?.given || [];

  // Fetch outstanding bills for selected advance's party
  const { data: billsData, isLoading: billsLoading } = useQuery<{ bills: any[] }>({
    queryKey: ["outstanding-bills-for-advance", selectedAdvance?.party?.id],
    queryFn: async () => {
      if (!selectedAdvance) return { bills: [] };
      const directionUrl = activeTab === "received" ? "receive" : "make";
      const res = await fetch(`/api/payments/${directionUrl}?party_id=${selectedAdvance.party.id}`);
      if (!res.ok) throw new Error("Failed to load outstanding bills");
      return res.json();
    },
    enabled: !!selectedAdvance,
  });

  const outstandingBills = billsData?.bills || [];

  // Mutation to settle advance
  const settleMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payments/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to settle advance");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Advance settled successfully!");
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      setSelectedAdvance(null);
      setSelectedBillId("");
      setSettleAmount(0);
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const handleSettleSubmit = async () => {
    if (!selectedAdvance) return;
    if (!selectedBillId) {
      toast.error("Please select a bill.");
      return;
    }
    if (settleAmount <= 0) {
      toast.error("Settle amount must be greater than zero.");
      return;
    }

    const bill = outstandingBills.find((b) => b.id === selectedBillId);
    if (!bill) return;

    const payload = {
      advance_id: selectedAdvance.id,
      bill_id: selectedBillId,
      bill_type: bill.bill_type,
      amount_to_settle: settleAmount,
    };

    await settleMutation.mutateAsync(payload);
  };

  const handleOpenSettle = (adv: Advance) => {
    setSelectedAdvance(adv);
    setSettleAmount(Number(adv.remaining_amount));
  };

  // Computations for stat cards
  const totalAdvances = list.reduce((sum, a) => sum + Number(a.advance_amount), 0);
  const totalSettled = list.reduce((sum, a) => sum + Number(a.settled_amount), 0);
  const totalUnsettled = list.reduce((sum, a) => sum + Number(a.remaining_amount), 0);
  
  // Advances recorded this calendar month
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const totalThisMonth = list
    .filter((a) => new Date(a.payment?.payment_date) >= thisMonthStart)
    .reduce((sum, a) => sum + Number(a.advance_amount), 0);

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
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Advance Payments Tracker
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Advances
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/payments/receive">
              <Button className="flex items-center gap-1.5 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white h-9.5 rounded-lg px-4 shadow-[var(--shadow-sm)]">
                <ArrowDownLeft className="h-4 w-4" />
                Record Received Advance
              </Button>
            </Link>
            <Link href="/payments/make">
              <Button variant="outline" className="flex items-center gap-1.5 text-xs font-bold border-gray-300 text-slate-700 hover:bg-white h-9.5 rounded-lg px-4">
                <ArrowUpRight className="h-4 w-4" />
                Record Outgoing Advance
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => setActiveTab("received")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "received"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Received (from Customers)
          </button>
          <button
            onClick={() => setActiveTab("given")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "given"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Given (to Suppliers & Workers)
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Advances</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalAdvances)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Settled</span>
            <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalSettled)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Unsettled / Outstanding</span>
            <p className="text-xl font-bold text-rose-600 mt-1">{formatCurrency(totalUnsettled)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Recorded This Month</span>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(totalThisMonth)}</p>
          </div>
        </div>

        {/* Tracker Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Party Name</th>
                  <th className="py-3 px-6">Advance Date</th>
                  <th className="py-3 px-6 text-right">Advance Amount</th>
                  <th className="py-3 px-6 text-right">Settled Amount</th>
                  <th className="py-3 px-6 text-right">Remaining</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-semibold">
                      No advance payments found for this category.
                    </td>
                  </tr>
                ) : (
                  list.map((adv) => {
                    const remaining = Number(adv.remaining_amount);
                    const isSettled = adv.is_settled || remaining <= 0;
                    const isPartial = adv.settled_amount > 0 && !isSettled;

                    let statusBadge = (
                      <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-rose-100">
                        Unsettled
                      </span>
                    );
                    if (isSettled) {
                      statusBadge = (
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-emerald-100">
                          Settled
                        </span>
                      );
                    } else if (isPartial) {
                      statusBadge = (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wide border border-amber-100">
                          Partial
                        </span>
                      );
                    }

                    return (
                      <tr key={adv.id} className="hover:bg-slate-50/50 transition-colors h-14">
                        <td className="py-3 px-6 text-[var(--text-primary)] font-bold">
                          {adv.party?.company_name 
                            ? `${adv.party.company_name} (${adv.party.name})` 
                            : adv.party?.name || "—"}
                        </td>
                        <td className="py-3 px-6 text-slate-500 font-mono">
                          {new Date(adv.payment?.payment_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-6 text-right text-slate-900 font-bold">
                          {formatCurrency(adv.advance_amount)}
                        </td>
                        <td className="py-3 px-6 text-right text-emerald-600 font-bold">
                          {formatCurrency(adv.settled_amount)}
                        </td>
                        <td className="py-3 px-6 text-right text-rose-600 font-extrabold">
                          {formatCurrency(adv.remaining_amount)}
                        </td>
                        <td className="py-3 px-6 text-center">{statusBadge}</td>
                        <td className="py-3 px-6 text-center">
                          {!isSettled ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenSettle(adv)}
                              className="h-7 text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-white rounded-md px-2.5"
                            >
                              Settle Advance
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settle Advance modal */}
        {selectedAdvance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Settle Advance: {selectedAdvance.party?.name}
                </h3>
                <button
                  onClick={() => setSelectedAdvance(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Remaining Advance</span>
                    <span className="text-sm font-bold text-rose-600">
                      {formatCurrency(selectedAdvance.remaining_amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Date Recorded</span>
                    <span className="text-sm font-bold text-slate-800">
                      {new Date(selectedAdvance.payment?.payment_date).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Select Outstanding Invoice *</label>
                  {billsLoading ? (
                    <div className="flex items-center gap-1.5 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                      <span className="text-slate-400">Loading payee invoices...</span>
                    </div>
                  ) : (
                    <select
                      value={selectedBillId}
                      onChange={(e) => setSelectedBillId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none w-full"
                    >
                      <option value="">-- Select Bill/Invoice --</option>
                      {outstandingBills.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.invoice_number} ({b.bill_type.replace(/_/g, " ").toUpperCase()}) — Outstanding: {formatCurrency(b.outstanding)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Amount to Allocate (₹) *</label>
                  <input
                    type="number"
                    max={Number(selectedAdvance.remaining_amount)}
                    value={settleAmount || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSettleAmount(Math.min(val, Number(selectedAdvance.remaining_amount)));
                    }}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-transparent text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] outline-none w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setSelectedAdvance(null)}
                  className="h-9 text-xs font-bold border-gray-300 text-slate-700 hover:bg-white"
                >
                  Cancel
                </Button>
                <AsyncButton
                  onClick={handleSettleSubmit}
                  className="h-9 text-xs font-bold bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white"
                >
                  Settle Payment
                </AsyncButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}
