"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Link as LinkIcon, RefreshCw, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

interface SourcePayment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  unallocated_amount: number;
  party: { id: string; name: string; company_name: string | null };
}

interface TargetPayment {
  id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  unallocated_amount: number;
  party: { id: string; name: string; company_name: string | null };
}

interface LinkDetail {
  id: string;
  linked_amount: number;
  remarks: string | null;
  created_at: string;
  source: { payment_number: string; party: { name: string } };
  target: { payment_number: string; party: { name: string } };
}

export default function DirectPaymentLinkingPage() {
  const queryClient = useQueryClient();

  // Selected state
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [targetType, setTargetType] = useState<"existing" | "new">("existing");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  // New inline target details
  const [inlineWorkerId, setInlineWorkerId] = useState<string>("");
  const [inlineDate, setInlineDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [inlineMode, setInlineMode] = useState<string>("bank_transfer");
  const [inlineAccountId, setInlineAccountId] = useState<string>("");

  // Linking fields
  const [linkAmount, setLinkAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");

  // Fetch page data
  const { data: pageData, isLoading, error } = useQuery<{
    sources: SourcePayment[];
    targets: TargetPayment[];
    links: LinkDetail[];
    workers: any[];
    bankAccounts: any[];
  }>({
    queryKey: ["direct-linking-data"],
    queryFn: async () => {
      const res = await fetch("/api/payments/direct-link");
      if (!res.ok) throw new Error("Failed to load linking workspace data");
      return res.json();
    },
  });

  const sources = pageData?.sources || [];
  const targets = pageData?.targets || [];
  const links = pageData?.links || [];
  const workers = pageData?.workers || [];
  const bankAccounts = pageData?.bankAccounts || [];

  const selectedSource = sources.find((s) => s.id === selectedSourceId) || null;
  const selectedTarget = targets.find((t) => t.id === selectedTargetId) || null;

  // Set default link amount when source is selected
  React.useEffect(() => {
    if (selectedSource) {
      if (targetType === "existing" && selectedTarget) {
        setLinkAmount(Math.min(Number(selectedSource.unallocated_amount), Number(selectedTarget.unallocated_amount)));
      } else {
        setLinkAmount(Number(selectedSource.unallocated_amount));
      }
    }
  }, [selectedSourceId, selectedTargetId, targetType, selectedSource, selectedTarget]);

  // Mutation to create link
  const createLinkMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/payments/direct-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create direct payment link");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Direct payment link created successfully!");
      queryClient.invalidateQueries({ queryKey: ["direct-linking-data"] });
      // Reset selections
      setSelectedSourceId("");
      setSelectedTargetId("");
      setInlineWorkerId("");
      setLinkAmount(0);
      setRemarks("");
    },
    onError: (err: any) => {
      toast.error(err.message || "An error occurred.");
    },
  });

  const handleLinkSubmit = async () => {
    if (!selectedSourceId) {
      toast.error("Please select a source payment receipt.");
      return;
    }
    if (linkAmount <= 0) {
      toast.error("Link amount must be greater than zero.");
      return;
    }
    if (linkAmount > Number(selectedSource?.unallocated_amount)) {
      toast.error("Link amount cannot exceed the available unallocated amount on the source payment.");
      return;
    }

    const payload: any = {
      source_payment_id: selectedSourceId,
      linked_amount: linkAmount,
      remarks,
      is_inline: targetType === "new",
    };

    if (targetType === "existing") {
      if (!selectedTargetId) {
        toast.error("Please select an existing target payment.");
        return;
      }
      payload.target_payment_id = selectedTargetId;
    } else {
      if (!inlineWorkerId) {
        toast.error("Please select a worker to pay.");
        return;
      }
      payload.party_id = inlineWorkerId;
      payload.payment_date = inlineDate;
      payload.payment_mode = inlineMode;
      payload.bank_account_id = inlineMode === "cash" ? null : inlineAccountId || bankAccounts[0]?.id;
    }

    await createLinkMutation.mutateAsync(payload);
  };

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
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Direct Payment Linking
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Payments & Finance / Direct Linking Flow
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["direct-linking-data"] })}
            className="flex items-center gap-1 h-9 rounded-lg border-gray-300 text-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* Informational Banner */}
        <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-xl text-xs font-semibold leading-relaxed flex gap-2.5 items-start">
          <HelpCircle className="h-4.5 w-4.5 shrink-0 text-blue-600 mt-0.5" />
          <p>
            Direct Payment Linking allows you to route unallocated customer receipts (source payments) directly to supplier/worker payouts (target payments) without bloating cash ledger entries. Capped at the lower of the source unallocated receipt amount and target payable.
          </p>
        </div>

        {/* Two-Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Select Source Payment (Receipts) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              1. Select Source Payment (Money Received)
            </h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Available Customer Receipts *</label>
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] w-full outline-none"
              >
                <option value="">-- Choose Source Receipt --</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.payment_number} — {s.party?.company_name || s.party?.name} (Available: {formatCurrency(s.unallocated_amount)})
                  </option>
                ))}
              </select>
            </div>

            {selectedSource && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-semibold grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Customer</span>
                  <span className="text-slate-800 font-bold">{selectedSource.party?.company_name || selectedSource.party?.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Payment Date</span>
                  <span className="text-slate-800">{new Date(selectedSource.payment_date).toLocaleDateString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Receipt Amount</span>
                  <span className="text-slate-800 font-bold">{formatCurrency(selectedSource.amount)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Unlinked Remaining Balance</span>
                  <span className="text-blue-600 font-extrabold">{formatCurrency(selectedSource.unallocated_amount)}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Select Target Payment (Payouts) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              2. Select Target Payment (Money to Pay)
            </h2>

            {/* Sub-tabs to choose Existing vs Inline creation */}
            <div className="flex gap-4 border-b border-slate-100 pb-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTargetType("existing")}
                className={`pb-1 cursor-pointer transition-colors ${
                  targetType === "existing" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Existing Payout Record
              </button>
              <button
                type="button"
                onClick={() => setTargetType("new")}
                className={`pb-1 cursor-pointer transition-colors ${
                  targetType === "new" ? "text-[var(--primary)] border-b-2 border-[var(--primary)]" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Create Inline Worker Payment
              </button>
            </div>

            {targetType === "existing" ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Unallocated Paid Payments *</label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] w-full outline-none"
                  >
                    <option value="">-- Choose Target Payout --</option>
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.payment_number} — {t.party?.name} (Required: {formatCurrency(t.unallocated_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTarget && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-semibold grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Payee / Worker</span>
                      <span className="text-slate-800 font-bold">{selectedTarget.party?.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Payment Date</span>
                      <span className="text-slate-800">{new Date(selectedTarget.payment_date).toLocaleDateString("en-IN")}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Payout Amount</span>
                      <span className="text-slate-800 font-bold">{formatCurrency(selectedTarget.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Outstanding Needed</span>
                      <span className="text-rose-600 font-extrabold">{formatCurrency(selectedTarget.unallocated_amount)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-xs font-semibold">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Select Worker *</label>
                  <select
                    value={inlineWorkerId}
                    onChange={(e) => setInlineWorkerId(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold focus:ring-1 focus:ring-[var(--primary)] w-full outline-none"
                  >
                    <option value="">-- Select Worker --</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600">Payment Date</label>
                    <input
                      type="date"
                      value={inlineDate}
                      onChange={(e) => setInlineDate(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600">Mode</label>
                    <select
                      value={inlineMode}
                      onChange={(e) => setInlineMode(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>

                {inlineMode !== "cash" && bankAccounts.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600">Source Account</label>
                    <select
                      value={inlineAccountId}
                      onChange={(e) => setInlineAccountId(e.target.value)}
                      className="h-9 px-3 rounded-lg border border-[var(--input-border)] bg-white text-xs font-bold outline-none"
                    >
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Link config card (Center Action panel) */}
        {selectedSourceId && (
          <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg max-w-4xl mx-auto">
            <div className="flex-1 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                Configure Payment Link
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400">Link Amount (₹) *</label>
                  <input
                    type="number"
                    value={linkAmount || ""}
                    onChange={(e) => setLinkAmount(parseFloat(e.target.value) || 0)}
                    className="h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm font-bold outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400">Remarks / Notes</label>
                  <input
                    type="text"
                    value={remarks}
                    placeholder="Enter link references..."
                    onChange={(e) => setRemarks(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-white outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-center pt-4 md:pt-0">
              <AsyncButton
                onClick={handleLinkSubmit}
                className="bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-bold px-6 py-2.5 rounded-lg flex items-center gap-2"
              >
                <LinkIcon className="h-4 w-4" />
                Create Link
              </AsyncButton>
            </div>
          </div>
        )}

        {/* Existing Links List */}
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-800">Existing Direct Payment Links</h3>
          <div className="bg-white border border-gray-200 rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-[var(--text-muted)] font-bold uppercase tracking-wider">
                    <th className="py-3 px-6">Source Receipt</th>
                    <th className="py-3 px-6">Source Customer</th>
                    <th className="py-3 px-6 text-center w-12"><ArrowRight className="h-4 w-4 text-slate-400" /></th>
                    <th className="py-3 px-6">Target Payment</th>
                    <th className="py-3 px-6">Target Worker</th>
                    <th className="py-3 px-6 text-right">Linked Amount</th>
                    <th className="py-3 px-6">Linked Date</th>
                    <th className="py-3 px-6">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                  {links.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 font-semibold">
                        No direct payment links recorded yet.
                      </td>
                    </tr>
                  ) : (
                    links.map((link) => (
                      <tr key={link.id} className="hover:bg-slate-50/50 h-13">
                        <td className="py-3 px-6 font-mono text-slate-800 font-bold">{link.source?.payment_number}</td>
                        <td className="py-3 px-6">{link.source?.party?.name || "—"}</td>
                        <td className="py-3 px-6 text-center"><LinkIcon className="h-3.5 w-3.5 text-slate-400" /></td>
                        <td className="py-3 px-6 font-mono text-slate-800 font-bold">{link.target?.payment_number}</td>
                        <td className="py-3 px-6">{link.target?.party?.name || "—"}</td>
                        <td className="py-3 px-6 text-right font-bold text-slate-900">{formatCurrency(link.linked_amount)}</td>
                        <td className="py-3 px-6 text-slate-500 font-mono">
                          {new Date(link.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-6 text-slate-500 truncate max-w-[180px]">{link.remarks || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageState>
  );
}
