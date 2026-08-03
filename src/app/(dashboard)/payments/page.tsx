"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Filter,
  Link as LinkIcon,
  Clock,
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import AdvancesCreditNotesTab from "@/components/payments/AdvancesCreditNotesTab";
import DirectLinkingTab from "@/components/payments/DirectLinkingTab";
import { cn } from "@/lib/utils";

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab State
  const currentTab = searchParams.get("tab") || "history";
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  // Filters for History Tab
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/payments?${params.toString()}`);
  };

  // Fetch Payments History Data
  const { data, isLoading, error, refetch } = useQuery<{
    payments: any[];
    totalCount: number;
  }>({
    queryKey: ["payments-list-overview", directionFilter, page],
    queryFn: async () => {
      const res = await fetch(`/api/payments?direction=${directionFilter}&page=${page}&limit=15`);
      if (!res.ok) throw new Error("Failed to load payments history");
      return res.json();
    },
    enabled: activeTab === "history",
  });

  const payments = data?.payments || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / 15);

  // Metrics calculation
  const totalReceived = payments
    .filter((p) => p.direction === "received")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalPaid = payments
    .filter((p) => p.direction === "paid")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalAdvances = payments
    .filter((p) => p.is_advance)
    .reduce((sum, p) => sum + Number(p.unallocated_amount || 0), 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Header & Direct Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[var(--primary)]" />
            Payments & Settlement Workspace
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Unified master workspace for inward receipts, supplier payments, advances, and direct contra links.
          </p>
        </div>

        {/* Direct Action Buttons - Navigate directly to dedicated full pages */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/payments/receive"
            className="px-4 py-2.5 bg-[var(--primary)] text-white text-xs font-semibold rounded-xl hover:bg-[var(--primary-dark)] transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-500" />
            Receive Payment
          </Link>

          <Link
            href="/payments/make"
            className="px-4 py-2.5 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold rounded-xl hover:bg-[var(--page-bg)] transition-all flex items-center gap-2 shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
            Make Payment
          </Link>

          <Link
            href="/payments/direct-link"
            className="px-3.5 py-2.5 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-semibold rounded-xl hover:bg-[var(--page-bg)] transition-all flex items-center gap-2 shadow-sm"
          >
            <LinkIcon className="w-4 h-4 text-emerald-500" />
            Direct Payment Linking
          </Link>
        </div>
      </div>

      {/* Workspace Section Tabs - scrollable on mobile */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => handleTabChange("history")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "history"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Payment Vouchers & History
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("advances")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "advances"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Advances & Credit Notes
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("direct-link")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "direct-link"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Direct Payment Linking
        </button>
      </div>

      {/* TAB 1: Payment History */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* ── MOBILE: snap-scroll stat cards ── */}
          <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-none">
            {[
              { label: "Received",  value: `₹${totalReceived.toLocaleString("en-IN")}`, icon: ArrowDownLeft, bg: "bg-emerald-500/10",         color: "text-emerald-500" },
              { label: "Paid Out",  value: `₹${totalPaid.toLocaleString("en-IN")}`,    icon: ArrowUpRight,  bg: "bg-amber-500/10",            color: "text-amber-500" },
              { label: "Advances",  value: `₹${totalAdvances.toLocaleString("en-IN")}`,icon: Clock,         bg: "bg-[var(--primary-light)]",  color: "text-[var(--primary)]" },
            ].map(({ label, value, icon: Icon, bg, color }) => (
              <div key={label} className="snap-start shrink-0 w-[152px] bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)] flex items-center gap-2.5">
                <div className={cn("p-2 rounded-lg shrink-0", bg)}><Icon className={cn("h-4 w-4", color)} /></div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">{label}</p>
                  <p className={cn("text-xs font-black mt-0.5", color)}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP: existing 3-col stat grid ── */}
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Total Received (Inward)</span>
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-lg font-bold text-[var(--text-primary)]">₹{totalReceived.toLocaleString("en-IN")}</div>
              </div>
            

              <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Total Paid (Outward)</span>
                  <ArrowUpRight className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-lg font-bold text-[var(--text-primary)]">₹{totalPaid.toLocaleString("en-IN")}</div>
              </div>
            

              <div className="p-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>Active Unallocated Advances</span>
                  <Clock className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-lg font-bold text-[var(--primary)]">₹{totalAdvances.toLocaleString("en-IN")}</div>
              </div>
            </div>{/* end desktop grid */}

          {/* ── MOBILE direction filter chips ── */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {["all", "received", "paid"].map((dir) => (
              <button key={dir} type="button"
                onClick={() => { setDirectionFilter(dir); setPage(1); }}
                className={cn("shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer capitalize whitespace-nowrap",
                  directionFilter === dir ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-muted)]"
                )}
              >{dir === "all" ? "All" : dir === "received" ? "Received" : "Paid Out"}</button>
            ))}
          </div>

          {/* ── DESKTOP filter bar (existing) ── */}
          <div className="hidden md:flex items-center justify-between gap-4 p-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" /> Filter Direction:
              </span>
              <div className="flex items-center gap-1 bg-[var(--page-bg)] p-1 rounded-xl border border-[var(--border)]">
                {["all", "received", "paid"].map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => {
                      setDirectionFilter(dir);
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-all ${
                      directionFilter === dir
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-xs text-[var(--text-muted)]">Showing {payments.length} of {totalCount} records</div>
          </div>{/* end desktop filter bar */}

          {/* ── MOBILE: payment card list ── */}
          <div className="md:hidden space-y-3">
            {payments.map((p) => (
              <div key={p.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                {/* Header: Voucher# + Direction badge */}
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                  <span className="font-mono font-black text-[var(--primary)] text-sm">{p.payment_number}</span>
                  {p.direction === "received" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600">
                      <ArrowDownLeft className="w-3 h-3" /> Received
                    </span>
                  ) : p.direction === "contra" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600">
                      <LinkIcon className="w-3 h-3" /> Contra
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600">
                      <ArrowUpRight className="w-3 h-3" /> Paid
                    </span>
                  )}
                </div>
                {/* Party + Date */}
                <div className="flex items-center justify-between px-4 pb-2">
                  <div className="min-w-0 mr-2">
                    <p className="font-semibold text-[var(--text-primary)] text-sm truncate">{p.party?.name || "Unknown"}</p>
                    {p.party?.company_name && <p className="text-[11px] text-[var(--text-muted)] truncate">{p.party.company_name}</p>}
                  </div>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : "—"}
                  </span>
                </div>
                {/* Amount grid */}
                <div className="grid grid-cols-3 border-t border-[var(--border-light)] mx-4 py-2">
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Amount</p>
                    <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">₹{Number(p.amount || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Unalloc.</p>
                    {Number(p.unallocated_amount || 0) > 0 ? (
                      <p className="text-xs font-bold mt-0.5 text-amber-600">₹{Number(p.unallocated_amount).toLocaleString("en-IN")}</p>
                    ) : (
                      <p className="text-xs font-bold mt-0.5 text-emerald-600">₹0</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">Status</p>
                    <p className="text-[10px] font-bold mt-0.5 uppercase text-emerald-600">{p.status || "completed"}</p>
                  </div>
                </div>
                {/* Mode + Ref */}
                <div className="flex items-center gap-2 px-4 pb-3 border-t border-[var(--border-light)] pt-2">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] capitalize">{p.payment_mode?.replace("_", " ")}</span>
                  {p.reference_no && <span className="text-[11px] text-[var(--text-faint)]">· Ref: {p.reference_no}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* ── DESKTOP: existing table ── */}
          <PageState
            isLoading={isLoading}
            isError={!!error}
            error={error?.message}
            onRetry={refetch}
            isEmpty={payments.length === 0}
            skeletonVariant="table"
            skeletonRows={8}
            skeletonColumns={6}
            emptyTitle="No Payments Found"
            emptyMessage="There are no payment vouchers matching the selected filter criteria."
          >
            <div className="hidden md:block bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--table-header-bg)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3">Voucher #</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Party</th>
                      <th className="px-4 py-3">Direction</th>
                      <th className="px-4 py-3">Mode & Ref</th>
                      <th className="px-4 py-3">Total Amount</th>
                      <th className="px-4 py-3">Unallocated</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-[var(--primary)]">
                          {p.payment_number}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-body)]">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : "-"}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          {p.party?.name || "Unknown Party"}
                          {p.party?.company_name && (
                            <span className="block text-[11px] text-[var(--text-muted)] font-normal">
                              {p.party.company_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.direction === "received" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <ArrowDownLeft className="w-3 h-3" /> Received
                            </span>
                          ) : p.direction === "contra" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                              <LinkIcon className="w-3 h-3" /> Contra Link
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <ArrowUpRight className="w-3 h-3" /> Paid
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-body)]">
                          <span className="capitalize font-medium">{p.payment_mode?.replace("_", " ")}</span>
                          {p.reference_no && (
                            <span className="block text-[11px] text-[var(--text-muted)]">
                              Ref: {p.reference_no}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                          ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-muted)]">
                          {Number(p.unallocated_amount || 0) > 0 ? (
                            <span className="text-amber-600 font-semibold">
                              ₹{Number(p.unallocated_amount).toLocaleString("en-IN")} (Advance)
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">₹0.00 (Allocated)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                            {p.status || "completed"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--table-header-bg)]">
                  <span className="text-xs text-[var(--text-muted)]">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50 hover:bg-[var(--page-bg)]"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50 hover:bg-[var(--page-bg)]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>{/* end desktop table */}
          </PageState>
        </div>
      )}

      {/* TAB 2: Advances & Credit Notes */}
      {activeTab === "advances" && <AdvancesCreditNotesTab />}

      {/* TAB 3: Direct Contra Linking */}
      {activeTab === "direct-link" && <DirectLinkingTab />}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--text-muted)]">Loading Payments Hub...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
