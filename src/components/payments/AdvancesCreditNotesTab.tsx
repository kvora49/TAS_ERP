"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, CheckCircle, ArrowUpRight, ArrowDownLeft, Save, ArrowLeft, Plus } from "lucide-react";
import PageState from "@/components/shared/PageState";
import AsyncButton from "@/components/shared/AsyncButton";
import { Modal } from "@/components/shared/Modal";

import BillAllocationTable, { OutstandingBill } from "@/components/payments/BillAllocationTable";

interface Advance {
  id: string;
  advance_amount: number;
  settled_amount: number;
  remaining_amount: number;
  is_settled: boolean;
  created_at: string;
  party: { id: string; name: string; company_name: string | null; type: string[] };
  payment: { id: string; payment_date: string; payment_mode: string; reference_no: string | null };
}

interface AdvancesCreditNotesTabProps {
  showBackButton?: boolean;
}

export default function AdvancesCreditNotesTab({ showBackButton = false }: AdvancesCreditNotesTabProps) {
  const queryClient = useQueryClient();

  const [subTab, setSubTab] = useState<"received" | "given">("received");
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null);
  const [multiAllocations, setMultiAllocations] = useState<any[]>([]);

  // Fetch advances
  const { data: advancesData, isLoading, error, refetch } = useQuery<{
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

  const advancesList = subTab === "received" ? advancesData?.received || [] : advancesData?.given || [];

  // Metrics calculation for selected subTab
  const totalAdvancesSum = advancesList.reduce((sum, a) => sum + Number(a.advance_amount || 0), 0);
  const settledSum = advancesList.reduce((sum, a) => sum + Number(a.settled_amount || 0), 0);
  const unsettledSum = advancesList.reduce((sum, a) => sum + Number(a.remaining_amount || 0), 0);

  const now = new Date();
  const currentMonthYearStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const recordedThisMonthSum = advancesList
    .filter((a) => a.created_at && a.created_at.startsWith(currentMonthYearStr))
    .reduce((sum, a) => sum + Number(a.advance_amount || 0), 0);

  // Fetch outstanding bills for selected advance's party
  const { data: billsData, isLoading: billsLoading } = useQuery<{ bills: any[] }>({
    queryKey: ["outstanding-bills-for-advance", selectedAdvance?.party?.id],
    queryFn: async () => {
      if (!selectedAdvance?.party?.id) return { bills: [] };
      const res = await fetch(`/api/payments?party_id=${selectedAdvance.party.id}`);
      if (!res.ok) throw new Error("Failed to load party bills");
      return res.json();
    },
    enabled: !!selectedAdvance?.party?.id,
  });

  const rawBills = billsData?.bills || [];
  const outstandingBills: OutstandingBill[] = rawBills
    .filter((b: any) => {
      const isTemp = b.invoice_number?.startsWith("TEMP-") || b.bill_number?.startsWith("TEMP-");
      return !isTemp;
    })
    .map((b: any) => ({
      id: b.id,
      invoice_number: b.invoice_number || b.bill_number || "Bill",
      invoice_date: b.invoice_date || b.bill_date || new Date().toISOString(),
      due_date: b.due_date || b.invoice_date || b.bill_date || new Date().toISOString(),
      total: Number(b.total || b.grand_total || 0),
      outstanding: Number(b.outstanding || 0),
      bill_type: b.bill_type || (subTab === "received" ? "sale_bill" : "purchase_bill"),
    }));

  // Settle advance mutation
  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAdvance) throw new Error("No advance selected");
      if (multiAllocations.length === 0) {
        throw new Error("Please select at least one bill to allocate advance funds against");
      }

      const res = await fetch("/api/payments/advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advance_id: selectedAdvance.id,
          allocations: multiAllocations,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to settle advance");
      return data;
    },
    onSuccess: () => {
      toast.success("Advance settled against bills successfully!");
      setSelectedAdvance(null);
      setMultiAllocations([]);
      queryClient.invalidateQueries({ queryKey: ["advances"] });
      queryClient.invalidateQueries({ queryKey: ["outstanding-bills-for-advance"] });
      queryClient.invalidateQueries({ queryKey: ["payments-list-overview"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to settle advance");
    },
  });

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={error?.message}
      onRetry={refetch}
      isEmpty={false}
      skeletonVariant="table"
    >
      <div className="space-y-6">
        {/* Header Switcher & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <Link
                href="/payments"
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)] border border-[var(--border)] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}

            <div className="flex items-center gap-2 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setSubTab("received")}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                  subTab === "received"
                    ? "border-[var(--primary)] text-[var(--primary)] font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Received (from Customers)
              </button>

              <button
                type="button"
                onClick={() => setSubTab("given")}
                className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                  subTab === "given"
                    ? "border-[var(--primary)] text-[var(--primary)] font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Given (to Suppliers & Workers)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/payments/receive"
              className="px-4 py-2 bg-[var(--primary)] text-white text-xs font-semibold rounded-full hover:bg-[var(--primary-dark)] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Record Received Advance
            </Link>

            <Link
              href="/payments/make"
              className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold rounded-full hover:bg-[var(--page-bg)] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Record Outgoing Advance
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              TOTAL ADVANCES
            </div>
            <div className="text-xl font-bold text-[var(--text-primary)]">
              ₹{totalAdvancesSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              SETTLED
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{settledSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              UNSETTLED / OUTSTANDING
            </div>
            <div className="text-xl font-bold text-rose-500">
              ₹{unsettledSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              RECORDED THIS MONTH
            </div>
            <div className="text-xl font-bold text-[var(--primary)]">
              ₹{recordedThisMonthSum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Advances Table */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--table-header-bg)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3">PARTY NAME</th>
                  <th className="px-4 py-3">ADVANCE DATE</th>
                  <th className="px-4 py-3">ADVANCE AMOUNT</th>
                  <th className="px-4 py-3">SETTLED AMOUNT</th>
                  <th className="px-4 py-3">REMAINING</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {advancesList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-[var(--text-muted)] font-medium">
                      No advance payments found for this category.
                    </td>
                  </tr>
                ) : (
                  advancesList.map((adv) => (
                    <tr key={adv.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        {adv.party?.name || "Unknown Party"}
                        {adv.party?.company_name && (
                          <span className="block text-[11px] text-[var(--text-muted)] font-normal">
                            {adv.party.company_name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-body)]">
                        {adv.created_at ? new Date(adv.created_at).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                        ₹{Number(adv.advance_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-body)]">
                        ₹{Number(adv.settled_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 font-bold text-[var(--primary)]">
                        ₹{Number(adv.remaining_amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        {adv.is_settled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Fully Settled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Active Advance
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!adv.is_settled && Number(adv.remaining_amount || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAdvance(adv);
                            }}
                            className="px-3 py-1 bg-[var(--primary)] text-white text-[11px] font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
                          >
                            Settle Against Bill
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement Modal */}
        {selectedAdvance && (
          <Modal
            open={!!selectedAdvance}
            onOpenChange={(o) => !o && setSelectedAdvance(null)}
            title={`Settle Advance — ${selectedAdvance.party?.name}`}
            maxWidth="max-w-5xl"
          >
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-[var(--page-bg)] border border-[var(--border)] rounded-xl flex items-center justify-between font-medium">
                <span>Remaining Unallocated Advance:</span>
                <span className="text-base font-bold text-[var(--primary)]">
                  ₹{Number(selectedAdvance.remaining_amount || 0).toLocaleString("en-IN")}
                </span>
              </div>

              {billsLoading ? (
                <div className="py-6 text-center text-[var(--text-muted)]">Loading unpaid bills...</div>
              ) : outstandingBills.length === 0 ? (
                <div className="p-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-center">
                  No open unpaid bills found for this party.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="font-semibold text-[var(--text-muted)]">Select & Allocate Unpaid Bills *</label>
                    <BillAllocationTable
                      bills={outstandingBills}
                      paymentAmount={Number(selectedAdvance.remaining_amount || 0)}
                      onAllocationChange={setMultiAllocations}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setSelectedAdvance(null)}
                      className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-xl font-medium"
                    >
                      Cancel
                    </button>
                    <AsyncButton
                      onClick={() => settleMutation.mutateAsync()}
                      variant="primary"
                    >
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      Execute Settlement
                    </AsyncButton>
                  </div>
                </>
              )}
            </div>
          </Modal>
        )}
      </div>
    </PageState>
  );
}
