"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, DollarSign, Scale,
  Building2, ArrowDownLeft, ArrowUpRight, Receipt,
  BarChart3, ShoppingCart
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import {
  ReportBarChart, ReportDonutChart, ReportAreaChart, ChartCard, CHART_COLORS,
} from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, exportToExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = "pl" | "balance" | "gst" | "cashflow";

const TABS: { id: Tab; label: string }[] = [
  { id: "pl", label: "Profit & Loss" },
  { id: "balance", label: "Balance Sheet" },
  { id: "gst", label: "GST Summary" },
  { id: "cashflow", label: "Cash Flow" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancialReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<Tab>("pl");
  const [gstSection, setGstSection] = useState<"sales" | "purchases">("sales");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-financial", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load financial report");
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
    const tab = activeTab;
    if (tab === "pl") {
      exportToExcel(
        [
          { key: "label", label: "Particulars", width: 35 },
          { key: "value", label: "Amount (₹)", format: "currency", width: 20 },
        ],
        buildPLRows(data.pl),
        `ProfitLoss_${from}_${to}`
      );
    } else if (tab === "gst") {
      const rows = gstSection === "sales" ? data.gst.sales_rows : data.gst.purchase_rows;
      exportToExcel(
        [
          { key: "number", label: "Bill/Invoice No.", width: 20 },
          { key: "date", label: "Date", format: "date", width: 14 },
          { key: "party", label: "Party", width: 28 },
          { key: "taxable", label: "Taxable (₹)", format: "currency", width: 18 },
          { key: "gst", label: "GST (₹)", format: "currency", width: 16 },
          { key: "total", label: "Total (₹)", format: "currency", width: 18 },
        ],
        rows,
        `GST_${gstSection}_${from}_${to}`
      );
    }
  }, [data, activeTab, gstSection, from, to]);

  return (
    <ReportShell
      title="Financial Reports"
      infoTooltip="Comprehensive financial reporting — Profit & Loss, Balance Sheet, GST Summary, and Cash Flow in one place."
      breadcrumbs={["Reports", "Financial Reports"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
    >
      {/* Tab switcher */}
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
        skeletonCount={4}
      >
        {data && (
          <>
            {activeTab === "pl" && <PLTab data={data} />}
            {activeTab === "balance" && <BalanceTab data={data} />}
            {activeTab === "gst" && (
              <GSTTab data={data} section={gstSection} setSection={setGstSection} />
            )}
            {activeTab === "cashflow" && <CashFlowTab data={data} />}
          </>
        )}
      </PageState>
    </ReportShell>
  );
}

// ─── P&L Tab ─────────────────────────────────────────────────────────────────

function PLTab({ data }: { data: any }) {
  const pl = data.pl;
  const isProfit = pl.net_profit >= 0;

  const expBreakdownChart = Object.entries(pl.expenses.breakdown ?? {}).map(([k, v]) => ({
    name: k,
    value: Number(v),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportKPICard label="Total Revenue" value={pl.income.revenue} color="emerald" icon={<TrendingUp size={16} />} />
        <ReportKPICard label="Gross Profit" value={pl.gross_profit} color="blue" icon={<DollarSign size={16} />}
          subLabel={`Margin: ${pl.gross_margin_pct?.toFixed(1)}%`} />
        <ReportKPICard label="Total Expenses" value={pl.expenses.total + pl.salary} color="rose" icon={<TrendingDown size={16} />} />
        <ReportKPICard
          label="Net Profit / (Loss)"
          value={pl.net_profit}
          color={isProfit ? "emerald" : "rose"}
          icon={isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          subLabel={`Net Margin: ${pl.net_margin_pct?.toFixed(1)}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P&L Statement */}
        <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
              Income & Expenditure Statement — {data.from} to {data.to}
            </h3>
          </div>
          <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
            <SectionHeader label="A. INCOME" color="emerald" />
            <PLRow label="Revenue from Sales" value={pl.income.revenue} />
            <PLRow label="Miscellaneous Income" value={pl.income.misc_income} />
            <PLTotalRow label="Total Income" value={pl.income.total} positive />

            <SectionHeader label="B. COST OF GOODS SOLD" color="rose" />
            <PLRow label="Raw Material Purchases" value={pl.cogs} negative />
            <PLTotalRow label="Gross Profit (A − B)" value={pl.gross_profit} positive={pl.gross_profit >= 0} />

            <SectionHeader label="C. OPERATING EXPENSES" color="amber" />
            {Object.entries(pl.expenses.breakdown ?? {}).map(([cat, val]) => (
              <PLRow key={cat} label={cat} value={val as number} negative indent />
            ))}
            <PLRow label="Salaries & Wages" value={pl.salary} negative indent />
            <PLTotalRow label="Total Operating Expenses" value={pl.operating_expenses} negative />
            <PLTotalRow label="Operating Profit" value={pl.operating_profit} positive={pl.operating_profit >= 0} large />
            <PLRow label="Bad Debts Written Off" value={pl.bad_debts} negative indent />
            <PLTotalRow label="NET PROFIT / (LOSS)" value={pl.net_profit} positive={isProfit} large />
          </div>
        </div>

        {/* Expense breakdown chart */}
        <div className="space-y-4">
          {expBreakdownChart.length > 0 && (
            <ChartCard title="Expense Breakdown">
              <ReportDonutChart data={expBreakdownChart} height={200} valueFormat="currency" />
            </ChartCard>
          )}
          {/* Key Ratios */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Key Ratios</h3>
            {[
              { label: "Gross Margin", value: `${pl.gross_margin_pct?.toFixed(2) ?? 0}%` },
              { label: "Net Margin", value: `${pl.net_margin_pct?.toFixed(2) ?? 0}%` },
              { label: "Expense Ratio", value: pl.income.total > 0 ? `${((pl.operating_expenses / pl.income.total) * 100).toFixed(2)}%` : "—" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)] font-medium">{r.label}</span>
                <span className="font-bold text-[var(--text-primary)]">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Balance Sheet Tab ────────────────────────────────────────────────────────

function BalanceTab({ data }: { data: any }) {
  const bs = data.balance_sheet;
  const totalAssets = Object.values(bs.assets).reduce((s: number, v) => s + Number(v), 0);
  const totalLiabilities = Object.values(bs.liabilities).reduce((s: number, v) => s + Number(v), 0);
  const totalEquity = Object.values(bs.equity).reduce((s: number, v) => s + Number(v), 0);
  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

  const assetChart = Object.entries(bs.assets).map(([k, v]) => ({
    name: k.replace(/_/g, " "),
    value: Number(v),
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ReportKPICard label="Total Assets" value={totalAssets} color="blue" icon={<Building2 size={16} />} />
        <ReportKPICard label="Total Liabilities" value={totalLiabilities} color="rose" icon={<Scale size={16} />} />
        <ReportKPICard label="Total Equity" value={totalEquity} color="emerald" icon={<DollarSign size={16} />} />
      </div>

      {/* Balance check */}
      <div className={cn(
        "rounded-xl p-3 border text-xs font-bold flex items-center gap-2",
        balanced
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
          : "bg-amber-500/10 border-amber-500/20 text-amber-500"
      )}>
        <Scale size={14} />
        {balanced ? "Balance Sheet is balanced ✓" : `Out of balance by ${fmtINR(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}`}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assets */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)] bg-blue-500/10">
            <Building2 size={14} className="text-blue-500" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-500">Assets</h3>
          </div>
          <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
            {Object.entries(bs.assets).map(([key, val]) => (
              <div key={key} className="flex justify-between px-5 py-3">
                <span className="text-[var(--text-muted)] capitalize">{key.replace(/_/g, " ")}</span>
                <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(Number(val))}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 bg-blue-500/5 border-t border-[var(--border)]">
              <span className="font-extrabold text-[10px] uppercase text-blue-500">Total Assets</span>
              <span className="font-extrabold font-mono text-blue-500">{fmtINR(totalAssets)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities + Equity */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)] bg-rose-500/10">
            <Scale size={14} className="text-rose-500" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-500">Liabilities & Equity</h3>
          </div>
          <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
            <div className="px-5 py-2 bg-rose-500/5">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Liabilities</span>
            </div>
            {Object.entries(bs.liabilities).map(([key, val]) => (
              <div key={key} className="flex justify-between px-5 py-3 pl-8">
                <span className="text-[var(--text-muted)] capitalize">{key.replace(/_/g, " ")}</span>
                <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(Number(val))}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 bg-rose-500/5 border-t border-[var(--border)]">
              <span className="font-extrabold text-[10px] uppercase text-rose-500">Total Liabilities</span>
              <span className="font-extrabold font-mono text-rose-500">{fmtINR(totalLiabilities)}</span>
            </div>
            <div className="px-5 py-2 bg-emerald-500/5">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Equity</span>
            </div>
            {Object.entries(bs.equity).map(([key, val]) => (
              <div key={key} className="flex justify-between px-5 py-3 pl-8">
                <span className="text-[var(--text-muted)] capitalize">{key.replace(/_/g, " ")}</span>
                <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(Number(val))}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 bg-[var(--table-header-bg)] border-t-2 border-[var(--border)]">
              <span className="font-extrabold text-[10px] uppercase text-[var(--text-muted)]">Total Liabilities + Equity</span>
              <span className="font-extrabold font-mono text-[var(--text-primary)]">{fmtINR(totalLiabilities + totalEquity)}</span>
            </div>
          </div>
        </div>

        {/* Asset composition chart */}
        <ChartCard title="Assets Composition">
          <ReportDonutChart data={assetChart} height={200} valueFormat="currency" />
        </ChartCard>
      </div>
    </div>
  );
}

// ─── GST Summary Tab ──────────────────────────────────────────────────────────

function GSTTab({
  data, section, setSection,
}: {
  data: any;
  section: "sales" | "purchases";
  setSection: (s: "sales" | "purchases") => void;
}) {
  const gst = data.gst;
  const isPayable = gst.summary.net_gst_payable >= 0;
  const rows = section === "sales" ? gst.sales_rows : gst.purchase_rows;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <ReportKPICard label="Taxable Sales" value={gst.summary.net_taxable_sales} color="slate" format="currency" subLabel="Excl. Tax" />
        <ReportKPICard label="Output GST (Collected)" value={gst.summary.total_output_gst} color="emerald" />
        <ReportKPICard label="Taxable Purchases" value={gst.summary.net_taxable_purchases} color="slate" format="currency" subLabel="Excl. Tax" />
        <ReportKPICard label="Input GST (Paid)" value={gst.summary.total_input_gst} color="rose" />
        <ReportKPICard
          label={isPayable ? "Net GST Payable" : "GST Credit"}
          value={Math.abs(gst.summary.net_gst_payable)}
          color={isPayable ? "amber" : "emerald"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Tab toggle */}
          <div className="flex border-b border-[var(--border)] gap-6">
            {(["sales", "purchases"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSection(tab)}
                className={cn(
                  "pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer capitalize",
                  section === tab
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]"
                )}
              >
                {tab === "sales" ? "Sales / Output GST" : "Purchases / Input GST"}
              </button>
            ))}
          </div>

          {/* Transaction table */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                    {["Bill / Invoice No.", "Date", "Party", "Taxable (₹)", "GST (₹)", "Total (₹)"].map((h) => (
                      <th key={h} className={`py-3 px-5 ${h.includes("₹") ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-[var(--text-muted)]">No records found.</td></tr>
                  ) : rows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-[var(--table-row-hover)] h-11">
                      <td className="py-2.5 px-5 font-mono font-bold text-[var(--text-primary)]">{row.number}</td>
                      <td className="py-2.5 px-5 text-[var(--text-muted)]">{fmtDate(row.date)}</td>
                      <td className="py-2.5 px-5">{row.party}</td>
                      <td className="py-2.5 px-5 text-right font-mono">{fmtINR(row.taxable)}</td>
                      <td className="py-2.5 px-5 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(row.gst)}</td>
                      <td className="py-2.5 px-5 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] text-xs font-bold">
                  <tr>
                    <td colSpan={3} className="py-3 px-5 uppercase tracking-wide text-[var(--text-muted)]">Totals</td>
                    <td className="py-3 px-5 text-right font-mono">{fmtINR(rows.reduce((s: number, r: any) => s + r.taxable, 0))}</td>
                    <td className="py-3 px-5 text-right font-mono text-[var(--primary)]">{fmtINR(rows.reduce((s: number, r: any) => s + r.gst, 0))}</td>
                    <td className="py-3 px-5 text-right font-mono">{fmtINR(rows.reduce((s: number, r: any) => s + r.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* GST Liability Summary */}
        <div className="space-y-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">GST Liability Summary</h3>
            {[
              { label: "Total Output Tax (A)", value: gst.summary.total_output_gst, color: "text-[var(--text-primary)]" },
              { label: "Total Input Tax ITC (B)", value: -gst.summary.total_input_gst, color: "text-rose-500" },
              { label: "Net GST Payable (C = A−B)", value: gst.summary.net_gst_payable, color: isPayable ? "text-amber-500" : "text-emerald-500" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-2">
                <span className="text-[var(--text-muted)]">{r.label}</span>
                <span className={cn("font-bold font-mono", r.color)}>{fmtINR(r.value)}</span>
              </div>
            ))}
            <div className={cn(
              "text-center text-xs font-bold py-1.5 rounded-md",
              isPayable ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
            )}>
              {isPayable ? "Payable" : "Credit"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cash Flow Tab ────────────────────────────────────────────────────────────

function CashFlowTab({ data }: { data: any }) {
  const cf = data.cash_flow;
  const isPositive = cf.net_cash_flow >= 0;

  const modeLabels: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    upi: "UPI",
    cheque: "Cheque",
    neft: "NEFT",
    rtgs: "RTGS",
  };

  const inflowChart = Object.entries(cf.inflow_by_mode ?? {}).map(([k, v]) => ({
    name: modeLabels[k] ?? k,
    value: Number(v),
  }));
  const outflowChart = Object.entries(cf.outflow_by_mode ?? {}).map(([k, v]) => ({
    name: modeLabels[k] ?? k,
    value: Number(v),
  }));

  return (
    <div className="space-y-6">
      {/* Net Cash Flow hero card */}
      <div className={cn(
        "rounded-xl p-5 text-white shadow-md",
        isPositive ? "bg-emerald-600" : "bg-rose-600"
      )}>
        <p className="text-xs font-bold uppercase tracking-widest opacity-80">Net Cash Flow</p>
        <p className="text-3xl font-extrabold mt-1">{fmtINR(cf.net_cash_flow)}</p>
        <p className="text-xs opacity-70 mt-1">{data.from} → {data.to}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <ReportKPICard label="Total Cash Inflows" value={cf.total_inflows} color="emerald" icon={<ArrowDownLeft size={16} />} />
        <ReportKPICard label="Total Cash Outflows" value={cf.total_outflows} color="rose" icon={<ArrowUpRight size={16} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inflows */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)] bg-emerald-500/10">
            <ArrowDownLeft size={14} className="text-emerald-500" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-500">Cash Inflows</h3>
          </div>
          <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
            {Object.entries(cf.inflow_by_mode ?? {}).map(([mode, amount]) => (
              <div key={mode} className="flex justify-between px-5 py-3">
                <span className="text-[var(--text-muted)] capitalize">{modeLabels[mode] ?? mode}</span>
                <span className="font-mono font-bold text-emerald-500">{fmtINR(Number(amount))}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 bg-emerald-500/5 border-t border-emerald-500/20">
              <span className="font-extrabold text-[10px] uppercase text-emerald-500">Total Inflows</span>
              <span className="font-mono font-extrabold text-emerald-500">{fmtINR(cf.total_inflows)}</span>
            </div>
          </div>
        </div>

        {/* Outflows */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)] bg-rose-500/10">
            <ArrowUpRight size={14} className="text-rose-500" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-500">Cash Outflows</h3>
          </div>
          <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
            {Object.entries(cf.outflow_by_mode ?? {}).map(([mode, amount]) => (
              <div key={mode} className="flex justify-between px-5 py-3">
                <span className="text-[var(--text-muted)] capitalize">{modeLabels[mode] ?? mode}</span>
                <span className="font-mono font-bold text-rose-500">{fmtINR(Number(amount))}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 bg-rose-500/5 border-t border-rose-500/20">
              <span className="font-extrabold text-[10px] uppercase text-rose-500">Total Outflows</span>
              <span className="font-mono font-extrabold text-rose-500">{fmtINR(cf.total_outflows)}</span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-4">
          {inflowChart.length > 0 && (
            <ChartCard title="Inflows by Mode">
              <ReportDonutChart data={inflowChart} height={170} valueFormat="currency" innerRadius={40} outerRadius={65} />
            </ChartCard>
          )}
          {outflowChart.length > 0 && (
            <ChartCard title="Outflows by Mode">
              <ReportDonutChart data={outflowChart} height={170} valueFormat="currency" innerRadius={40} outerRadius={65} />
            </ChartCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── P&L helper sub-components ────────────────────────────────────────────────

function SectionHeader({ label, color }: { label: string; color: string }) {
  const bg = color === "emerald" ? "bg-emerald-500/10" : color === "rose" ? "bg-rose-500/10" : "bg-amber-500/10";
  return (
    <div className={`px-5 py-2.5 ${bg}`}>
      <span className="text-[10px] font-extrabold text-[var(--text-body)] uppercase tracking-wide">{label}</span>
    </div>
  );
}

function PLRow({ label, value, negative = false, indent = false }: { label: string; value: number; negative?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between px-5 py-2.5 hover:bg-[var(--table-row-hover)] ${indent ? "pl-10" : ""}`}>
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-bold font-mono ${negative ? "text-rose-500" : "text-[var(--text-body)]"}`}>
        {negative && value > 0 ? `(${fmtINR(value)})` : fmtINR(value || 0)}
      </span>
    </div>
  );
}

function PLTotalRow({ label, value, positive = false, negative = false, large = false }: any) {
  return (
    <div className={`flex justify-between px-5 py-3 border-t border-[var(--border)] bg-[var(--table-header-bg)] ${large ? "border-t-2" : ""}`}>
      <span className={`font-extrabold uppercase tracking-wide text-[var(--text-body)] ${large ? "text-[11px]" : "text-[10px]"}`}>{label}</span>
      <span className={`font-extrabold font-mono ${large ? "text-base" : "text-sm"} ${positive ? "text-emerald-500" : negative ? "text-rose-500" : "text-[var(--text-primary)]"}`}>
        {fmtINR(value || 0)}
      </span>
    </div>
  );
}

// Build P&L rows for Excel export
function buildPLRows(pl: any): Record<string, any>[] {
  return [
    { label: "INCOME", value: "" },
    { label: "Revenue from Sales", value: pl.income.revenue },
    { label: "Miscellaneous Income", value: pl.income.misc_income },
    { label: "Total Income", value: pl.income.total },
    { label: "", value: "" },
    { label: "COST OF GOODS SOLD", value: "" },
    { label: "Raw Material Purchases", value: pl.cogs },
    { label: "Gross Profit", value: pl.gross_profit },
    { label: "", value: "" },
    { label: "OPERATING EXPENSES", value: "" },
    ...Object.entries(pl.expenses.breakdown ?? {}).map(([k, v]) => ({ label: `  ${k}`, value: v })),
    { label: "  Salaries & Wages", value: pl.salary },
    { label: "Total Operating Expenses", value: pl.operating_expenses },
    { label: "", value: "" },
    { label: "Operating Profit", value: pl.operating_profit },
    { label: "Bad Debts Written Off", value: pl.bad_debts },
    { label: "NET PROFIT / (LOSS)", value: pl.net_profit },
  ];
}
