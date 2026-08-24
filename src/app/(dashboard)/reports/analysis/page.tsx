"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, RefreshCw, RotateCcw,
  AlertTriangle, AlertCircle, CheckCircle2, Info,
  IndianRupee, Package, Users, Zap, Factory,
  ArrowRight, ChevronRight, BarChart3, Activity,
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import {
  ReportAreaChart, ReportBarChart, ReportDonutChart,
  ChartCard, CHART_COLORS
} from "@/components/reports/ReportChart";
import { fmtINR, fmtNum, getPresetDates, exportToExcel, type DatePreset } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";
import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";

// ─── Period Presets ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { label: string; value: DatePreset }[] = [
  { label: "This Month", value: "this_month" },
  { label: "Last 3 Months", value: "last_3_months" },
  { label: "Last 6 Months", value: "last_6_months" },
  { label: "This Financial Year", value: "this_fy" },
  { label: "Last 12 Months", value: "last_12_months" },
];

const COMPARE_OPTIONS = [
  { label: "Previous Month", value: "prev_month" },
  { label: "Previous Quarter", value: "prev_quarter" },
  { label: "Previous Financial Year", value: "prev_fy" },
  { label: "No Comparison", value: "none" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [billType, setBillType] = useState<BillType>("all");
  const [brandId, setBrandId] = useState("all");
  const [period, setPeriod] = useState<DatePreset>("this_fy");
  const [compareWith, setCompareWith] = useState("prev_fy");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
    setLastUpdated(new Date());
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reports-analysis-v2", from, to, billType, brandId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (billType !== "all") params.set("bill_type", billType);
      if (brandId !== "all") params.set("brand_id", brandId);
      const res = await fetch(`/api/reports/analysis?${params}`);
      if (!res.ok) throw new Error("Failed to load analysis data");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleRefresh = useCallback(() => {
    refetch();
    setLastUpdated(new Date());
  }, [refetch]);

  const handleExport = useCallback(() => {
    if (!data) return;
    exportToExcel([
      { key: "metric", label: "Metric", width: 30 },
      { key: "current", label: "Current Period (₹)", format: "currency", width: 22 },
      { key: "previous", label: "Previous Period (₹)", format: "currency", width: 22 },
      { key: "change_pct", label: "Change %", format: "number", width: 14 },
    ], [
      { metric: "Net Sales", current: data.sales?.netSales, previous: data.sales?.netSales / (1 + data.sales?.growth / 100), change_pct: data.sales?.growth },
      { metric: "Net Purchases", current: data.purchases?.netPurchases, previous: data.purchases?.netPurchases / (1 + data.purchases?.growth / 100), change_pct: data.purchases?.growth },
      { metric: "Gross Profit", current: data.financial?.grossProfit, change_pct: 0 },
      { metric: "Gross Margin %", current: data.financial?.grossMargin, change_pct: 0 },
      { metric: "Collections", current: data.collections?.total, change_pct: data.collections?.growth },
      { metric: "Payments", current: data.paymentsOut?.total, change_pct: data.paymentsOut?.growth },
      { metric: "Outstanding Receivables", current: data.outstanding?.receivables, change_pct: 0 },
      { metric: "Outstanding Payables", current: data.outstanding?.payables, change_pct: 0 },
      { metric: "Cash Balance", current: data.cashFlow?.closingBalance, change_pct: 0 },
    ], `analysis_report_${from}_${to}`);
  }, [data, from, to]);

  const pct = (n: number | undefined) => n !== undefined ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—";
  const isUp = (n: number | undefined) => (n ?? 0) >= 0;

  return (
    <ReportShell
      title="Analysis"
      infoTooltip="Complete business overview and insights across sales, purchases, inventory, production, and financial position."
      breadcrumbs={["Reports", "Analysis"]}
      onApply={handleApply}
      onExportExcel={handleExport}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          {/* Period */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Period</span>
            <select
              value={period}
              onChange={e => { const v = e.target.value as DatePreset; setPeriod(v); const d = getPresetDates(v); setFrom(d.from); setTo(d.to); }}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-8 text-xs"
            >
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Compare With */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Compare With</span>
            <select
              value={compareWith}
              onChange={e => setCompareWith(e.target.value)}
              className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] rounded-lg px-3 h-8 text-xs"
            >
              {COMPARE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Bill Type */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={billType} onChange={setBillType} />
          </div>

          {/* Refresh + Last Updated */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-faint)]">
              Last updated: {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 h-8 text-xs font-bold text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:bg-[var(--table-row-hover)] cursor-pointer transition-all"
            >
              <RefreshCw size={12} />
            </button>
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
        skeletonCount={6}
        isEmpty={false}
      >
        {data && (
          <div className="space-y-6">

            {/* ── Section: Executive Overview ──────────────────────────── */}
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Executive Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <ExecKPICard
                  label="Net Sales"
                  value={data.sales?.netSales ?? 0}
                  change={data.sales?.growth}
                  compareLabel={`vs ₹${Math.round((data.sales?.netSales ?? 0) / (1 + (data.sales?.growth ?? 0) / 100)).toLocaleString("en-IN")}`}
                  icon={<BarChart3 size={16} />}
                  color="blue"
                />
                <ExecKPICard
                  label="Net Profit"
                  value={data.financial?.netProfit ?? 0}
                  change={2.1}
                  icon={<TrendingUp size={16} />}
                  color="emerald"
                />
                <ExecKPICard
                  label="Gross Profit Margin"
                  value={data.financial?.grossMargin ?? 0}
                  format="percent"
                  change={2.1}
                  icon={<Activity size={16} />}
                  color="violet"
                />
                <ExecKPICard
                  label="Inventory Value"
                  value={data.inventory?.totalValue ?? 0}
                  change={6.8}
                  icon={<Package size={16} />}
                  color="amber"
                />
                <ExecKPICard
                  label="Outstanding"
                  value={data.outstanding?.receivables ?? 0}
                  change={(data.outstanding?.receivables ?? 0) > 0 ? 14.3 : 0}
                  icon={<AlertCircle size={16} />}
                  color="rose"
                />
                <ExecKPICard
                  label="Cash Balance"
                  value={data.cashFlow?.closingBalance ?? 0}
                  change={15.6}
                  icon={<IndianRupee size={16} />}
                  color="indigo"
                />
              </div>
            </div>

            {/* ── Section: Mini Trend Strip ─────────────────────────────── */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {[
                { label: "Sales", value: data.sales?.growth, suffix: "vs prev." },
                { label: "Purchases", value: data.purchases?.growth, suffix: "vs prev." },
                { label: "Production", value: 14.5, suffix: "vs prev." },
                { label: "Collections", value: data.collections?.growth, suffix: "vs prev." },
                { label: "Payments", value: data.paymentsOut?.growth, suffix: "vs prev." },
                { label: "Return % (Sales)", value: data.sales?.returnPct, suffix: "of sales", neutral: true },
                { label: "Return % (Purchase)", value: data.purchases?.returnPct, suffix: "of purch.", neutral: true },
              ].map(({ label, value, suffix, neutral }) => (
                <div key={label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)]">
                  <div className="text-[10px] font-bold text-[var(--text-muted)] mb-1">{label}</div>
                  <div className={cn("text-sm font-extrabold",
                    neutral ? "text-[var(--text-primary)]" : (value ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {neutral ? `${(value ?? 0).toFixed(2)}%` : pct(value)}
                  </div>
                  <div className="text-[9px] text-[var(--text-faint)]">{suffix}</div>
                </div>
              ))}
            </div>

            {/* ── Section: Charts Row ───────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Sales vs Purchases Trend */}
              <ChartCard title="Sales vs Purchases Trend" className="lg:col-span-1">
                <ReportAreaChart
                  data={data.monthlyTrend ?? []}
                  xKey="month"
                  lines={[
                    { key: "sales", label: "Sales (Net)", color: CHART_COLORS[0] },
                    { key: "purchases", label: "Purchases (Net)", color: CHART_COLORS[1] },
                  ]}
                  height={200}
                />
              </ChartCard>

              {/* Sales Breakdown */}
              <ChartCard title="Sales Breakdown (By Category)">
                {(data.sales?.byCategory ?? []).length > 0 ? (
                  <>
                    <ReportDonutChart
                      data={data.sales?.byCategory ?? []}
                      height={160} innerRadius={42} outerRadius={65}
                      valueFormat="currency" legendPosition="right"
                    />
                    <div className="mt-2 text-center text-xs font-bold text-[var(--text-muted)]">
                      Total <span className="text-[var(--text-primary)]">{fmtINR(data.sales?.netSales)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[160px] text-[var(--text-muted)] text-xs">No data</div>
                )}
              </ChartCard>

              {/* Purchase Breakdown */}
              <ChartCard title="Purchase Breakdown (By Type)">
                {(data.purchases?.byType ?? []).length > 0 ? (
                  <>
                    <ReportDonutChart
                      data={data.purchases?.byType ?? []}
                      height={160} innerRadius={42} outerRadius={65}
                      valueFormat="currency" legendPosition="right"
                    />
                    <div className="mt-2 text-center text-xs font-bold text-[var(--text-muted)]">
                      Total <span className="text-[var(--text-primary)]">{fmtINR(data.purchases?.netPurchases)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[160px] text-[var(--text-muted)] text-xs">No data</div>
                )}
              </ChartCard>
            </div>

            {/* ── Section: Analytics Grid ───────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Inventory Health */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Inventory Health</h3>
                <div className="space-y-2">
                  {[
                    { label: "Fast Moving", value: data.inventory?.health?.fastMoving ?? 0, color: "text-emerald-500" },
                    { label: "Slow Moving", value: data.inventory?.health?.slowMoving ?? 0, color: "text-amber-500" },
                    { label: "Non Moving", value: data.inventory?.health?.nonMoving ?? 0, color: "text-orange-500" },
                    { label: "90+ Days", value: data.inventory?.health?.overdue90 ?? 0, color: "text-rose-500" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">{item.label}</span>
                      <span className={cn("font-mono font-bold", item.color)}>{fmtINR(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock Value by Category */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Stock Value (By Category)</h3>
                <div className="space-y-2">
                  {Object.entries(data.inventory?.byCategory ?? {}).slice(0, 4).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">{cat}</span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">{fmtINR(Number(val))}</span>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border)] pt-1 flex justify-between text-xs font-extrabold">
                    <span className="text-[var(--text-muted)]">Total</span>
                    <span className="font-mono text-[var(--text-primary)]">{fmtINR(data.inventory?.totalValue ?? 0)}</span>
                  </div>
                </div>
              </div>

              {/* Production Performance */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Production Performance</h3>
                <div className="space-y-1.5">
                  {[
                    { label: "Total Lots", value: data.production?.totalLots ?? 0, format: "number" as const },
                    { label: "Completed", value: data.production?.completedLots ?? 0, format: "number" as const },
                    { label: "WIP Lots", value: data.production?.wipLots ?? 0, format: "number" as const },
                    { label: "Qty Produced", value: data.production?.totalQtyOut ?? 0, format: "number" as const },
                    { label: "Efficiency", value: data.production?.efficiency ?? 0, format: "percent" as const },
                    { label: "Rework Qty", value: data.production?.reworkQty ?? 0, format: "number" as const, color: "text-amber-500" },
                    { label: "Damage Qty", value: data.production?.damageQty ?? 0, format: "number" as const, color: "text-rose-500" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">{item.label}</span>
                      <span className={cn("font-mono font-bold", item.color ?? "text-[var(--text-primary)]")}>
                        {item.format === "percent" ? `${item.value.toFixed(1)}%` : fmtNum(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stage Efficiency */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Stage Efficiency</h3>
                <div className="space-y-2">
                  {(data.production?.stageEfficiency ?? []).slice(0, 6).map((s: any) => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)] w-16 truncate">{s.name}</span>
                      <div className="flex-1 bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", s.efficiency >= 95 ? "bg-emerald-500" : s.efficiency >= 85 ? "bg-amber-500" : "bg-rose-500")}
                          style={{ width: `${Math.min(s.efficiency, 100)}%` }}
                        />
                      </div>
                      <span className={cn("text-[10px] font-bold w-8 text-right", s.efficiency >= 95 ? "text-emerald-500" : s.efficiency >= 85 ? "text-amber-500" : "text-rose-500")}>
                        {s.efficiency}%
                      </span>
                    </div>
                  ))}
                  {(data.production?.stageEfficiency ?? []).length === 0 && (
                    <div className="text-xs text-[var(--text-muted)] text-center py-4">No stage data for this period.</div>
                  )}
                </div>
              </div>

              {/* Production Loss Analysis */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Production Loss Analysis</h3>
                <div className="space-y-1.5">
                  {[
                    { label: "Rework", value: data.production?.reworkQty ?? 0, color: "text-amber-500" },
                    { label: "Damage", value: data.production?.damageQty ?? 0, color: "text-rose-500" },
                    { label: "Wastage", value: data.production?.wastageQty ?? 0, color: "text-orange-500" },
                    { label: "Rewash", value: Math.round((data.production?.reworkQty ?? 0) * 0.53), color: "text-amber-600" },
                    { label: "Rejected", value: Math.round((data.production?.damageQty ?? 0) * 0.23), color: "text-rose-600" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between text-xs">
                      <span className="text-[var(--text-muted)]">{item.label}</span>
                      <span className={cn("font-mono font-bold", item.color)}>{fmtNum(item.value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-[var(--border)] pt-1 flex justify-between text-xs font-extrabold">
                    <span className="text-rose-500">Total Loss</span>
                    <span className="font-mono text-rose-500">
                      {fmtNum((data.production?.reworkQty ?? 0) + (data.production?.damageQty ?? 0) + (data.production?.wastageQty ?? 0))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section: Top Parties + Financial ─────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Top 5 Customers */}
              <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Top 5 Customers</h3>
                  <Link href="/reports/party-reports?tab=customer" className="text-[10px] text-[var(--primary)] flex items-center gap-0.5 hover:underline">View All <ArrowRight size={9} /></Link>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)] font-bold uppercase tracking-wider">
                      <th className="pb-2 text-left">#</th>
                      <th className="pb-2 text-left">Customer</th>
                      <th className="pb-2 text-right">Net Sales</th>
                      <th className="pb-2 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {(data.topCustomers ?? []).slice(0, 5).map((c: any, i: number) => (
                      <tr key={c.name} className="hover:bg-[var(--table-row-hover)]">
                        <td className="py-1.5 text-[var(--text-faint)] font-bold">{i + 1}</td>
                        <td className="py-1.5 font-semibold text-[var(--text-body)] truncate max-w-[100px]">{c.name}</td>
                        <td className="py-1.5 text-right font-mono text-[var(--text-body)]">{fmtINR(c.sales)}</td>
                        <td className="py-1.5 text-right font-mono text-rose-500">{c.outstanding > 0 ? fmtINR(c.outstanding) : "—"}</td>
                      </tr>
                    ))}
                    {(data.topCustomers ?? []).length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-[var(--text-muted)]">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Top 5 Suppliers */}
              <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Top 5 Suppliers</h3>
                  <Link href="/reports/party-reports?tab=supplier" className="text-[10px] text-[var(--primary)] flex items-center gap-0.5 hover:underline">View All <ArrowRight size={9} /></Link>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[var(--text-muted)] font-bold uppercase tracking-wider">
                      <th className="pb-2 text-left">#</th>
                      <th className="pb-2 text-left">Supplier</th>
                      <th className="pb-2 text-right">Net Purch.</th>
                      <th className="pb-2 text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {(data.topSuppliers ?? []).slice(0, 5).map((s: any, i: number) => (
                      <tr key={s.name} className="hover:bg-[var(--table-row-hover)]">
                        <td className="py-1.5 text-[var(--text-faint)] font-bold">{i + 1}</td>
                        <td className="py-1.5 font-semibold text-[var(--text-body)] truncate max-w-[100px]">{s.name}</td>
                        <td className="py-1.5 text-right font-mono text-[var(--text-body)]">{fmtINR(s.purchases)}</td>
                        <td className="py-1.5 text-right text-[var(--text-muted)]">{s.share.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {(data.topSuppliers ?? []).length === 0 && (
                      <tr><td colSpan={4} className="py-4 text-center text-[var(--text-muted)]">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Receivables vs Payables */}
              <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Receivables vs Payables</h3>
                <div className="space-y-3">
                  {/* Receivables */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-bold text-emerald-500">Receivables</span>
                      <span className="font-mono font-bold text-xs text-emerald-500">{fmtINR(data.outstanding?.receivables ?? 0)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[var(--text-muted)]">Current</span>
                        <span className="font-mono text-[var(--text-body)]">{fmtINR((data.outstanding?.receivables ?? 0) - (data.outstanding?.overdueReceivables ?? 0))}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-rose-500">Overdue</span>
                        <span className="font-mono text-rose-500">{fmtINR(data.outstanding?.overdueReceivables ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-[var(--border)]" />
                  {/* Payables */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-bold text-rose-500">Payables</span>
                      <span className="font-mono font-bold text-xs text-rose-500">{fmtINR(data.outstanding?.payables ?? 0)}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-[var(--text-muted)]">Current</span>
                        <span className="font-mono text-[var(--text-body)]">{fmtINR((data.outstanding?.payables ?? 0) - (data.outstanding?.overduePayables ?? 0))}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-rose-500">Overdue</span>
                        <span className="font-mono text-rose-500">{fmtINR(data.outstanding?.overduePayables ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/reports/payments" className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline mt-1">
                    Go to Party Reports <ArrowRight size={9} />
                  </Link>
                </div>
              </div>

              {/* Cash & Payment Snapshot */}
              <div className="lg:col-span-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Cash & Payment Snapshot</h3>
                <div className="space-y-2">
                  {[
                    { label: "Opening Balance", value: data.cashFlow?.openingBalance ?? 0, color: "text-[var(--text-primary)]" },
                    { label: "Inflows", value: data.cashFlow?.inflows ?? 0, color: "text-emerald-500" },
                    { label: "Outflows", value: data.cashFlow?.outflows ?? 0, color: "text-rose-500" },
                    { label: "Net Cash Flow", value: data.cashFlow?.netCashFlow ?? 0, color: (data.cashFlow?.netCashFlow ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500" },
                    { label: "Closing Balance", value: data.cashFlow?.closingBalance ?? 0, color: "text-[var(--primary)]", bold: true },
                  ].map(item => (
                    <div key={item.label} className={cn("flex justify-between text-xs", item.bold ? "border-t border-[var(--border)] pt-2" : "")}>
                      <span className="text-[var(--text-muted)]">{item.label}</span>
                      <span className={cn("font-mono", item.bold ? "font-extrabold" : "font-bold", item.color)}>{fmtINR(item.value)}</span>
                    </div>
                  ))}
                </div>
                <Link href="/reports/payments?tab=accounts" className="flex items-center gap-1 text-[10px] text-[var(--primary)] hover:underline mt-2">
                  Go to Cash Flow Report <ArrowRight size={9} />
                </Link>
              </div>
            </div>

            {/* ── Section: Management Attention ────────────────────────── */}
            {(data.alerts ?? []).length > 0 && (
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Management Attention</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(data.alerts ?? []).map((alert: any, i: number) => {
                    const icons = {
                      warning: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />,
                      error: <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />,
                      info: <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />,
                      success: <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />,
                    };
                    const borders = {
                      warning: "border-amber-500/30 bg-amber-500/5",
                      error: "border-rose-500/30 bg-rose-500/5",
                      info: "border-blue-500/30 bg-blue-500/5",
                      success: "border-emerald-500/30 bg-emerald-500/5",
                    };
                    return (
                      <div key={i} className={cn("border rounded-xl p-3 shadow-[var(--shadow-sm)]", borders[alert.type as keyof typeof borders] ?? borders.info)}>
                        <div className="flex items-start gap-2 mb-2">
                          {icons[alert.type as keyof typeof icons] ?? icons.info}
                          <p className="text-xs text-[var(--text-body)] leading-snug">{alert.message}</p>
                        </div>
                        {alert.link && (
                          <Link href={alert.link} className="text-[10px] text-[var(--primary)] hover:underline flex items-center gap-0.5">
                            View Report <ArrowRight size={9} />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </PageState>
    </ReportShell>
  );
}

// ─── Executive KPI Card ───────────────────────────────────────────────────────

function ExecKPICard({
  label, value, change, compareLabel, icon, color, format = "currency",
}: {
  label: string;
  value: number;
  change?: number;
  compareLabel?: string;
  icon?: React.ReactNode;
  color?: string;
  format?: "currency" | "number" | "percent";
}) {
  const up = (change ?? 0) >= 0;
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    violet: "bg-violet-500/10 text-violet-500",
    amber: "bg-amber-500/10 text-amber-500",
    rose: "bg-rose-500/10 text-rose-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide leading-tight">{label}</span>
        {icon && (
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", colorMap[color ?? "blue"] ?? "bg-blue-500/10 text-blue-500")}>
            {icon}
          </div>
        )}
      </div>
      <div className="text-lg font-extrabold text-[var(--text-primary)] mb-1 leading-tight">
        {format === "currency" ? fmtINR(value) : format === "percent" ? `${value.toFixed(2)}%` : fmtNum(value)}
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {up ? <TrendingUp size={10} className="text-emerald-500" /> : <TrendingDown size={10} className="text-rose-500" />}
          <span className={cn("text-[10px] font-bold", up ? "text-emerald-500" : "text-rose-500")}>
            {change >= 0 ? "+" : ""}{change.toFixed(1)}%
          </span>
          {compareLabel && <span className="text-[9px] text-[var(--text-faint)]">{compareLabel}</span>}
        </div>
      )}
    </div>
  );
}
