"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, ArrowRight, BarChart3,
  Users, Package, IndianRupee, Zap, PieChart
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import {
  ReportAreaChart, ReportBarChart, ReportDonutChart,
  ChartCard, CHART_COLORS
} from "@/components/reports/ReportChart";
import { fmtINR, fmtNum, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";

import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";

const TOP_N_OPTIONS = [
  { label: "Top 5", value: "5" },
  { label: "Top 10", value: "10" },
  { label: "Top 20", value: "20" },
  { label: "Top 50", value: "50" },
];

const GRANULARITY_OPTIONS = [
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
];

// ─── Analysis page — aggregates data from multiple report endpoints ───────────

export default function AnalysisPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [billType, setBillType] = useState<BillType>("all");
  const [topN, setTopN] = useState("10");
  const [granularity, setGranularity] = useState("monthly");

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  // Sales data
  const salesQuery = useQuery({
    queryKey: ["reports", "sales", { from, to, billType }],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (billType !== "all") params.set("bill_type", billType);
      const res = await fetch(`/api/reports/sales?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 120_000,
  });

  // Financial data
  const finQuery = useQuery({
    queryKey: ["reports", "financial", { from, to, billType }],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (billType !== "all") params.set("bill_type", billType);
      const res = await fetch(`/api/reports/financial?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 120_000,
  });

  // Purchase data
  const purchaseQuery = useQuery({
    queryKey: ["reports", "purchases", { from, to, billType }],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (billType !== "all") params.set("bill_type", billType);
      const res = await fetch(`/api/reports/purchases?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 120_000,
  });

  // Inventory data
  const invQuery = useQuery({
    queryKey: ["reports", "inventory", "valuation"],
    queryFn: async () => {
      const res = await fetch(`/api/reports/inventory?tab=valuation`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 120_000,
  });

  const isLoading = salesQuery.isLoading || finQuery.isLoading || purchaseQuery.isLoading || invQuery.isLoading;

  const salesData = salesQuery.data;
  const finData = finQuery.data;
  const purchaseData = purchaseQuery.data;
  const invData = invQuery.data;

  // Chart data
  const trendData = salesData?.monthlyTrend ?? [];
  const topParties = (salesData?.topParties ?? []).slice(0, Number(topN));
  const kachaVsPakka = [
    { name: "Kaccha Sales", value: salesData?.summary?.kachaRevenue ?? 0, color: CHART_COLORS[2] },
    { name: "Pakka Sales", value: salesData?.summary?.pakkaRevenue ?? 0, color: CHART_COLORS[0] },
  ].filter(d => d.value > 0);
  const kpChart = kachaVsPakka;

  const purchaseKachaVsPakka = [
    { name: "Kaccha Purchases", value: purchaseData?.summary?.kachaTotal ?? 0, color: CHART_COLORS[3] },
    { name: "Pakka Purchases", value: purchaseData?.summary?.pakkaTotal ?? 0, color: CHART_COLORS[1] },
  ].filter(d => d.value > 0);

  // P&L margin
  const netMargin = finData?.pl?.net_margin_pct ?? 0;
  const grossMargin = finData?.pl?.gross_margin_pct ?? 0;

  const topInvChart = (invData?.rows ?? []).slice(0, Number(topN)).map((r: any) => ({
    name: r.design_number ?? r.design_name?.slice(0, 8),
    value: r.total_value,
  }));

  return (
    <ReportShell
      title="Analysis Dashboard"
      infoTooltip="Cross-report analytics — Sales & Purchase trends, Kaccha/Pakka split, P&L margins, and inventory insights."
      breadcrumbs={["Reports", "Analysis"]}
      onApply={handleApply}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Top N Rank"
            value={topN}
            onChange={setTopN}
            options={TOP_N_OPTIONS}
            placeholder="Top 10"
          />
          <FilterPills
            label="Granularity"
            value={granularity}
            onChange={setGranularity}
            options={GRANULARITY_OPTIONS}
          />
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={billType} onChange={setBillType} />
          </div>
        </div>
      }
    >

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-[var(--skeleton-base)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Section 1: Sales Analysis ── */}
          <AnalysisSection
            title="Sales Analysis"
            subtitle="Revenue trends and customer breakdown"
            icon={<TrendingUp size={16} />}
            href="/reports/sales"
            color="emerald"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <ReportKPICard label="Total Revenue" value={salesData?.summary?.totalRevenue ?? 0} color="emerald" />
              <ReportKPICard label="Total Bills" value={salesData?.summary?.totalBills ?? 0} format="number" color="blue" />
              <ReportKPICard label="Avg. Bill Value" value={salesData?.summary?.avgBillValue ?? 0} color="violet" />
              <ReportKPICard label="Outstanding" value={salesData?.summary?.totalOutstanding ?? 0} color="rose" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(salesData?.monthlyTrend ?? []).length > 1 && (
                <ChartCard title="Monthly Revenue Trend">
                  <ReportAreaChart
                    data={salesData.monthlyTrend}
                    xKey="month"
                    lines={[{ key: "total", label: "Sales", color: CHART_COLORS[1] }]}
                    height={200}
                  />
                </ChartCard>
              )}
              {(salesData?.topParties ?? []).length > 0 && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Top Customers</h3>
                  <div className="space-y-3">
                    {(salesData.topParties ?? []).slice(0, 5).map((p: any, i: number) => (
                      <div key={p.id} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-[var(--text-primary)] truncate max-w-[200px]">
                            {i + 1}. {p.name}
                          </span>
                          <span className="font-mono font-bold text-[var(--text-primary)]">{fmtINR(p.total)}</span>
                        </div>
                        <div className="w-full bg-[var(--page-bg)] rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-[var(--primary)]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(5, (p.total / (salesData.summary?.totalRevenue || 1)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AnalysisSection>

          {/* ── Section 2: Kaacha & Pakka Analysis ── */}
          <AnalysisSection
            title="Kaccha & Pakka Analysis"
            subtitle="Sales and Purchase bill type breakdown"
            icon={<PieChart size={16} />}
            href="/reports/sales"
            color="amber"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Sales Split</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ReportKPICard label="Kaccha Revenue" value={salesData?.summary?.kachaRevenue ?? 0} color="amber" subLabel={`${salesData?.summary?.kachaBills ?? 0} bills`} />
                  <ReportKPICard label="Pakka Revenue" value={salesData?.summary?.pakkaRevenue ?? 0} color="indigo" subLabel={`${salesData?.summary?.pakkaBills ?? 0} bills`} />
                </div>
                {kpChart.length > 0 && (
                  <ChartCard title="Sales Revenue Split">
                    <ReportDonutChart data={kpChart} height={180} innerRadius={45} outerRadius={70} valueFormat="currency" legendPosition="bottom" />
                  </ChartCard>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Purchase Split</h3>
                <div className="grid grid-cols-2 gap-3">
                  <ReportKPICard label="Kaccha Purchases" value={purchaseData?.summary?.kachaTotal ?? 0} color="rose" subLabel={`${purchaseData?.summary?.kachaCount ?? 0} bills`} />
                  <ReportKPICard label="Pakka Purchases" value={purchaseData?.summary?.pakkaTotal ?? 0} color="blue" subLabel={`${purchaseData?.summary?.pakkaCount ?? 0} bills`} />
                </div>
                {purchaseKachaVsPakka.length > 0 && (
                  <ChartCard title="Purchase Cost Split">
                    <ReportDonutChart data={purchaseKachaVsPakka} height={180} innerRadius={45} outerRadius={70} valueFormat="currency" legendPosition="bottom" />
                  </ChartCard>
                )}
              </div>
            </div>
          </AnalysisSection>

          {/* ── Section 3: P&L Analysis ── */}
          <AnalysisSection
            title="Profit & Loss Analysis"
            subtitle="Revenue, COGS, margins, and expense breakdown"
            icon={<IndianRupee size={16} />}
            href="/reports/financial"
            color="blue"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <ReportKPICard label="Total Income" value={finData?.pl?.income?.total ?? 0} color="emerald" />
              <ReportKPICard label="Gross Profit" value={finData?.pl?.gross_profit ?? 0} color="blue" subLabel={`Margin: ${grossMargin.toFixed(1)}%`} />
              <ReportKPICard label="Net Profit" value={finData?.pl?.net_profit ?? 0} color={netMargin >= 0 ? "emerald" : "rose"} subLabel={`Net: ${netMargin.toFixed(1)}%`} />
              <ReportKPICard label="Total Expenses" value={(finData?.pl?.expenses?.total ?? 0) + (finData?.pl?.salary ?? 0)} color="rose" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Margin progress bars */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Key Margins</h3>
                {[
                  { label: "Gross Margin", value: grossMargin, color: "bg-emerald-500" },
                  { label: "Net Margin", value: netMargin, color: netMargin >= 0 ? "bg-blue-500" : "bg-rose-500" },
                  {
                    label: "Expense Ratio",
                    value: (finData?.pl?.income?.total ?? 0) > 0
                      ? ((finData?.pl?.operating_expenses ?? 0) / finData.pl.income.total) * 100 : 0,
                    color: "bg-amber-500",
                  },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[var(--text-muted)]">{m.label}</span>
                      <span className="text-xs font-bold text-[var(--text-primary)]">{Math.abs(m.value).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--page-bg)]">
                      <div
                        className={cn("h-2 rounded-full transition-all", m.color)}
                        style={{ width: `${Math.min(Math.abs(m.value), 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Expense breakdown */}
              {Object.keys(finData?.pl?.expenses?.breakdown ?? {}).length > 0 && (
                <ChartCard title="Expense Breakdown">
                  <ReportDonutChart
                    data={Object.entries(finData.pl.expenses.breakdown).map(([k, v]) => ({ name: k, value: Number(v) }))}
                    height={180}
                    innerRadius={42}
                    outerRadius={65}
                    valueFormat="currency"
                  />
                </ChartCard>
              )}
            </div>
          </AnalysisSection>

          {/* ── Section 4: Stock Analysis ── */}
          <AnalysisSection
            title="Stock Analysis"
            subtitle="Top stock items by value"
            icon={<Package size={16} />}
            href="/reports/inventory"
            color="violet"
          >
            <div className="grid grid-cols-2 gap-4 mb-5">
              <ReportKPICard label="Total Stock Value" value={invData?.summary?.totalValue ?? 0} color="violet" />
              <ReportKPICard label="Total Qty" value={invData?.summary?.totalQty ?? 0} format="number" color="blue" />
            </div>
            {topInvChart.length > 0 && (
              <ChartCard title="Top Designs by Stock Value">
                <ReportBarChart
                  data={topInvChart}
                  xKey="name"
                  bars={[{ key: "value", label: "Value", color: CHART_COLORS[4] }]}
                  height={200}
                />
              </ChartCard>
            )}
          </AnalysisSection>
        </div>
      )}
    </ReportShell>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function AnalysisSection({
  title, subtitle, icon, href, color, children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
  color: "emerald" | "blue" | "amber" | "violet" | "rose";
  children: React.ReactNode;
}) {
  const borderColor = {
    emerald: "border-emerald-500",
    blue: "border-blue-500",
    amber: "border-amber-500",
    violet: "border-violet-500",
    rose: "border-rose-500",
  }[color];
  const iconColor = {
    emerald: "text-emerald-500 bg-emerald-500/10",
    blue: "text-blue-500 bg-blue-500/10",
    amber: "text-amber-500 bg-amber-500/10",
    violet: "text-violet-500 bg-violet-500/10",
    rose: "text-rose-500 bg-rose-500/10",
  }[color];

  return (
    <div className={cn("bg-[var(--card-bg)] border-l-4 border border-[var(--border)] rounded-xl p-6 shadow-[var(--shadow-sm)]", borderColor)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconColor)}>
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">{title}</h2>
            <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
        >
          View Full Report <ArrowRight size={12} />
        </Link>
      </div>
      {children}
    </div>
  );
}
