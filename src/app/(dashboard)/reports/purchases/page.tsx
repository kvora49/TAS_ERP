"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, Users, Package, IndianRupee, Receipt } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportAreaChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, exportToExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";

type PurchaseTab = "all" | "raw" | "finished";

const TABS: { id: PurchaseTab; label: string }[] = [
  { id: "all", label: "All Purchases" },
  { id: "raw", label: "Raw Materials" },
  { id: "finished", label: "Finished Goods" },
];

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  partial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  unpaid: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  cancelled: "bg-[var(--table-header-bg)] text-[var(--text-muted)] border-[var(--border)]",
};

const TYPE_BADGE: Record<string, string> = {
  raw_material: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  finished_goods: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export default function PurchaseReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<PurchaseTab>("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-purchases", from, to, activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/reports/purchases?from=${from}&to=${to}&tab=${activeTab}`);
      if (!res.ok) throw new Error("Failed to load purchase report");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    exportToExcel(
      [
        { key: "purchase_number", label: "Purchase / Bill No.", width: 20 },
        { key: "invoice_date", label: "Date", format: "date", width: 14 },
        { key: "purchase_type", label: "Type", width: 14 },
        { key: "party", label: "Supplier", width: 30 },
        { key: "grand_total", label: "Amount (₹)", format: "currency", width: 18 },
        { key: "paid_amount", label: "Paid (₹)", format: "currency", width: 18 },
        { key: "outstanding", label: "Outstanding (₹)", format: "currency", width: 18 },
        { key: "payment_status", label: "Status", width: 12 },
      ],
      data.bills ?? [],
      `PurchaseReport_${activeTab}_${from}_${to}`
    );
  }, [data, activeTab, from, to]);

  const s = data?.summary ?? {};
  const splitChart = [
    { name: "Raw Materials", value: s.rawTotal ?? 0, color: CHART_COLORS[4] },
    { name: "Finished Goods", value: s.finishedTotal ?? 0, color: CHART_COLORS[0] },
  ];

  return (
    <ReportShell
      title="Purchase Reports"
      infoTooltip="Track raw material and finished goods purchases with supplier-wise analysis and payment status."
      breadcrumbs={["Reports", "Purchase Reports"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
    >
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-1 -mt-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer",
              activeTab === t.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={(error as any)?.message}
        onRetry={refetch}
        skeletonVariant="stats"
        skeletonCount={5}
        isEmpty={!isLoading && data?.summary?.totalBills === 0}
        emptyTitle="No purchases found"
        emptyDescription="No purchase records found for the selected period."
      >
        {data && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <ReportKPICard label="Total Purchases" value={s.totalPurchases} color="rose" icon={<TrendingDown size={16} />} />
              <ReportKPICard label="Total Bills" value={s.totalBills} format="number" color="blue" icon={<Receipt size={16} />} />
              <ReportKPICard label="Avg. Bill Value" value={s.avgBillValue} color="violet" icon={<IndianRupee size={16} />} />
              <ReportKPICard label="Total Paid" value={s.totalPaid} color="emerald" icon={<Package size={16} />} />
              <ReportKPICard label="Outstanding Payables" value={s.totalOutstanding} color="amber" icon={<Users size={16} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Purchase Trend */}
                {(data.monthlyTrend ?? []).length > 1 && (
                  <ChartCard title="Purchase Trend (Monthly)">
                    <ReportAreaChart
                      data={data.monthlyTrend}
                      xKey="month"
                      lines={[{ key: "total", label: "Purchases", color: CHART_COLORS[3] }]}
                      height={220}
                    />
                  </ChartCard>
                )}

                {/* Top Suppliers */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Top Suppliers</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-5">#</th>
                          <th className="py-2.5 px-5">Supplier</th>
                          <th className="py-2.5 px-5 text-center">Bills</th>
                          <th className="py-2.5 px-5 text-right">Total Purchased</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {(data.topSuppliers ?? []).slice(0, 8).map((s: any, i: number) => (
                          <tr key={s.id} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-5 text-[var(--text-faint)] font-bold">{i + 1}</td>
                            <td className="py-2 px-5 font-bold text-[var(--text-primary)]">{s.name}</td>
                            <td className="py-2 px-5 text-center text-[var(--text-muted)]">{s.bills}</td>
                            <td className="py-2 px-5 text-right font-mono font-bold text-rose-500">{fmtINR(s.total)}</td>
                          </tr>
                        ))}
                        {(data.topSuppliers ?? []).length === 0 && (
                          <tr><td colSpan={4} className="py-8 text-center text-[var(--text-muted)]">No suppliers found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Purchase Bills Table */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Recent Purchases</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          {["Bill/Invoice No.", "Date", "Type", "Supplier", "Amount", "Paid", "Outstanding", "Status"].map(h => (
                            <th key={h} className={`py-2.5 px-4 ${["Amount","Paid","Outstanding"].includes(h) ? "text-right" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {(data.bills ?? []).slice(0, 15).map((b: any) => (
                          <tr key={b.id} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)]">{b.purchase_number}</td>
                            <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(b.invoice_date)}</td>
                            <td className="py-2 px-4">
                              <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border", TYPE_BADGE[b.purchase_type] ?? "")}>
                                {b.purchase_type === "raw_material" ? "Raw Material" : "Finished Goods"}
                              </span>
                            </td>
                            <td className="py-2 px-4 max-w-[140px] truncate">{b.party}</td>
                            <td className="py-2 px-4 text-right font-mono font-bold">{fmtINR(b.grand_total)}</td>
                            <td className="py-2 px-4 text-right font-mono text-emerald-500">{fmtINR(b.paid_amount)}</td>
                            <td className="py-2 px-4 text-right font-mono text-rose-500">{fmtINR(b.outstanding)}</td>
                            <td className="py-2 px-4">
                              <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_COLORS[b.payment_status] ?? "")}>
                                {b.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(data.bills ?? []).length === 0 && (
                          <tr><td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">No purchases found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right: charts */}
              <div className="space-y-4">
                {activeTab === "all" && (
                  <ChartCard title="Raw vs Finished Split">
                    <ReportDonutChart data={splitChart.filter(d => d.value > 0)} height={180} innerRadius={45} outerRadius={70} />
                    <div className="mt-3 space-y-1.5">
                      {[
                        { label: "Raw Materials", count: s.rawCount, value: s.rawTotal },
                        { label: "Finished Goods", count: s.finishedCount, value: s.finishedTotal },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">{r.label} ({r.count})</span>
                          <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(r.value)}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Purchase Summary</h3>
                  {[
                    { label: "Total Purchases", value: fmtINR(s.totalPurchases) },
                    { label: "Total Paid", value: fmtINR(s.totalPaid) },
                    { label: "Outstanding Payables", value: fmtINR(s.totalOutstanding) },
                    { label: "Avg. Bill Value", value: fmtINR(s.avgBillValue) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-2">
                      <span className="text-[var(--text-muted)]">{r.label}</span>
                      <span className="font-bold font-mono text-[var(--text-primary)]">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </PageState>
    </ReportShell>
  );
}
