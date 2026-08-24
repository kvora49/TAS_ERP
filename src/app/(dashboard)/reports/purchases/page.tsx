"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  TrendingDown, Users, Package, IndianRupee, Receipt,
  RotateCcw, ChevronDown, ChevronRight, AlertCircle, Clock,
  CreditCard, FileSpreadsheet, Tag, Star
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportAreaChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, exportMultiSheetExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";
import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";
import InlineDrillDownPanel, { DrillDownItem } from "@/components/reports/InlineDrillDownPanel";
import { useAppStore } from "@/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type PurchaseTab = "all" | "raw" | "finished";
type SubTab = "register" | "category" | "ageing" | "returns" | "top_suppliers";

const PURCHASE_TABS: { id: PurchaseTab; label: string }[] = [
  { id: "all", label: "All Purchases" },
  { id: "raw", label: "Raw Materials" },
  { id: "finished", label: "Finished Goods" },
];

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: "register", label: "Purchase Register", icon: <Receipt size={13} /> },
  { id: "category", label: "Category Breakdown", icon: <Tag size={13} /> },
  { id: "ageing", label: "Payables Ageing", icon: <Clock size={13} /> },
  { id: "returns", label: "Purchase Returns", icon: <RotateCcw size={13} /> },
  { id: "top_suppliers", label: "Top Suppliers", icon: <Star size={13} /> },
];

