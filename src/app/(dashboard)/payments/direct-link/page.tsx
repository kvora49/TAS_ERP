"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Link as LinkIcon, Info, CheckCircle, RefreshCw } from "lucide-react";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";

function DirectLinkContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [sourcePartyId, setSourcePartyId] = useState<string>("");
  const [sourceBillId, setSourceBillId] = useState<string>("");
  const [targetPartyId, setTargetPartyId] = useState<string>("");
  const [targetBillId, setTargetBillId] = useState<string>("");
  const [targetBillType, setTargetBillType] = useState<string>("purchase_bill");
  const [linkedAmount, setLinkedAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>("");

  // Fetch workspace parties & existing links
  const { data: pageData, isLoading, error, refetch } = useQuery<{
    parties: any[];
    directLinks: any[];
  }>({
    queryKey: ["direct-linking-page-init"],
    queryFn: async () => {
      const res = await fetch("/api/payments");
      if (!res.ok) throw new Error("Failed to load workspace data");
      return res.json();
    },
  });

  const parties = pageData?.parties || [];
  const links = pageData?.directLinks || [];

  const customers = parties.filter((p) => p.type?.includes("customer"));
  const suppliersAndWorkers = parties.filter((p) => p.type?.includes("supplier") || p.type?.includes("worker"));

  // Fetch source customer bills
  const { data: sourceBillsData } = useQuery<{ bills: any[] }>({
    queryKey: ["source-customer-bills-page", sourcePartyId],
    queryFn: async () => {
      if (!sourcePartyId) return { bills: [] };
      const res = await fetch(`/api/payments?party_id=${sourcePartyId}`);
      if (!res.ok) throw new Error("Failed to load customer bills");
      return res.json();
    },
    enabled: !!sourcePartyId,
  });

  // Fetch target supplier/worker bills
  const { data: targetBillsData } = useQuery<{ bills: any[] }>({
    queryKey: ["target-supplier-bills-page", targetPartyId],
    queryFn: async () => {
      if (!targetPartyId) return { bills: [] };
      const res = await fetch(`/api/payments?party_id=${targetPartyId}`);
      if (!res.ok) throw new Error("Failed to load supplier bills");
      return res.json();
    },
    enabled: !!targetPartyId,
  });

  const sourceBills = sourceBillsData?.bills || [];
  const targetBills = targetBillsData?.bills || [];

  const selectedSourceBill = sourceBills.find((b) => b.id === sourceBillId);
  const selectedTargetBill = targetBills.find((b) => b.id === targetBillId);

  // Auto-set suggested link amount
  useEffect(() => {
    if (selectedTargetBill) {
      setTargetBillType(selectedTargetBill.bill_type || "purchase_bill");
      if (selectedSourceBill) {
        setLinkedAmount(Math.min(selectedSourceBill.outstanding, selectedTargetBill.outstanding));
      } else {
        setLinkedAmount(selectedTargetBill.outstanding);
      }
    }
  }, [sourceBillId, targetBillId, selectedSourceBill, selectedTargetBill]);

  // Direct Link Mutation
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!sourcePartyId) throw new Error("Please select a Customer (Source Party)");
      if (!targetPartyId) throw new Error("Please select a Supplier / Worker (Target Party)");
      if (linkedAmount <= 0) throw new Error("Please enter a valid linked amount");

      const payload = {
        action: "direct_contra_link",
        source_party_id: sourcePartyId,
        source_bill_id: sourceBillId || null,
        target_party_id: targetPartyId,
        target_bill_id: targetBillId || null,
        target_bill_type: targetBillType,
        linked_amount: Number(linkedAmount),
        remarks,
      };

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute direct contra link");
      return data;
    },
    onSuccess: () => {
      toast.success("Direct Customer-to-Supplier Contra Link executed successfully");
      queryClient.invalidateQueries({ queryKey: ["direct-linking-page-init"] });
      queryClient.invalidateQueries({ queryKey: ["payments-list"] });
      // Reset form
      setSourcePartyId("");
      setSourceBillId("");
      setTargetPartyId("");
      setTargetBillId("");
      setLinkedAmount(0);
      setRemarks("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to link payments");
    },
  });

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={error?.message}
      onRetry={refetch}
      skeletonVariant="form"
    >
      <div className="p-2.5 sm:p-6 max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <Link
              href="/payments"
              className="p-2 mt-0.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] border border-[var(--border)] transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                <h1 className="text-base sm:text-xl font-bold text-[var(--text-primary)] truncate">
                  Direct Payment Linking
                </h1>
                <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Contra Settlement
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2 sm:line-clamp-none">
                Settle customer payment receipts directly against supplier or job worker invoices without duplicate bank entries.
              </p>
            </div>
          </div>

          <Link
            href="/payments"
            className="w-full sm:w-auto justify-center px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)] rounded-xl hover:bg-[var(--card-bg)] transition-colors flex items-center gap-2 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Payments Overview</span>
          </Link>
        </div>

        {/* Info Banner */}
        <div className="p-3.5 sm:p-4 bg-[var(--primary-light)] border border-[var(--primary)]/30 rounded-2xl flex items-start gap-3 text-xs text-[var(--text-primary)]">
          <Info className="w-5 h-5 text-[var(--primary)] shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold text-[var(--primary)]">How Direct Contra Settlement Works:</strong>
            <p className="mt-1 leading-relaxed text-[11px] sm:text-xs">
              When a Customer pays ₹10,000 (or owes an invoice) and you owe ₹10,000 (or less/more) to a Supplier or Worker, Direct Payment Link credits the Customer ledger, debits the Supplier ledger, and updates both bill statuses cleanly <strong>without creating 2 separate bank entries</strong>.
            </p>
          </div>
        </div>

        {/* Main Linking Form Card */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Configure Direct Contra Link
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Left: Source Customer */}
            <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                Source (Customer)
              </h4>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">Select Customer *</label>
                <select
                  value={sourcePartyId}
                  onChange={(e) => {
                    setSourcePartyId(e.target.value);
                    setSourceBillId("");
                  }}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                >
                  <option value="">Select Customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company_name ? `(${c.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {sourcePartyId && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Select Sale Bill (Optional)</label>
                  <select
                    value={sourceBillId}
                    onChange={(e) => setSourceBillId(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                  >
                    <option value="">All Open Bills / General Customer Receipt</option>
                    {sourceBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        Bill #{b.invoice_number} (Outstanding: ₹{b.outstanding.toLocaleString("en-IN")})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Right: Target Supplier / Worker */}
            <div className="p-4 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
                Target (Supplier / Job Worker)
              </h4>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-muted)]">Select Supplier / Worker *</label>
                <select
                  value={targetPartyId}
                  onChange={(e) => {
                    setTargetPartyId(e.target.value);
                    setTargetBillId("");
                  }}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                >
                  <option value="">Select Supplier or Job Worker...</option>
                  {suppliersAndWorkers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.company_name ? `(${s.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {targetPartyId && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-muted)]">Select Bill to Pay *</label>
                  <select
                    value={targetBillId}
                    onChange={(e) => setTargetBillId(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
                  >
                    <option value="">Select Unpaid Bill...</option>
                    {targetBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.invoice_number} ({b.bill_type}) — ₹{b.outstanding.toLocaleString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Amount & Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Direct Transfer / Linked Amount ₹ *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={linkedAmount || ""}
                onChange={(e) => setLinkedAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm font-semibold transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-muted)]">Remarks / Contra Memo</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Direct customer transfer to vendor"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent rounded-lg px-3 h-10 text-sm transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <AsyncButton
              onClick={() => linkMutation.mutateAsync()}
              variant="primary"
            >
              <LinkIcon className="w-4 h-4 mr-1.5" />
              Execute Direct Contra Link
            </AsyncButton>
          </div>
        </div>

        {/* Existing Direct Links Container */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Recorded Direct Payment Links ({links.length})
          </h2>

          {links.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)] font-medium">
              No direct payment links recorded yet.
            </div>
          ) : (
            <>
              {/* Mobile Card View (md:hidden) */}
              <div className="md:hidden divide-y divide-[var(--border-light)] border border-[var(--border)] rounded-xl overflow-hidden">
                {links.map((l) => (
                  <div key={l.id} className="p-3.5 space-y-2.5 hover:bg-[var(--table-row-hover)] transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        {l.created_at ? new Date(l.created_at).toLocaleDateString("en-IN") : "-"}
                      </span>
                      <span className="font-mono text-xs font-bold text-[var(--primary)]">
                        ₹{Number(l.linked_amount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>

                    {/* Flow */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--page-bg)] text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] uppercase font-semibold text-[var(--text-faint)] block">Customer (Source)</span>
                        <span className="font-semibold text-[var(--text-primary)] block truncate">
                          {l.source?.party?.name || "Customer"}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] block truncate">
                          {l.source?.payment_number || "Direct"}
                        </span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />

                      <div className="flex-1 min-w-0 text-right">
                        <span className="text-[9px] uppercase font-semibold text-[var(--text-faint)] block">Supplier (Target)</span>
                        <span className="font-semibold text-[var(--text-primary)] block truncate">
                          {l.target?.party?.name || "Supplier"}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] block truncate">
                          {l.target?.payment_number || "Direct"}
                        </span>
                      </div>
                    </div>

                    {l.remarks && (
                      <div className="text-[11px] text-[var(--text-muted)] italic truncate">
                        Memo: {l.remarks}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto border border-[var(--border)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--table-header-bg)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3">Linked Date</th>
                      <th className="px-4 py-3">Source (Customer)</th>
                      <th className="px-4 py-3">Target (Supplier)</th>
                      <th className="px-4 py-3">Linked Amount</th>
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {links.map((l) => (
                      <tr key={l.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="px-4 py-3 text-[var(--text-body)]">
                          {l.created_at ? new Date(l.created_at).toLocaleDateString("en-IN") : "-"}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          {l.source?.party?.name || "Customer"}
                          <span className="block text-[11px] text-[var(--text-muted)] font-normal">
                            {l.source?.payment_number || "Direct"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          {l.target?.party?.name || "Supplier"}
                          <span className="block text-[11px] text-[var(--text-muted)] font-normal">
                            {l.target?.payment_number || "Direct"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--primary)] font-mono">
                          ₹{Number(l.linked_amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-muted)] italic">
                          {l.remarks || "Direct Contra Link"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </PageState>
  );
}

export default function DirectLinkPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--text-muted)]">Loading Direct Link Page...</div>}>
      <DirectLinkContent />
    </Suspense>
  );
}
