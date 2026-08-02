"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, ShoppingBag, IndianRupee, Receipt } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportAreaChart, ReportDonutChart, ReportBarChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, exportToExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillTypeTab = "all" | "kacha" | "pakka";

const TABS: { id: BillTypeTab; label: string; badge?: string }[] = [
  { id: "all", label: "Combined" },
  { id: "kacha", label: "Kaacha" },
  { id: "pakka", label: "Pakka" },
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-sales-v2", from, to, activeTab],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (activeTab !== "all") params.set("bill_type", activeTab);
      const res = await fetch(`/api/reports/sales?${params}`);
      if (!res.ok) throw new Error("Failed to load sales report");
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
        { key: "bill_number", label: "Bill No.", width: 16 },
        { key: "bill_date", label: "Date", format: "date", width: 14 },
        { key: "bill_type", label: "Type", width: 10 },
        { key: "party", label: "Customer", width: 30 },
        { key: "grand_total", label: "Amount (₹)", format: "currency", width: 18 },
        { key: "paid_amount", label: "Paid (₹)", format: "currency", width: 18 },
        { key: "outstanding", label: "Outstanding (₹)", format: "currency", width: 18 },
        { key: "payment_status", label: "Status", width: 12 },
      ],
      data.bills ?? [],
      `SalesReport_${activeTab}_${from}_${to}`
    );
  }, [data, activeTab, from, to]);

  const summary = data?.summary ?? {};
  const kachaVsPakka = [
    { name: "Kaacha", value: summary.kachaRevenue ?? 0, color: CHART_COLORS[2] },
    { name: "Pakka", value: summary.pakkaRevenue ?? 0, color: CHART_COLORS[0] },
  ];
  const statusChart = Object.entries(data?.statusBreakdown ?? {}).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    value: Number(v),
  }));

  return (
    <ReportShell
      title="Sales Reports"
      infoTooltip="Sales bills analysis — Kaacha, Pakka and Combined view with trends, top customers, and outstanding dues."
      breadcrumbs={["Reports", "Sales Reports"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
    >
      {/* Bill Type Tabs */}
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
        emptyTitle="No sales bills found"
        emptyDescription={`No ${activeTab === "all" ? "" : activeTab + " "}bills found for the selected period.`}
      >
        {data && (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <ReportKPICard label="Total Sales" value={summary.totalRevenue} color="emerald" icon={<TrendingUp size={16} />} />
              <ReportKPICard label="Total Bills" value={summary.totalBills} format="number" color="blue" icon={<Receipt size={16} />} />
              <ReportKPICard label="Avg. Bill Value" value={summary.avgBillValue} color="violet" icon={<IndianRupee size={16} />} />
              <ReportKPICard label="Total Received" value={summary.totalPaid} color="indigo" icon={<ShoppingBag size={16} />} />
              <ReportKPICard label="Outstanding" value={summary.totalOutstanding} color="rose" icon={<Users size={16} />} />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: trend + bills table */}
              <div className="lg:col-span-2 space-y-6">
                {/* Sales Trend */}
                {(data.monthlyTrend ?? []).length > 1 && (
                  <ChartCard title="Sales Trend (Monthly)">
                    <ReportAreaChart
                      data={data.monthlyTrend}
                      xKey="month"
                      lines={[{ key: "total", label: "Sales", color: CHART_COLORS[0] }]}
                      height={220}
                    />
                  </ChartCard>
                )}

                {/* Top Customers */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Top Customers (By Revenue)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-5">#</th>
                          <th className="py-2.5 px-5">Customer</th>
                          <th className="py-2.5 px-5 text-center">Bills</th>
                          <th className="py-2.5 px-5 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(data.topParties ?? []).slice(0, 8).map((p: any, i: number) => (
                          <tr key={p.id} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-5 text-[var(--text-faint)] font-bold">{i + 1}</td>
                            <td className="py-2 px-5 font-bold text-[var(--text-primary)]">{p.name}</td>
                            <td className="py-2 px-5 text-center text-[var(--text-muted)]">{p.bills}</td>
                            <td className="py-2 px-5 text-right font-mono font-bold text-emerald-500">{fmtINR(p.total)}</td>
                          </tr>
                        ))}
                        {(data.topParties ?? []).length === 0 && (
                          <tr><td colSpan={4} className="py-8 text-center text-[var(--text-muted)]">No customers found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Bills */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Recent Bills</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          {["Bill No.", "Date", "Type", "Customer", "Amount", "Paid", "Outstanding", "Status"].map((h) => (
                            <th key={h} className={`py-2.5 px-4 ${["Amount", "Paid", "Outstanding"].includes(h) ? "text-right" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(data.bills ?? []).slice(0, 15).map((b: any) => (
                          <tr key={b.id} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)]">{b.bill_number}</td>
                            <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(b.bill_date)}</td>
                            <td className="py-2 px-4">
                              <span className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                b.bill_type === "pakka"
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              )}>
                                {b.bill_type === "pakka" ? "Pakka" : "Kaacha"}
                              </span>
                            </td>
                            <td className="py-2 px-4 max-w-[140px] truncate">{b.party}</td>
                            <td className="py-2 px-4 text-right font-mono font-bold">{fmtINR(b.grand_total)}</td>
                            <td className="py-2 px-4 text-right font-mono text-emerald-500">{fmtINR(b.paid_amount)}</td>
                            <td className="py-2 px-4 text-right font-mono text-rose-500">{fmtINR(b.outstanding)}</td>
                            <td className="py-2 px-4">
                              <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_COLORS[b.payment_status] ?? "bg-[var(--badge-draft-bg)] text-[var(--badge-draft-text)] border-transparent")}>
                                {b.payment_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(data.bills ?? []).length === 0 && (
                          <tr><td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">No bills found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right: charts sidebar */}
              <div className="space-y-4">
                {/* Kaacha vs Pakka - only show on "all" tab */}
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
                        { label: "Kaacha Bills", count: summary.kachaBills, value: summary.kachaRevenue },
                        { label: "Pakka Bills", count: summary.pakkaBills, value: summary.pakkaRevenue },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">{r.label} ({r.count})</span>
                          <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(r.value)}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}

                {/* Payment Status Chart */}
                {statusChart.length > 0 && (
                  <ChartCard title="Payment Status">
                    <ReportDonutChart
                      data={statusChart}
                      height={180}
                      innerRadius={45}
                      outerRadius={70}
                      valueFormat="number"
                    />
                  </ChartCard>
                )}

                {/* Summary box */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Sales Summary</h3>
                  {[
                    { label: "Total Sales", value: fmtINR(summary.totalRevenue) },
                    { label: "Total Received", value: fmtINR(summary.totalPaid) },
                    { label: "Outstanding", value: fmtINR(summary.totalOutstanding) },
                    { label: "Avg. Bill Value", value: fmtINR(summary.avgBillValue) },
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
