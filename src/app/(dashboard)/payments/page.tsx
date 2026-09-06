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
  Eye,
  CreditCard,
  Share2,
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import AdvancesCreditNotesTab from "@/components/payments/AdvancesCreditNotesTab";
import DirectLinkingTab from "@/components/payments/DirectLinkingTab";
import ReportTabs from "@/components/reports/ReportTabs";
import { PullToRefresh } from "@/components/shared/PullToRefresh";
import { cn } from "@/lib/utils";
import { MobileCompactRow } from "@/components/shared/MobileCompactRow";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { shareContent } from "@/lib/share";

function PaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab State
  const currentTab = searchParams.get("tab") || "history";
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  // Filters for History Tab
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);

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
    queryKey: ["payments-list-overview", directionFilter, page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/payments?direction=${directionFilter}&page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to load payments history");
      return res.json();
    },
    enabled: activeTab === "history",
  });

  const payments = data?.payments || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const hasMoreMobile = payments.length < totalCount;
  const { sentinelRef } = useInfiniteScroll<HTMLDivElement>({
    enabled: hasMoreMobile && !isLoading,
    onIntersect: () => {
      setLimit((prev) => Math.min(prev + 15, 100));
    },
  });

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

  // Share payment voucher handler
  const handleSharePayment = async (p: any) => {
    const partyName = p.party?.name || "Party";
    const isReceived = p.direction === "received";
    const directionLabel = isReceived ? "Payment Receipt" : "Payment Voucher";
    const formattedAmount = `₹${Number(p.amount || 0).toLocaleString("en-IN")}`;
    const voucherUrl = typeof window !== "undefined" ? window.location.href : "";

    await shareContent({
      title: `${directionLabel} ${p.payment_number}`,
      text: `${directionLabel} ${p.payment_number} for ${partyName} - ${formattedAmount} via ${p.payment_mode?.replace("_", " ")}${p.reference_no ? ` (Ref: ${p.reference_no})` : ""}`,
      url: voucherUrl,
    });
  };

  return (
    <PullToRefresh onRefresh={async () => { await refetch(); }}>
      <div className="p-2.5 sm:p-6 max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
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
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Link
            href="/payments/receive"
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl hover:bg-[var(--primary-dark)] transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Receive Payment</span>
          </Link>

          <Link
            href="/payments/make"
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl hover:bg-[var(--table-row-hover)] transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
            <span>Make Payment</span>
          </Link>

          <Link
            href="/payments/direct-link"
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl hover:bg-[var(--table-row-hover)] transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <LinkIcon className="w-3.5 h-3.5 text-emerald-500" />
            <span>Direct Linking</span>
          </Link>
        </div>
      </div>

      {/* Workspace Section Tabs with ReportTabs */}
      <ReportTabs
        tabs={[
          { id: "history", label: "Vouchers & History", icon: <Wallet size={14} /> },
          { id: "advances", label: "Advances & Credit Notes", icon: <Clock size={14} /> },
          { id: "direct-link", label: "Direct Payment Linking", icon: <LinkIcon size={14} /> },
        ]}
        activeTab={activeTab}
        onChange={handleTabChange}
        layoutIdPrefix="payments-workspace-tab"
      />

      {/* TAB 1: Payment History */}
      {activeTab === "history" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Responsive 3-Column KPI Stats Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3.5 transition-all hover:border-[var(--primary)]/30">
              <div className="p-2 sm:p-2.5 bg-emerald-500/10 rounded-lg w-fit shrink-0">
                <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight block truncate">
                  Total Received
                </span>
                <p className="text-xs sm:text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 truncate font-mono leading-tight">
                  ₹{totalReceived.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3.5 transition-all hover:border-[var(--primary)]/30">
              <div className="p-2 sm:p-2.5 bg-amber-500/10 rounded-lg w-fit shrink-0">
                <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight block truncate">
                  Total Paid Out
                </span>
                <p className="text-xs sm:text-lg md:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5 truncate font-mono leading-tight">
                  ₹{totalPaid.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 sm:p-4 shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3.5 transition-all hover:border-[var(--primary)]/30">
              <div className="p-2 sm:p-2.5 bg-[var(--primary-light)] rounded-lg w-fit shrink-0">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--primary)]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight block truncate">
                  Active Advances
                </span>
                <p className="text-xs sm:text-lg md:text-xl font-black text-[var(--primary)] mt-0.5 truncate font-mono leading-tight">
                  ₹{totalAdvances.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

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

          {/* ── MOBILE: High-Density Compact Payment Row List ── */}
          <div className="md:hidden bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs divide-y divide-[var(--border-light)]">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)] italic">
                No payment vouchers found.
              </div>
            ) : (
              payments.map((p) => {
                const isReceived = p.direction === "received";
                const isContra = p.direction === "contra";

                return (
                  <MobileCompactRow
                    key={p.id}
                    title={p.party?.name || "Unknown Party"}
                    subtitle={`${p.payment_number} • ${p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-IN") : "—"} • ${p.payment_mode?.replace("_", " ")}`}
                    value={
                      <span className={cn("font-mono", isReceived ? "text-[var(--badge-green-text)]" : isContra ? "text-[var(--badge-blue-text)]" : "text-[var(--badge-orange-text)]")}>
                        ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                      </span>
                    }
                    subValue={Number(p.unallocated_amount || 0) > 0 ? `Unalloc: ₹${Number(p.unallocated_amount).toLocaleString("en-IN")}` : undefined}
                    badge={
                      isReceived ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]">
                          <ArrowDownLeft className="w-3 h-3" /> Received
                        </span>
                      ) : isContra ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]">
                          <LinkIcon className="w-3 h-3" /> Contra
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]">
                          <ArrowUpRight className="w-3 h-3" /> Paid
                        </span>
                      )
                    }
                    onClick={() => {
                      if (p.party_id) router.push(`/parties/${p.party_id}`);
                    }}
                    leftAction={p.party_id ? {
                      label: "Party",
                      icon: <Eye size={14} />,
                      bgClass: "bg-indigo-600 text-white",
                      onAction: () => router.push(`/parties/${p.party_id}`),
                    } : undefined}
                    rightAction={{
                      label: "Share",
                      icon: <Share2 size={14} />,
                      bgClass: "bg-[var(--primary)] text-white",
                      onAction: () => handleSharePayment(p),
                    }}
                  />
                );
              })
            )}
            {hasMoreMobile && (
              <div ref={sentinelRef} className="py-3 flex justify-center items-center text-xs text-[var(--text-muted)] font-medium">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse mr-2" />
                Loading more payment vouchers...
              </div>
            )}
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
            skeletonColumns={9}
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
                      <th className="px-4 py-3 text-right">Actions</th>
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
                            <span className="text-emerald-600 font-semibold">₹0.00 (Fully Allocated)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                            {p.status || "completed"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSharePayment(p)}
                            title="Share Payment Voucher"
                            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] hover:bg-[var(--table-row-hover)] transition-all cursor-pointer inline-flex items-center justify-center"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
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
    </PullToRefresh>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--text-muted)]">Loading Payments Hub...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