const PAYMENT_STATUS_OPTIONS = [
  { id: "all", label: "All Status" },
  { id: "paid", label: "Paid", badgeClass: "bg-emerald-600 text-white" },
  { id: "partial", label: "Partial", badgeClass: "bg-amber-600 text-white" },
  { id: "unpaid", label: "Unpaid", badgeClass: "bg-rose-600 text-white" },
];

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  partial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  unpaid: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const TYPE_COLORS: Record<string, string> = {
  raw_material: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  finished_goods: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const CATEGORY_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchaseReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<PurchaseTab>("all");
  const [subTab, setSubTab] = useState<SubTab>("register");
  const [billType, setBillType] = useState<BillType>("all");
  const [partyId, setPartyId] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Global header filters
  const globalBrandId = useAppStore(s => s.filters.brandId);
  const globalDateRange = useAppStore(s => s.filters.dateRange);

  const { data: suppliersData } = useQuery({
    queryKey: ["parties-list-suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/parties?type=supplier");
      if (!res.ok) return { parties: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  const supplierOptions = (suppliersData?.parties ?? []).map((p: any) => ({
    label: p.company_name ? `${p.company_name} (${p.name})` : p.name,
    value: p.id,
  }));

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-purchases-v4", from, to, activeTab, billType, partyId, paymentStatus, globalBrandId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, tab: activeTab });
      if (billType !== "all") params.set("bill_type", billType);
      if (partyId !== "all") params.set("party_id", partyId);
      if (paymentStatus !== "all") params.set("payment_status", paymentStatus);
      if (globalBrandId && globalBrandId !== "all") params.set("brand_id", globalBrandId);
      const res = await fetch(`/api/reports/purchases?${params}`);
      if (!res.ok) throw new Error("Failed to load purchases report");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
    setExpandedId(null);
  }, []);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    exportMultiSheetExcel(
      [
        {
          name: "Purchase Register",
          columns: [
            { key: "purchase_number", label: "Purchase No.", width: 18 },
            { key: "invoice_date", label: "Date", format: "date", width: 14 },
            { key: "purchase_type", label: "Type", width: 14 },
            { key: "bill_type", label: "Bill Type", width: 10 },
            { key: "party", label: "Supplier", width: 30 },
            { key: "grand_total", label: "Total (Rs.)", format: "currency", width: 18 },
            { key: "paid_amount", label: "Paid (Rs.)", format: "currency", width: 18 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 18 },
            { key: "payment_status", label: "Status", width: 12 },
          ],
          rows: data.bills ?? [],
        },
        {
          name: "Purchase Returns",
          columns: [
            { key: "return_number", label: "Return No.", width: 16 },
            { key: "return_date", label: "Date", format: "date", width: 14 },
            { key: "return_type", label: "Type", width: 14 },
            { key: "party", label: "Supplier", width: 30 },
            { key: "grand_total", label: "Amount (Rs.)", format: "currency", width: 18 },
          ],
          rows: data.returns ?? [],
        },
        {
          name: "Top Suppliers",
          columns: [
            { key: "name", label: "Supplier", width: 30 },
            { key: "bills", label: "No. of Bills", format: "number", width: 14 },
            { key: "total", label: "Total Purchases (Rs.)", format: "currency", width: 20 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 20 },
          ],
          rows: data.topSuppliers ?? [],
        },
      ],
      `PurchaseReport_${activeTab}_${from}_${to}`
    );
  }, [data, activeTab, from, to]);

  const summary = data?.summary ?? {};

  const typeChartData = [
    { name: "Raw Materials", value: summary.rawTotal ?? 0, color: CHART_COLORS[4] },
    { name: "Finished Goods", value: summary.finishedTotal ?? 0, color: CHART_COLORS[0] },
  ];

  const categoryDonutData = (data?.categoryBreakdown ?? []).map((c: any, i: number) => ({
    name: c.category,
    value: c.amount,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const getPurchaseDrillItems = (p: any): DrillDownItem[] => [{
    id: p.id + "_p",
    doc_number: p.purchase_number,
    date: p.invoice_date,
    party_name: p.party,
    description: `${p.purchase_type === "raw_material" ? "Raw Material" : "Finished Goods"} · ${p.bill_type}`,
    category: p.purchase_type,
    amount: p.grand_total,
    // FIX: use view_url from API response directly
    view_url: p.view_url ?? (p.purchase_type === "raw_material" ? `/raw-materials/purchases/${p.id}` : `/purchases/${p.id}`),
    badge: p.payment_status,
    badge_color: p.payment_status === "paid" ? "emerald" : p.payment_status === "partial" ? "amber" : "rose",
  }];

  return (
    <ReportShell
      title="Purchase Reports"
      infoTooltip="Purchase analysis — Raw Materials, Finished Goods, ageing, returns, category breakdown, and payment modes."
      breadcrumbs={["Reports", "Purchase Reports"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] p-0.5 bg-[var(--table-header-bg)]">
            {PURCHASE_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setExpandedId(null); }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                  activeTab === tab.id ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-body)]"
                )}
              >{tab.label}</button>
            ))}
          </div>
          <FilterSelect label="Supplier" value={partyId} onChange={setPartyId} options={supplierOptions} placeholder="All Suppliers" />
          <FilterPills label="Payment Status" value={paymentStatus} onChange={setPaymentStatus} options={PAYMENT_STATUS_OPTIONS} />
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={billType} onChange={(v) => { setBillType(v); setExpandedId(null); }} />
          </div>
        </div>
      }
    >
      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={(error as any)?.message}
        onRetry={refetch}
        skeletonVariant="stats"
        skeletonCount={7}
        isEmpty={!isLoading && data?.summary?.totalBills === 0}
        emptyTitle="No purchases found"
        emptyDescription="No purchase records found for the selected period and filters."
      >
        {data && (
          <div className="space-y-5">
            {/* ── KPI Row ── */}
            <div className="flex md:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto snap-x snap-mandatory pb-1 md:pb-0 scrollbar-none">
              {[
                { label: "Total Purchases", value: summary.totalPurchases, color: "violet" as const, icon: <TrendingDown size={15}/> },
                { label: "Net Purchases", value: summary.netPurchases, color: "blue" as const, icon: <Package size={15}/>, subLabel: `After ${fmtINR(summary.totalReturns ?? 0)} returns` },
                { label: "Raw Materials", value: summary.rawTotal, color: "indigo" as const, icon: <Package size={15}/>, subLabel: `${summary.rawCount} bills` },
                { label: "Finished Goods", value: summary.finishedTotal, color: "slate" as const, icon: <Package size={15}/>, subLabel: `${summary.finishedCount} bills` },
                { label: "Total Paid", value: summary.totalPaid, color: "emerald" as const, icon: <IndianRupee size={15}/> },
                { label: "Outstanding", value: summary.totalOutstanding, color: "rose" as const, icon: <AlertCircle size={15}/> },
                { label: "Purchase Returns", value: summary.totalReturns, color: "amber" as const, icon: <RotateCcw size={15}/>, subLabel: `${summary.returnCount} returns` },
              ].map((kpi) => (
                <div key={kpi.label} className="snap-start shrink-0 w-[148px] md:w-auto">
                  <ReportKPICard {...kpi} />
                </div>
              ))}
            </div>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2 space-y-4">
                {/* Trend Chart */}
                {(data.monthlyTrend ?? []).length > 1 && (
                  <ChartCard title="Purchase Trend (Monthly)">
                    <ReportAreaChart
                      data={data.monthlyTrend}
                      xKey="month"
                      lines={[
                        { key: "total", label: "Gross Purchases", color: CHART_COLORS[4] },
                        { key: "returns", label: "Returns", color: CHART_COLORS[3] },
                        { key: "net", label: "Net Purchases", color: CHART_COLORS[0] },
                      ]}
                      height={200}
                    />
                  </ChartCard>
                )}

                {/* Sub-tabs */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] overflow-x-auto scrollbar-none">
                    {SUB_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => { setSubTab(tab.id); setExpandedId(null); }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0",
                          subTab === tab.id ? "bg-[var(--primary)] text-white shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-body)]"
                        )}
                      >
                        {tab.icon}{tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Purchase Register */}
                  {subTab === "register" && (
                    <div>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-3 w-8"></th>
                              {["Invoice No.", "Date", "Type", "Supplier", "Total", "Paid", "Outstanding", "Status"].map(h => (
                                <th key={h} className={`py-2.5 px-3 whitespace-nowrap ${["Total","Paid","Outstanding"].includes(h) ? "text-right" : ""}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="text-[var(--text-body)]">
                            {(data.bills ?? []).map((p: any) => (
                              <React.Fragment key={p.id}>
                                <tr
                                  className="hover:bg-[var(--table-row-hover)] border-b border-[var(--border-light)] cursor-pointer h-10"
                                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                >
                                  <td className="py-2 px-3">
                                    {expandedId === p.id ? <ChevronDown size={13} className="text-[var(--primary)]" /> : <ChevronRight size={13} className="text-[var(--text-faint)]" />}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-bold">
                                    {p.purchase_type === "raw_material"
                                      ? <Link href={`/raw-materials/purchases/${p.id}`} onClick={e => e.stopPropagation()} className="text-[var(--primary)] hover:underline">{p.purchase_number}</Link>
                                      : <span className="text-[var(--text-primary)]">{p.purchase_number}</span>}
                                  </td>
                                  <td className="py-2 px-3 text-[var(--text-muted)] whitespace-nowrap">{fmtDate(p.invoice_date)}</td>
                                  <td className="py-2 px-3">
                                    <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border", TYPE_COLORS[p.purchase_type] ?? "")}>
                                      {p.purchase_type === "raw_material" ? "Raw Mat." : "Fin. Goods"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 max-w-[130px] truncate font-semibold">
                                    {p.party_id
                                      ? <Link href={`/parties/${p.party_id}/ledger`} onClick={e => e.stopPropagation()} className="hover:underline text-[var(--text-primary)]">{p.party}</Link>
                                      : p.party}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold">{fmtINR(p.grand_total)}</td>
                                  <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmtINR(p.paid_amount)}</td>
                                  <td className="py-2 px-3 text-right font-mono text-rose-600">{fmtINR(p.outstanding)}</td>
                                  <td className="py-2 px-3">
                                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_COLORS[p.payment_status] ?? "")}>
                                      {p.payment_status}
                                    </span>
                                  </td>
                                </tr>
                                <AnimatePresence>
                                  {expandedId === p.id && (
                                    <tr>
                                      <td colSpan={9} className="p-0">
                                        <InlineDrillDownPanel
                                          id={p.id}
                                          title={`Purchase ${p.purchase_number} — Detail`}
                                          subtitle={`${p.party} · ${p.purchase_type === "raw_material" ? "Raw Material" : "Finished Goods"} · ${fmtDate(p.invoice_date)}`}
                                          totalAmount={p.grand_total}
                                          amountType="negative"
                                          items={getPurchaseDrillItems(p)}
                                          moduleLink={p.purchase_type === "raw_material" ? { label: "Open Purchase", href: `/raw-materials/purchases/${p.id}` } : undefined}
                                          onClose={() => setExpandedId(null)}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </AnimatePresence>
                              </React.Fragment>
                            ))}
                            {(data.bills ?? []).length === 0 && (
                              <tr><td colSpan={9} className="py-10 text-center text-[var(--text-muted)]">No purchases found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)]">{(data.bills ?? []).length} records · Click a row to drill down</span>
                        <button onClick={handleExportExcel} className="flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-bold rounded-md border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer">
                          <FileSpreadsheet size={12}/> Excel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Category Breakdown */}
                  {subTab === "category" && (
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-[var(--text-muted)]">Purchase value by material category across all raw material purchases in the period.</p>
                      {(data.categoryBreakdown ?? []).length === 0 ? (
                        <div className="py-10 text-center text-[var(--text-muted)] text-xs">
                          <Tag size={28} className="mx-auto mb-2 opacity-30" />
                          <p className="font-semibold">No category data available</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {(data.categoryBreakdown ?? []).map((c: any, i: number) => (
                              <div key={c.key} className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-3 text-center">
                                <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-0.5">{c.category}</p>
                                <p className="text-sm font-black font-mono" style={{ color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}>{fmtINR(c.amount)}</p>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5 mt-2">
                            {(data.categoryBreakdown ?? []).map((c: any, i: number) => {
                              const pct = summary.rawTotal > 0 ? (c.amount / summary.rawTotal) * 100 : 0;
                              return (
                                <div key={c.key} className="flex items-center gap-3">
                                  <div className="w-24 text-xs font-bold text-[var(--text-body)] shrink-0">{c.category}</div>
                                  <div className="flex-1 bg-[var(--table-header-bg)] rounded-full h-2 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                                  </div>
                                  <div className="text-right w-32">
                                    <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{fmtINR(c.amount)}</span>
                                    <span className="text-[10px] text-[var(--text-faint)] ml-1">({pct.toFixed(1)}%)</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Payables Ageing */}
                  {subTab === "ageing" && (
                    <div className="p-4 space-y-4">
                      <p className="text-xs text-[var(--text-muted)]">Outstanding payables bucketed by age from invoice date.</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                          { label: "Current", value: data.ageing?.current, color: "text-emerald-600" },
                          { label: "1–30 Days", value: data.ageing?.d30, color: "text-blue-600" },
                          { label: "31–60 Days", value: data.ageing?.d60, color: "text-amber-600" },
                          { label: "61–90 Days", value: data.ageing?.d90, color: "text-orange-600" },
                          { label: "90+ Days", value: data.ageing?.over90, color: "text-rose-600" },
                        ].map((bucket) => (
                          <div key={bucket.label} className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-3.5 text-center">
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mb-1">{bucket.label}</p>
                            <p className={`text-base font-black font-mono ${bucket.color}`}>{fmtINR(bucket.value ?? 0)}</p>
                          </div>
                        ))}
                      </div>
                      <InlineDrillDownPanel
                        id="payables-all"
                        title="All Outstanding Payables"
                        subtitle="Purchases with pending payment"
                        totalAmount={summary.totalOutstanding ?? 0}
                        amountType="negative"
                        items={(data.bills ?? []).filter((p: any) => p.payment_status !== "paid").map((p: any) => ({
                          id: p.id,
                          doc_number: p.purchase_number,
                          date: p.invoice_date,
                          party_name: p.party,
                          description: `${p.purchase_type === "raw_material" ? "Raw Mat." : "Fin. Goods"} · ${p.payment_status}`,
                          category: p.payment_status,
                          amount: p.outstanding,
                          view_url: p.purchase_type === "raw_material" ? `/raw-materials/purchases/${p.id}` : undefined,
                          badge: p.payment_status,
                          badge_color: p.payment_status === "partial" ? "amber" : "rose",
                        }))}
                        onClose={() => setSubTab("register")}
                      />
                    </div>
                  )}

                  {/* Purchase Returns */}
                  {subTab === "returns" && (
                    <div>
                      {(data.returns ?? []).length === 0 ? (
                        <div className="py-12 text-center text-[var(--text-muted)] text-xs">
                          <RotateCcw size={28} className="mx-auto mb-2 opacity-30" />
                          <p className="font-semibold">No purchase returns in this period</p>
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                              {["Return No.", "Date", "Type", "Supplier", "Amount"].map(h => (
                                <th key={h} className={`py-2.5 px-4 ${h === "Amount" ? "text-right" : ""}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                            {(data.returns ?? []).map((r: any) => (
                              <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                                <td className="py-2 px-4 font-mono font-bold text-[var(--primary)]">{r.return_number}</td>
                                <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(r.return_date)}</td>
                                <td className="py-2 px-4 capitalize text-[var(--text-muted)]">{r.return_type?.replace(/_/g, " ")}</td>
                                <td className="py-2 px-4 font-semibold">{r.party}</td>
                                <td className="py-2 px-4 text-right font-mono font-bold text-rose-600">{fmtINR(r.grand_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                              <td colSpan={4} className="py-2.5 px-4 text-xs text-[var(--text-muted)]">Total Returns ({data.returns?.length})</td>
                              <td className="py-2.5 px-4 text-right font-mono text-rose-600">{fmtINR(summary.totalReturns ?? 0)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Top Suppliers */}
                  {subTab === "top_suppliers" && (
                    <div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">#</th>
                            <th className="py-2.5 px-4">Supplier</th>
                            <th className="py-2.5 px-4 text-center">Bills</th>
                            <th className="py-2.5 px-4 text-right">Purchases</th>
                            <th className="py-2.5 px-4 text-right">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(data.topSuppliers ?? []).map((s: any, i: number) => (
                            <tr key={s.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-4 text-[var(--text-faint)] font-bold">{i + 1}</td>
                              <td className="py-2 px-4 font-bold text-[var(--text-primary)]">
                                {s.id && s.id !== "unknown"
                                  ? <Link href={`/parties/${s.id}/ledger`} className="hover:underline text-[var(--primary)]">{s.name}</Link>
                                  : s.name}
                              </td>
                              <td className="py-2 px-4 text-center text-[var(--text-muted)]">{s.bills}</td>
                              <td className="py-2 px-4 text-right font-mono font-bold text-violet-600">{fmtINR(s.total)}</td>
                              <td className="py-2 px-4 text-right font-mono text-rose-600">{fmtINR(s.outstanding)}</td>
                            </tr>
                          ))}
                          {(data.topSuppliers ?? []).length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">No suppliers found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: sidebar charts */}
              <div className="space-y-4">
                {/* Raw vs Finished split */}
                {activeTab === "all" && (
                  <ChartCard title="Raw vs Finished Split">
                    <ReportDonutChart
                      data={typeChartData.filter(d => d.value > 0)}
                      height={180}
                      innerRadius={45}
                      outerRadius={70}
                      valueFormat="currency"
                    />
                    <div className="mt-3 space-y-1.5">
                      {[
                        { label: `Raw Material (${summary.rawCount})`, value: summary.rawTotal ?? 0 },
                        { label: `Finished Goods (${summary.finishedCount})`, value: summary.finishedTotal ?? 0 },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">{r.label}</span>
                          <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(r.value)}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}

                {/* Category donut */}
                {categoryDonutData.length > 0 && (
                  <ChartCard title="Category Breakdown">
                    <ReportDonutChart
                      data={categoryDonutData}
                      height={180}
                      innerRadius={45}
                      outerRadius={70}
                      valueFormat="currency"
                    />
                  </ChartCard>
                )}

                {/* Summary box */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Purchase Summary</h3>
                  {[
                    { label: "Gross Purchases", value: fmtINR(summary.totalPurchases ?? 0), cls: "text-[var(--text-primary)]" },
                    { label: "Less: Returns", value: `(${fmtINR(summary.totalReturns ?? 0)})`, cls: "text-rose-500" },
                    { label: "Net Purchases", value: fmtINR(summary.netPurchases ?? 0), cls: "text-violet-600 font-black" },
                    { label: "Total Paid", value: fmtINR(summary.totalPaid ?? 0), cls: "text-emerald-600" },
                    { label: "Outstanding", value: fmtINR(summary.totalOutstanding ?? 0), cls: "text-rose-600" },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                      <span className="text-[var(--text-muted)]">{r.label}</span>
                      <span className={`font-bold font-mono ${r.cls}`}>{r.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Export Full Report</h3>
                  <button
                    onClick={handleExportExcel}
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet size={14} /> Export Excel (3 sheets)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageState>
    </ReportShell>
  );
}
