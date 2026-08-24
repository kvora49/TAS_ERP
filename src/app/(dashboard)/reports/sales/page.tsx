"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  TrendingUp, Users, ShoppingBag, IndianRupee, Receipt,
  RotateCcw, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Clock,
  CreditCard, FileText, FileSpreadsheet, Star
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportAreaChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, exportMultiSheetExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";
import BillTypeFilter from "@/components/reports/BillTypeFilter";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";
import InlineDrillDownPanel, { DrillDownItem } from "@/components/reports/InlineDrillDownPanel";
import { useAppStore } from "@/store";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillTypeTab = "all" | "kacha" | "pakka";
type SubTab = "register" | "ageing" | "returns" | "payment_modes" | "top_customers";

const BILL_TABS: { id: BillTypeTab; label: string }[] = [
  { id: "all", label: "Combined" },
  { id: "kacha", label: "Kaacha" },
  { id: "pakka", label: "Pakka" },
];

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: "register", label: "Bill Register", icon: <Receipt size={13} /> },
  { id: "ageing", label: "Ageing Analysis", icon: <Clock size={13} /> },
  { id: "returns", label: "Sales Returns", icon: <RotateCcw size={13} /> },
  { id: "payment_modes", label: "Payment Modes", icon: <CreditCard size={13} /> },
  { id: "top_customers", label: "Top Customers", icon: <Star size={13} /> },
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
  overdue: "bg-red-500/10 text-red-600 border-red-500/20",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<BillTypeTab>("all");
  const [subTab, setSubTab] = useState<SubTab>("register");
  const [partyId, setPartyId] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  // Global header filters
  const globalBrandId = useAppStore(s => s.filters.brandId);

  const { data: partiesData } = useQuery({
    queryKey: ["parties-list-customers"],
    queryFn: async () => {
      const res = await fetch("/api/parties?type=customer");
      if (!res.ok) return { parties: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  const partyOptions = (partiesData?.parties ?? []).map((p: any) => ({
    label: p.company_name ? `${p.company_name} (${p.name})` : p.name,
    value: p.id,
  }));

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-sales-v4", from, to, activeTab, partyId, paymentStatus, globalBrandId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (activeTab !== "all") params.set("bill_type", activeTab);
      if (partyId !== "all") params.set("party_id", partyId);
      if (paymentStatus !== "all") params.set("payment_status", paymentStatus);
      if (globalBrandId && globalBrandId !== "all") params.set("brand_id", globalBrandId);
      const res = await fetch(`/api/reports/sales?${params}`);
      if (!res.ok) throw new Error("Failed to load sales report");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
    setExpandedBillId(null);
  }, []);

  // ── Exports ────────────────────────────────────────────────────────────────
  const handleExportExcel = useCallback(() => {
    if (!data) return;
    exportMultiSheetExcel(
      [
        {
          name: "Bill Register",
          columns: [
            { key: "bill_number", label: "Bill No.", width: 16 },
            { key: "bill_date", label: "Date", format: "date", width: 14 },
            { key: "bill_type", label: "Type", width: 10 },
            { key: "party", label: "Customer", width: 30 },
            { key: "taxable_amount", label: "Taxable (Rs.)", format: "currency", width: 18 },
            { key: "cgst", label: "CGST", format: "currency", width: 12 },
            { key: "sgst", label: "SGST", format: "currency", width: 12 },
            { key: "igst", label: "IGST", format: "currency", width: 12 },
            { key: "grand_total", label: "Grand Total (Rs.)", format: "currency", width: 18 },
            { key: "paid_amount", label: "Paid (Rs.)", format: "currency", width: 18 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 18 },
            { key: "payment_status", label: "Status", width: 12 },
          ],
          rows: data.bills ?? [],
        },
        {
          name: "Sales Returns",
          columns: [
            { key: "return_number", label: "Return No.", width: 16 },
            { key: "return_date", label: "Date", format: "date", width: 14 },
            { key: "party", label: "Customer", width: 30 },
            { key: "grand_total", label: "Amount (Rs.)", format: "currency", width: 18 },
            { key: "status", label: "Status", width: 12 },
          ],
          rows: data.returns ?? [],
        },
        {
          name: "Top Customers",
          columns: [
            { key: "name", label: "Customer", width: 30 },
            { key: "bills", label: "No. of Bills", format: "number", width: 14 },
            { key: "total", label: "Total Revenue (Rs.)", format: "currency", width: 20 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 20 },
          ],
          rows: data.topParties ?? [],
        },
      ],
      `SalesReport_${activeTab}_${from}_${to}`
    );
  }, [data, activeTab, from, to]);

  const summary = data?.summary ?? {};
  const kachaVsPakka = [
    { name: "Kaacha", value: summary.kachaRevenue ?? 0, color: CHART_COLORS[2] },
    { name: "Pakka", value: summary.pakkaRevenue ?? 0, color: CHART_COLORS[0] },
  ];

  // Build drill-down items for a single bill row
  const getBillDrillItems = (bill: any): DrillDownItem[] => [
    {
      id: bill.id + "_bill",
      doc_number: bill.bill_number,
      date: bill.bill_date,
      party_name: bill.party,
      description: `${bill.bill_type === "pakka" ? "Pakka" : "Kaacha"} Bill`,
      category: bill.bill_type,
      amount: bill.grand_total,
      // Prefer view_url from API, fallback to constructed path
      view_url: bill.view_url ?? `/sales/${bill.id}`,
      badge: bill.payment_status,
      badge_color:
        bill.payment_status === "paid" ? "emerald"
        : bill.payment_status === "partial" ? "amber"
        : "rose",
    },
  ];

  const allBillsDrillItems: DrillDownItem[] = (data?.bills ?? []).map((b: any) => ({
    id: b.id,
    doc_number: b.bill_number,
    date: b.bill_date,
    party_name: b.party,
    description: `${b.bill_type === "pakka" ? "Pakka" : "Kaacha"} Bill`,
    category: b.bill_type,
    amount: b.grand_total,
    view_url: b.view_url ?? `/sales/${b.id}`,
    badge: b.payment_status,
    badge_color:
      b.payment_status === "paid" ? "emerald"
      : b.payment_status === "partial" ? "amber"
      : "rose",
  }));

  return (
    <ReportShell
      title="Sales Reports"
      infoTooltip="Sales bills analysis — Kaacha, Pakka and Combined view with trends, ageing, returns, and payment modes."
      breadcrumbs={["Reports", "Sales Reports"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Customer"
            value={partyId}
            onChange={setPartyId}
            options={partyOptions}
            placeholder="All Customers"
          />
          <FilterPills
            label="Payment Status"
            value={paymentStatus}
            onChange={setPaymentStatus}
            options={PAYMENT_STATUS_OPTIONS}
          />
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={activeTab} onChange={(v) => { setActiveTab(v); setExpandedBillId(null); }} />
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
        emptyTitle="No sales bills found"
        emptyDescription={`No ${activeTab === "all" ? "" : activeTab + " "}bills found for the selected period.`}
      >
        {data && (
          <div className="space-y-5">
            {/* ── KPI Row ─────────────────────────────────────────────────────── */}
            <div className="flex md:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto snap-x snap-mandatory pb-1 md:pb-0 scrollbar-none">
              {[
                { label: "Gross Sales", value: summary.grossSales, color: "emerald" as const, icon: <TrendingUp size={15}/> },
                { label: "Net Sales", value: summary.netSales, color: "blue" as const, icon: <TrendingUp size={15}/>, subLabel: `After ${fmtINR(summary.totalReturns ?? 0)} returns` },
                { label: "Total GST", value: summary.totalGST, color: "violet" as const, icon: <Receipt size={15}/> },
                { label: "Total Received", value: summary.totalPaid, color: "indigo" as const, icon: <CheckCircle size={15}/>, subLabel: `${summary.collectionRate ?? 0}% collection rate` },
                { label: "Outstanding", value: summary.totalOutstanding, color: "rose" as const, icon: <AlertCircle size={15}/>, subLabel: `Pakka: ${fmtINR(summary.pakkaOutstanding ?? 0)}` },
                { label: "Sales Returns", value: summary.totalReturns, color: "amber" as const, icon: <RotateCcw size={15}/>, subLabel: `${summary.returnCount ?? 0} credit notes` },
                { label: "Avg. Bill Value", value: summary.avgBillValue, color: "slate" as const, icon: <IndianRupee size={15}/>, subLabel: `${summary.totalBills} bills total` },
              ].map((kpi) => (
                <div key={kpi.label} className="snap-start shrink-0 w-[148px] md:w-auto">
                  <ReportKPICard {...kpi} />
                </div>
              ))}
            </div>

            {/* ── Quick Insights Strip ─────────────────────────────────────────── */}
            {data.quickInsights && (
              <div className="flex flex-wrap gap-3">
                {data.quickInsights.bestDay && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs">
                    <Star size={12} className="text-amber-500 shrink-0" />
                    <span className="text-[var(--text-muted)]">Best Day:</span>
                    <span className="font-bold text-[var(--text-primary)]">{fmtDate(data.quickInsights.bestDay.date)}</span>
                    <span className="font-mono font-bold text-emerald-600">{fmtINR(data.quickInsights.bestDay.amount)}</span>
                  </div>
                )}
                {data.quickInsights.topCustomer && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs">
                    <Users size={12} className="text-blue-500 shrink-0" />
                    <span className="text-[var(--text-muted)]">Top Customer:</span>
                    <span className="font-bold text-[var(--text-primary)]">{data.quickInsights.topCustomer.name}</span>
                    <span className="font-mono font-bold text-blue-600">{fmtINR(data.quickInsights.topCustomer.amount)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] text-xs">
                  <ShoppingBag size={12} className="text-violet-500 shrink-0" />
                  <span className="text-[var(--text-muted)]">Collection Rate:</span>
                  <span className="font-bold font-mono text-violet-600">{data.quickInsights.collectionRate ?? 0}%</span>
                </div>
              </div>
            )}

            {/* ── Main Grid ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Left col: Sub-tabs + content */}
              <div className="xl:col-span-2 space-y-4">
                {/* Trend Chart */}
                {(data.monthlyTrend ?? []).length > 1 && (
                  <ChartCard title="Sales Trend (Monthly)">
                    <ReportAreaChart
                      data={data.monthlyTrend}
                      xKey="month"
                      lines={[
                        { key: "total", label: "Gross Sales", color: CHART_COLORS[0] },
                        { key: "returns", label: "Returns", color: CHART_COLORS[3] },
                        { key: "net", label: "Net Sales", color: CHART_COLORS[1] },
                      ]}
                      height={200}
                    />
                  </ChartCard>
                )}

                {/* Sub-tab navigation */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--border)] overflow-x-auto scrollbar-none">
                    {SUB_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => { setSubTab(tab.id); setExpandedBillId(null); }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0",
                          subTab === tab.id
                            ? "bg-[var(--primary)] text-white shadow-sm"
                            : "text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-body)]"
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Tab: Bill Register ── */}
                  {subTab === "register" && (
                    <div>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-4 w-8"></th>
                              {["Bill No.", "Date", "Type", "Customer", "Taxable", "GST", "Total", "Paid", "Outstanding", "Status"].map((h) => (
                                <th key={h} className={`py-2.5 px-3 whitespace-nowrap ${["Taxable","GST","Total","Paid","Outstanding"].includes(h) ? "text-right" : ""}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="text-[var(--text-body)]">
                            {(data.bills ?? []).map((b: any) => (
                              <React.Fragment key={b.id}>
                                <tr
                                  className="hover:bg-[var(--table-row-hover)] border-b border-[var(--border-light)] cursor-pointer h-10"
                                  onClick={() => setExpandedBillId(expandedBillId === b.id ? null : b.id)}
                                >
                                  <td className="py-2 px-3">
                                    {expandedBillId === b.id
                                      ? <ChevronDown size={13} className="text-[var(--primary)]" />
                                      : <ChevronRight size={13} className="text-[var(--text-faint)]" />}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-bold">
                                    <Link href={`/sales/bills/${b.id}`} onClick={e => e.stopPropagation()} className="text-[var(--primary)] hover:underline">{b.bill_number}</Link>
                                  </td>
                                  <td className="py-2 px-3 text-[var(--text-muted)] whitespace-nowrap">{fmtDate(b.bill_date)}</td>
                                  <td className="py-2 px-3">
                                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                      b.bill_type === "pakka" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                                      {b.bill_type === "pakka" ? "Pakka" : "Kaacha"}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 max-w-[130px] truncate font-semibold">
                                    {b.party_id
                                      ? <Link href={`/parties/${b.party_id}/ledger`} onClick={e => e.stopPropagation()} className="hover:underline text-[var(--text-primary)]">{b.party}</Link>
                                      : b.party}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">{fmtINR(b.taxable_amount)}</td>
                                  <td className="py-2 px-3 text-right font-mono text-violet-600">{fmtINR(b.total_gst)}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold">{fmtINR(b.grand_total)}</td>
                                  <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmtINR(b.paid_amount)}</td>
                                  <td className="py-2 px-3 text-right font-mono text-rose-600">{fmtINR(b.outstanding)}</td>
                                  <td className="py-2 px-3">
                                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_COLORS[b.payment_status] ?? "")}>
                                      {b.payment_status}
                                    </span>
                                  </td>
                                </tr>
                                <AnimatePresence>
                                  {expandedBillId === b.id && (
                                    <tr>
                                      <td colSpan={11} className="p-0">
                                        <InlineDrillDownPanel
                                          id={b.id}
                                          title={`Bill ${b.bill_number} — Transaction Detail`}
                                          subtitle={`${b.party} · ${b.bill_type === "pakka" ? "Pakka" : "Kaacha"} · ${fmtDate(b.bill_date)}`}
                                          totalAmount={b.grand_total}
                                          amountType="positive"
                                          items={getBillDrillItems(b)}
                                          moduleLink={{ label: "Open Bill", href: `/sales/bills/${b.id}` }}
                                          onClose={() => setExpandedBillId(null)}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </AnimatePresence>
                              </React.Fragment>
                            ))}
                            {(data.bills ?? []).length === 0 && (
                              <tr><td colSpan={11} className="py-10 text-center text-[var(--text-muted)]">No bills found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {/* Mobile cards */}
                      <div className="md:hidden divide-y divide-[var(--border-light)]">
                        {(data.bills ?? []).slice(0, 20).map((b: any) => (
                          <div key={b.id} className="p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Link href={`/sales/bills/${b.id}`} className="font-mono font-black text-xs text-[var(--primary)] hover:underline">{b.bill_number}</Link>
                              <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_COLORS[b.payment_status] ?? "")}>{b.payment_status}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-[var(--text-primary)] truncate max-w-[55%]">{b.party}</span>
                              <span className="text-[var(--text-muted)]">{fmtDate(b.bill_date)}</span>
                            </div>
                            <div className="grid grid-cols-3 text-center border-t border-[var(--border-light)] pt-1.5">
                              {[["Total", fmtINR(b.grand_total), "text-[var(--text-primary)]"], ["Paid", fmtINR(b.paid_amount), "text-emerald-500"], ["Due", fmtINR(b.outstanding), "text-rose-500"]].map(([lbl, val, cls]) => (
                                <div key={lbl}><p className="text-[9px] font-bold text-[var(--text-faint)] uppercase">{lbl}</p><p className={`text-xs font-bold mt-0.5 ${cls}`}>{val}</p></div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Export current tab */}
                      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)]">{(data.bills ?? []).length} bills · Click a row to drill down</span>
                        <div className="flex items-center gap-2">
                          <button onClick={handleExportExcel} className="flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-bold rounded-md border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer">
                            <FileSpreadsheet size={12}/> Excel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Tab: Ageing Analysis ── */}
                  {subTab === "ageing" && (
                    <div className="p-4 space-y-4">
                      <p className="text-xs text-[var(--text-muted)]">Outstanding receivables bucketed by days overdue from bill/due date.</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {[
                          { label: "Current (Not Due)", value: data.ageing?.current, color: "text-emerald-600" },
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
                      <div className="mt-2">
                        <InlineDrillDownPanel
                          id="ageing-all"
                          title="All Outstanding Bills"
                          subtitle="Bills with pending payment — click Export to download as PDF or Excel"
                          totalAmount={summary.totalOutstanding ?? 0}
                          amountType="negative"
                          items={(data.bills ?? []).filter((b: any) => b.payment_status !== "paid").map((b: any) => ({
                            id: b.id,
                            doc_number: b.bill_number,
                            date: b.bill_date,
                            party_name: b.party,
                            description: `${b.bill_type === "pakka" ? "Pakka" : "Kaacha"} · ${b.payment_status}`,
                            category: b.payment_status,
                            amount: b.outstanding,
                            view_url: `/sales/bills/${b.id}`,
                            badge: b.payment_status,
                            badge_color: b.payment_status === "partial" ? "amber" : "rose",
                          }))}
                          onClose={() => setSubTab("register")}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Tab: Sales Returns ── */}
                  {subTab === "returns" && (
                    <div>
                      {(data.returns ?? []).length === 0 ? (
                        <div className="py-12 text-center text-[var(--text-muted)] text-xs">
                          <RotateCcw size={28} className="mx-auto mb-2 opacity-30" />
                          <p className="font-semibold">No sales returns in this period</p>
                        </div>
                      ) : (
                        <>
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                                {["Return No.", "Date", "Customer", "Amount", "Status"].map(h => (
                                  <th key={h} className={`py-2.5 px-4 ${h === "Amount" ? "text-right" : ""}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                              {(data.returns ?? []).map((r: any) => (
                                <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                                  <td className="py-2 px-4 font-mono font-bold text-[var(--primary)]">{r.return_number}</td>
                                  <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(r.return_date)}</td>
                                  <td className="py-2 px-4 font-semibold">{r.party}</td>
                                  <td className="py-2 px-4 text-right font-mono font-bold text-rose-600">{fmtINR(r.grand_total)}</td>
                                  <td className="py-2 px-4 capitalize text-[var(--text-muted)]">{r.status}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                                <td colSpan={3} className="py-2.5 px-4 text-xs text-[var(--text-muted)]">Total Returns ({data.returns?.length})</td>
                                <td className="py-2.5 px-4 text-right font-mono text-rose-600">{fmtINR(summary.totalReturns ?? 0)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Tab: Payment Modes ── */}
                  {subTab === "payment_modes" && (
                    <div className="p-4">
                      {(data.paymentModeSummary ?? []).length === 0 ? (
                        <div className="py-10 text-center text-[var(--text-muted)] text-xs">
                          <CreditCard size={28} className="mx-auto mb-2 opacity-30" />
                          <p className="font-semibold">No payment data in this period</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(data.paymentModeSummary ?? []).map((pm: any, i: number) => {
                            const pct = summary.totalPaid > 0 ? (pm.amount / summary.totalPaid) * 100 : 0;
                            return (
                              <div key={pm.mode} className="flex items-center gap-3">
                                <div className="w-28 text-xs font-bold text-[var(--text-body)] shrink-0">{pm.mode}</div>
                                <div className="flex-1 bg-[var(--table-header-bg)] rounded-full h-2 overflow-hidden">
                                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="w-28 text-right">
                                  <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{fmtINR(pm.amount)}</span>
                                  <span className="text-[10px] text-[var(--text-faint)] ml-1">({pct.toFixed(1)}%)</span>
                                </div>
                              </div>
                            );
                          })}
                          <div className="mt-3 pt-3 border-t border-[var(--border)] flex justify-between text-xs font-bold">
                            <span className="text-[var(--text-muted)]">Total Received</span>
                            <span className="font-mono text-emerald-600">{fmtINR(summary.totalPaid ?? 0)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab: Top Customers ── */}
                  {subTab === "top_customers" && (
                    <div>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">#</th>
                            <th className="py-2.5 px-4">Customer</th>
                            <th className="py-2.5 px-4 text-center">Bills</th>
                            <th className="py-2.5 px-4 text-right">Revenue</th>
                            <th className="py-2.5 px-4 text-right">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(data.topParties ?? []).map((p: any, i: number) => (
                            <tr key={p.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-4 text-[var(--text-faint)] font-bold">{i + 1}</td>
                              <td className="py-2 px-4 font-bold text-[var(--text-primary)]">
                                {p.id && p.id !== "unknown"
                                  ? <Link href={`/parties/${p.id}/ledger`} className="hover:underline text-[var(--primary)]">{p.name}</Link>
                                  : p.name}
                              </td>
                              <td className="py-2 px-4 text-center text-[var(--text-muted)]">{p.bills}</td>
                              <td className="py-2 px-4 text-right font-mono font-bold text-emerald-600">{fmtINR(p.total)}</td>
                              <td className="py-2 px-4 text-right font-mono text-rose-600">{fmtINR(p.outstanding)}</td>
                            </tr>
                          ))}
                          {(data.topParties ?? []).length === 0 && (
                            <tr><td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">No customers found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right col: Charts sidebar */}
              <div className="space-y-4">
                {/* Kaacha vs Pakka */}
                {activeTab === "all" && (
                  <ChartCard title="Kaacha vs Pakka Split">
                    <ReportDonutChart
                      data={kachaVsPakka.filter(d => d.value > 0)}
                      height={180}
                      innerRadius={45}
                      outerRadius={70}
                      valueFormat="currency"
                    />
                    <div className="mt-3 space-y-1.5">
                      {[
                        { label: `Kaacha (${summary.kachaBills})`, value: summary.kachaRevenue ?? 0, outstanding: summary.kachaOutstanding ?? 0 },
                        { label: `Pakka (${summary.pakkaBills})`, value: summary.pakkaRevenue ?? 0, outstanding: summary.pakkaOutstanding ?? 0 },
                      ].map(r => (
                        <div key={r.label} className="text-xs border-b border-[var(--border-light)] pb-1.5 space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">{r.label}</span>
                            <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(r.value)}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-[var(--text-faint)]">Outstanding</span>
                            <span className="font-mono text-rose-500">{fmtINR(r.outstanding)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}

                {/* Summary box */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Sales Summary</h3>
                  {[
                    { label: "Gross Sales", value: fmtINR(summary.grossSales ?? 0), cls: "text-[var(--text-primary)]" },
                    { label: "Less: Returns", value: `(${fmtINR(summary.totalReturns ?? 0)})`, cls: "text-rose-500" },
                    { label: "Net Sales", value: fmtINR(summary.netSales ?? 0), cls: "text-emerald-600 font-black" },
                    { label: "Total GST Collected", value: fmtINR(summary.totalGST ?? 0), cls: "text-violet-600" },
                    { label: "Total Received", value: fmtINR(summary.totalPaid ?? 0), cls: "text-blue-600" },
                    { label: "Outstanding", value: fmtINR(summary.totalOutstanding ?? 0), cls: "text-rose-600" },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                      <span className="text-[var(--text-muted)]">{r.label}</span>
                      <span className={`font-bold font-mono ${r.cls}`}>{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* All bills drill-down export */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Export Full Report</h3>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="flex items-center justify-center gap-2 h-9 rounded-lg border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/10 transition-colors cursor-pointer"
                    >
                      <FileSpreadsheet size={14} /> Export Excel (3 sheets)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageState>
    </ReportShell>
  );
}

