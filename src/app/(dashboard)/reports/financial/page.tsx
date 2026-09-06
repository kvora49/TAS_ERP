"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, DollarSign, Scale,
  Building2, ArrowDownLeft, ArrowUpRight, Receipt,
  BarChart3, ChevronDown, ChevronRight, Wallet, Banknote,
  FileText, ShieldCheck, AlertCircle, Info, ExternalLink,
  Layers, Package, CheckCircle2, ArrowRight, Landmark, Filter
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import {
  ReportDonutChart, ChartCard,
} from "@/components/reports/ReportChart";
import {
  fmtINR, fmtDate, getPresetDates,
  exportFormattedPLExcel,
  exportFormattedBalanceExcel,
  exportFormattedGSTExcel,
  exportFormattedCashFlowExcel,
} from "@/lib/report-export";
import {
  exportPLStatementPDF,
  exportBalanceSheetPDF,
  exportGSTSummaryPDF,
  exportCashFlowPDF,
} from "@/lib/pdf/report-pdf-generator";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";
import InlineDrillDownPanel, { DrillDownItem } from "@/components/reports/InlineDrillDownPanel";
import ReportTabs from "@/components/reports/ReportTabs";
import { PullToRefresh } from "@/components/shared/PullToRefresh";

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = "pl" | "balance" | "gst" | "cashflow";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "pl", label: "Profit & Loss", icon: <TrendingUp size={14} /> },
  { id: "balance", label: "Balance Sheet", icon: <Scale size={14} /> },
  { id: "gst", label: "GST Summary", icon: <Receipt size={14} /> },
  { id: "cashflow", label: "Cash Flow", icon: <Wallet size={14} /> },
];

// ─── Query hooks ──────────────────────────────────────────────────────────────

function usePLQuery(from: string, to: string, billType: BillType) {
  return useQuery({
    queryKey: ["report-financial-pl", from, to, billType],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (billType !== "all") params.set("bill_type", billType);
      const res = await fetch(`/api/reports/financial/pl?${params}`);
      if (!res.ok) throw new Error("Failed to load P&L report");
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useBalanceQuery(to: string) {
  return useQuery({
    queryKey: ["report-financial-balance", to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial/balance?to=${to}`);
      if (!res.ok) throw new Error("Failed to load Balance Sheet");
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useGSTQuery(from: string, to: string) {
  return useQuery({
    queryKey: ["report-financial-gst", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial/gst?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load GST Summary");
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useCashFlowQuery(from: string, to: string) {
  return useQuery({
    queryKey: ["report-financial-cashflow", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial/cashflow?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load Cash Flow");
      return res.json();
    },
    staleTime: 60_000,
  });
}

// ─── Main Financial Reports Page ───────────────────────────────────────────────

export default function FinancialReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<Tab>("pl");
  const [billType, setBillType] = useState<BillType>("all");
  const [gstSubTab, setGstSubTab] = useState<"overview" | "output" | "input" | "rcm">("overview");

  // Pre-fetch active queries for top-level export
  const plQuery = usePLQuery(from, to, billType);
  const balanceQuery = useBalanceQuery(to);
  const gstQuery = useGSTQuery(from, to);
  const cashFlowQuery = useCashFlowQuery(from, to);

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  // Top Level Header PDF Export Handler
  const handleTopExportPDF = useCallback(() => {
    if (activeTab === "pl" && plQuery.data) {
      exportPLStatementPDF(plQuery.data, { from, to, billType });
    } else if (activeTab === "balance" && balanceQuery.data) {
      exportBalanceSheetPDF(balanceQuery.data, { asOn: to });
    } else if (activeTab === "gst" && gstQuery.data) {
      exportGSTSummaryPDF(gstQuery.data, { from, to });
    } else if (activeTab === "cashflow" && cashFlowQuery.data) {
      exportCashFlowPDF(cashFlowQuery.data, { from, to });
    }
  }, [activeTab, plQuery.data, balanceQuery.data, gstQuery.data, cashFlowQuery.data, from, to, billType]);

  // Top Level Header Excel Export Handler
  const handleTopExportExcel = useCallback(() => {
    if (activeTab === "pl" && plQuery.data) {
      exportFormattedPLExcel(plQuery.data, from, to);
    } else if (activeTab === "balance" && balanceQuery.data) {
      exportFormattedBalanceExcel(balanceQuery.data, to);
    } else if (activeTab === "gst" && gstQuery.data) {
      exportFormattedGSTExcel(gstQuery.data, from, to);
    } else if (activeTab === "cashflow" && cashFlowQuery.data) {
      exportFormattedCashFlowExcel(cashFlowQuery.data, from, to);
    }
  }, [activeTab, plQuery.data, balanceQuery.data, gstQuery.data, cashFlowQuery.data, from, to]);

  const handleRefresh = async () => {
    if (activeTab === "pl") await plQuery.refetch();
    else if (activeTab === "balance") await balanceQuery.refetch();
    else if (activeTab === "gst") await gstQuery.refetch();
    else if (activeTab === "cashflow") await cashFlowQuery.refetch();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <ReportShell
        title="Financial Reports"
        infoTooltip="Comprehensive financial reporting — Profit & Loss, Balance Sheet, GST Summary, and Cash Flow with full inline drill-down auditability and formal exports."
        breadcrumbs={["Reports", "Financial Reports"]}
        onApply={handleApply}
        onExportPDF={handleTopExportPDF}
        onExportExcel={handleTopExportExcel}
        extraFilters={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={billType} onChange={setBillType} />
          </div>
        }
      >
        {/* Top Tab Bar */}
        <ReportTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={setActiveTab}
          layoutIdPrefix="financial-main-tabs"
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {activeTab === "pl" && (
              <PLTab from={from} to={to} billType={billType} />
            )}
            {activeTab === "balance" && (
              <BalanceTab to={to} />
            )}
            {activeTab === "gst" && (
              <GSTTab from={from} to={to} subTab={gstSubTab} setSubTab={setGstSubTab} />
            )}
            {activeTab === "cashflow" && (
              <CashFlowTab from={from} to={to} />
            )}
          </motion.div>
        </AnimatePresence>
      </ReportShell>
    </PullToRefresh>
  );
}

// ─── P&L Tab ──────────────────────────────────────────────────────────────────

function PLTab({
  from, to, billType,
}: {
  from: string; to: string;
  billType: BillType;
}) {
  const { data, isLoading, error, refetch } = usePLQuery(from, to, billType);
  const [expandCOGS, setExpandCOGS] = useState(true);
  const [expandRevenue, setExpandRevenue] = useState(true);
  const [expandExpenses, setExpandExpenses] = useState(true);

  // Set-based multi-expansion state (allows multiple drill-downs simultaneously)
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(new Set());

  const toggleDrill = (id: string) => {
    setExpandedDrills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAllDrills = () => {
    setExpandedDrills(new Set([
      "sales_fg", "sales_rm", "sales_acc", "sales_returns",
      "cogs_rm", "cogs_fg", "cogs_acc", "cogs_job_work",
      "expenses_salary",
    ]));
  };

  const collapseAllDrills = () => {
    setExpandedDrills(new Set());
  };

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={(error as any)?.message}
      onRetry={refetch}
      skeletonVariant="stats"
      skeletonCount={4}
    >
      {data && (
        <div className="space-y-6">
          {/* Period info, badges & multi-expand controls */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-[var(--text-muted)] font-medium">
            <div>
              Profit & Loss Statement for period: <span className="font-bold text-[var(--text-body)]">{fmtDate(from)}</span> to <span className="font-bold text-[var(--text-body)]">{fmtDate(to)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandedDrills.size > 0 ? collapseAllDrills : expandAllDrills}
                className="text-[11px] font-bold text-[var(--primary)] hover:underline cursor-pointer bg-[var(--primary-light)] px-2.5 py-1 rounded-md"
              >
                {expandedDrills.size > 0 ? "Collapse All Drill-Downs" : "Expand All Drill-Downs"}
              </button>
              {billType !== "all" && (
                <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", billType === "pakka" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20")}>
                  {billType} View Active
                </span>
              )}
            </div>
          </div>

          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ReportKPICard
              label="Net Sales"
              value={data.revenue.total}
              color="emerald"
              icon={<TrendingUp size={16} />}
              subLabel={`Gross: ${fmtINR(data.revenue.gross_revenue)}`}
              onClick={() => toggleDrill("sales_gross")}
            />
            <ReportKPICard
              label="Gross Profit"
              value={data.gross_profit}
              color="blue"
              icon={<DollarSign size={16} />}
              subLabel={data.gross_margin_pct !== null ? `${data.gross_margin_pct.toFixed(2)}% Margin` : undefined}
              onClick={() => toggleDrill("sales_gross")}
            />
            <ReportKPICard
              label="Operating Profit"
              value={data.operating_profit}
              color="violet"
              icon={<Layers size={16} />}
              subLabel={data.revenue.total > 0 ? `${((data.operating_profit / data.revenue.total) * 100).toFixed(2)}% of Rev` : undefined}
              onClick={() => toggleDrill("expenses_salary")}
            />
            <ReportKPICard
              label={data.net_profit >= 0 ? "Net Profit" : "Net Loss"}
              value={Math.abs(data.net_profit)}
              color={data.net_profit >= 0 ? "emerald" : "rose"}
              icon={data.net_profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              subLabel={data.net_margin_pct !== null ? `${data.net_margin_pct.toFixed(2)}% Net Margin` : undefined}
              onClick={() => toggleDrill("sales_gross")}
            />
          </div>

          {/* Main Statement (2 cols) + Summary (1 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* P&L Statement */}
            <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                  Particulars
                </h3>
                <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                  Current Period (₹)
                </span>
              </div>

              <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">

                {/* 1. REVENUE */}
                <SectionHeader
                  label="1. REVENUE FROM OPERATIONS"
                  color="emerald"
                  expanded={expandRevenue}
                  onToggle={() => setExpandRevenue((v) => !v)}
                  total={data.revenue.total}
                  tooltip="All sales grouped by item type. Click rows to inspect granular registers."
                />
                {expandRevenue && (
                  <>
                    {/* Sales Finished Goods */}
                    <PLRow
                      label="Sales – Manufactured Finished Goods"
                      value={data.revenue.finished_goods}
                      indent
                      isExpanded={expandedDrills.has("sales_fg")}
                      onSelect={() => toggleDrill("sales_fg")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("sales_fg") && (
                        <InlineDrillDownPanel
                          id="sales_fg"
                          title="Sales – Manufactured Finished Goods"
                          subtitle="Underlying sales invoices for finished garments"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.revenue.finished_goods}
                          amountType="positive"
                          items={data.revenue.drill_records?.filter((r: any) => r.category === "Finished Goods") || []}
                          moduleLink={{ label: "Open Sales Module", href: "/sales/bills" }}
                          onClose={() => toggleDrill("sales_fg")}
                        />
                      )}
                    </AnimatePresence>

                    {/* Sales Raw Material */}
                    <PLRow
                      label="Sales – Raw Materials / Fabric"
                      value={data.revenue.raw_material}
                      indent
                      isExpanded={expandedDrills.has("sales_rm")}
                      onSelect={() => toggleDrill("sales_rm")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("sales_rm") && (
                        <InlineDrillDownPanel
                          id="sales_rm"
                          title="Sales – Raw Materials / Fabric"
                          subtitle="Direct fabric and yarn sales invoices"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.revenue.raw_material}
                          amountType="positive"
                          items={data.revenue.drill_records?.filter((r: any) => r.category?.includes("Raw Material")) || []}
                          moduleLink={{ label: "Open Sales Module", href: "/sales/bills" }}
                          onClose={() => toggleDrill("sales_rm")}
                        />
                      )}
                    </AnimatePresence>

                    {/* Sales Accessories */}
                    <PLRow
                      label="Sales – Accessories & Trims"
                      value={data.revenue.accessories}
                      indent
                      isExpanded={expandedDrills.has("sales_acc")}
                      onSelect={() => toggleDrill("sales_acc")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("sales_acc") && (
                        <InlineDrillDownPanel
                          id="sales_acc"
                          title="Sales – Accessories & Trims"
                          subtitle="Buttons, zippers, threads, and trim item invoices"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.revenue.accessories}
                          amountType="positive"
                          items={data.revenue.drill_records?.filter((r: any) => r.category?.includes("Accessories")) || []}
                          moduleLink={{ label: "Open Sales Module", href: "/sales/bills" }}
                          onClose={() => toggleDrill("sales_acc")}
                        />
                      )}
                    </AnimatePresence>

                    {/* Sales Others */}
                    {data.revenue.others > 0 && (
                      <>
                        <PLRow
                          label="Sales – Others"
                          value={data.revenue.others}
                          indent
                          isExpanded={expandedDrills.has("sales_others")}
                          onSelect={() => toggleDrill("sales_others")}
                        />
                        <AnimatePresence>
                          {expandedDrills.has("sales_others") && (
                            <InlineDrillDownPanel
                              id="sales_others"
                              title="Sales – Other Items"
                              subtitle="Miscellaneous invoiced sales"
                              periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                              totalAmount={data.revenue.others}
                              amountType="positive"
                              items={data.revenue.drill_records?.filter((r: any) => r.category === "Others") || []}
                              moduleLink={{ label: "Open Sales Module", href: "/sales/bills" }}
                              onClose={() => toggleDrill("sales_others")}
                            />
                          )}
                        </AnimatePresence>
                      </>
                    )}

                    {/* Gross Sales */}
                    <PLRow
                      label="Gross Sales"
                      value={data.revenue.gross_revenue}
                      indent
                      bold
                      isExpanded={expandedDrills.has("sales_gross")}
                      onSelect={() => toggleDrill("sales_gross")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("sales_gross") && (
                        <InlineDrillDownPanel
                          id="sales_gross"
                          title="Gross Revenue from Operations (All Sales)"
                          subtitle="All active sales invoices across all categories"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.revenue.gross_revenue}
                          amountType="positive"
                          categories={[
                            { name: "Finished Goods", amount: data.revenue.finished_goods, count: data.revenue.drill_records?.filter((r: any) => r.category === "Finished Goods").length || 0 },
                            { name: "Raw Material", amount: data.revenue.raw_material, count: data.revenue.drill_records?.filter((r: any) => r.category?.includes("Raw Material")).length || 0 },
                            { name: "Accessories", amount: data.revenue.accessories, count: data.revenue.drill_records?.filter((r: any) => r.category?.includes("Accessories")).length || 0 },
                          ]}
                          items={data.revenue.drill_records || []}
                          moduleLink={{ label: "Open Sales Module", href: "/sales/bills" }}
                          onClose={() => toggleDrill("sales_gross")}
                        />
                      )}
                    </AnimatePresence>

                    {/* Sales Returns */}
                    <PLRow
                      label="Less: Sales Returns"
                      value={data.revenue.returns}
                      negative
                      indent
                      isExpanded={expandedDrills.has("sales_returns")}
                      onSelect={() => toggleDrill("sales_returns")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("sales_returns") && (
                        <InlineDrillDownPanel
                          id="sales_returns"
                          title="Sales Returns (Inward Credits)"
                          subtitle="Customer returned garments and credited invoices deducted from gross revenue"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.revenue.returns}
                          amountType="negative"
                          items={data.revenue.returns_drill_records || []}
                          moduleLink={{ label: "Open Sales Returns", href: "/sales/returns" }}
                          onClose={() => toggleDrill("sales_returns")}
                        />
                      )}
                    </AnimatePresence>
                  </>
                )}
                <PLTotalRow label="NET SALES" value={data.revenue.total} positive />

                {/* 2. COST OF GOODS SOLD */}
                <SectionHeader
                  label="2. COST OF GOODS SOLD"
                  color="rose"
                  expanded={expandCOGS}
                  onToggle={() => setExpandCOGS((v) => !v)}
                  total={data.cogs.total}
                  tooltip="Direct material consumption & job work labor."
                />
                {expandCOGS && (
                  <>
                    {/* RM Purchases Used */}
                    <PLRow
                      label="A. Manufactured Finished Goods (Raw Material Used)"
                      value={data.cogs.raw_material}
                      negative
                      indent
                      isExpanded={expandedDrills.has("cogs_rm")}
                      onSelect={() => toggleDrill("cogs_rm")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("cogs_rm") && (
                        <InlineDrillDownPanel
                          id="cogs_rm"
                          title="COGS – Raw Material / Fabric Purchases"
                          subtitle="Period fabric purchase records consumed into manufacturing"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.cogs.raw_material}
                          amountType="negative"
                          items={data.cogs.purchases_drill_records?.filter((r: any) => r.category === "Raw Material") || []}
                          moduleLink={{ label: "Open Purchases Module", href: "/raw-materials/purchases" }}
                          onClose={() => toggleDrill("cogs_rm")}
                        />
                      )}
                    </AnimatePresence>

                    {/* FG Purchases */}
                    <PLRow
                      label="B. Purchased Finished Goods Sold"
                      value={data.cogs.finished_goods}
                      negative
                      indent
                      isExpanded={expandedDrills.has("cogs_fg")}
                      onSelect={() => toggleDrill("cogs_fg")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("cogs_fg") && (
                        <InlineDrillDownPanel
                          id="cogs_fg"
                          title="COGS – Finished Goods Purchases"
                          subtitle="Directly purchased ready-to-sell finished garments"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.cogs.finished_goods}
                          amountType="negative"
                          items={data.cogs.purchases_drill_records?.filter((r: any) => r.category === "Finished Goods") || []}
                          moduleLink={{ label: "Open Purchases Module", href: "/raw-materials/purchases" }}
                          onClose={() => toggleDrill("cogs_fg")}
                        />
                      )}
                    </AnimatePresence>

                    {/* Accessories */}
                    <PLRow
                      label="C. Accessories Direct Used"
                      value={data.cogs.accessories}
                      negative
                      indent
                      isExpanded={expandedDrills.has("cogs_acc")}
                      onSelect={() => toggleDrill("cogs_acc")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("cogs_acc") && (
                        <InlineDrillDownPanel
                          id="cogs_acc"
                          title="COGS – Accessories & Trims Purchases"
                          subtitle="Buttons, zippers, packaging material direct purchases"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.cogs.accessories}
                          amountType="negative"
                          items={data.cogs.purchases_drill_records?.filter((r: any) => r.category === "Accessories") || []}
                          moduleLink={{ label: "Open Purchases Module", href: "/raw-materials/purchases" }}
                          onClose={() => toggleDrill("cogs_acc")}
                        />
                      )}
                    </AnimatePresence>

                    {/* Job Work Labor */}
                    {data.cogs.job_work > 0 && (
                      <>
                        <PLRow
                          label="D. Direct Job Work / Production Labor Cost"
                          value={data.cogs.job_work}
                          negative
                          indent
                          isExpanded={expandedDrills.has("cogs_job_work")}
                          onSelect={() => toggleDrill("cogs_job_work")}
                        />
                        <AnimatePresence>
                          {expandedDrills.has("cogs_job_work") && (
                            <InlineDrillDownPanel
                              id="cogs_job_work"
                              title="Direct Job Work & Production Labor Cost"
                              subtitle="Worker piece-rate and production stage labor costs capitalized into COGS"
                              periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                              totalAmount={data.cogs.job_work}
                              amountType="negative"
                              items={data.cogs.job_work_drill_records || []}
                              moduleLink={{ label: "Open Production Module", href: "/production" }}
                              onClose={() => toggleDrill("cogs_job_work")}
                            />
                          )}
                        </AnimatePresence>
                      </>
                    )}

                    <div className="px-5 py-2 bg-[var(--table-header-bg)] flex justify-between items-center text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-bold">
                      <span>Closing Stock Offset (RM: {fmtINR(data.cogs.closing_stock.raw_material)} · FG: {fmtINR(data.cogs.closing_stock.finished_goods)})</span>
                      <span>−{fmtINR(data.cogs.closing_stock.total)}</span>
                    </div>
                  </>
                )}
                <PLTotalRow label="TOTAL COST OF GOODS SOLD" value={data.cogs.total} negative={data.cogs.total > 0} />
                <PLTotalRow label="GROSS PROFIT" value={data.gross_profit} positive={data.gross_profit >= 0} large />

                {/* 3. OPERATING EXPENSES */}
                <SectionHeader
                  label="3. OPERATING EXPENSES"
                  color="amber"
                  expanded={expandExpenses}
                  onToggle={() => setExpandExpenses((v) => !v)}
                  total={data.operating_expenses.total}
                  tooltip="Overhead expenses and salaries. Job Work is excluded to prevent double counting."
                />
                {expandExpenses && (
                  <>
                    {/* Salaries */}
                    <PLRow
                      label="Salaries & Wages"
                      value={data.operating_expenses.salary}
                      negative
                      indent
                      isExpanded={expandedDrills.has("expenses_salary")}
                      onSelect={() => toggleDrill("expenses_salary")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("expenses_salary") && (
                        <InlineDrillDownPanel
                          id="expenses_salary"
                          title="Salaries & Staff Wages"
                          subtitle="Monthly payroll disbursements for employees and staff"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.operating_expenses.salary}
                          amountType="negative"
                          items={data.operating_expenses.salary_drill_records || []}
                          moduleLink={{ label: "Open Payroll Module", href: "/payroll" }}
                          onClose={() => toggleDrill("expenses_salary")}
                        />
                      )}
                    </AnimatePresence>

                    {/* Expense Breakdown Categories */}
                    {Object.entries(data.operating_expenses.breakdown ?? {}).map(([cat, val]) => (
                      <React.Fragment key={cat}>
                        <PLRow
                          label={cat}
                          value={val as number}
                          negative
                          indent
                          isExpanded={expandedDrills.has(`exp_${cat}`)}
                          onSelect={() => toggleDrill(`exp_${cat}`)}
                        />
                        <AnimatePresence>
                          {expandedDrills.has(`exp_${cat}`) && (
                            <InlineDrillDownPanel
                              id={`exp_${cat}`}
                              title={`Operating Overheads – ${cat}`}
                              subtitle={`Direct incurred vouchers for ${cat}`}
                              periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                              totalAmount={val as number}
                              amountType="negative"
                              items={data.operating_expenses.drill_records?.filter((r: any) => r.category === cat) || []}
                              moduleLink={{ label: "Open Expenses Module", href: "/expenses" }}
                              onClose={() => toggleDrill(`exp_${cat}`)}
                            />
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}
                  </>
                )}
                <PLTotalRow label="TOTAL OPERATING EXPENSES" value={data.operating_expenses.total} negative={data.operating_expenses.total > 0} />
                <PLTotalRow label="OPERATING PROFIT" value={data.operating_profit} positive={data.operating_profit >= 0} large />

                {/* 4. OTHER INCOME */}
                {data.misc_income.total > 0 && (
                  <>
                    <SectionHeader label="4. OTHER INCOME" color="blue" />
                    {Object.entries(data.misc_income.breakdown ?? {}).map(([type, val]) => (
                      <React.Fragment key={type}>
                        <PLRow
                          label={type}
                          value={val as number}
                          indent
                          isExpanded={expandedDrills.has(`income_${type}`)}
                          onSelect={() => toggleDrill(`income_${type}`)}
                        />
                        <AnimatePresence>
                          {expandedDrills.has(`income_${type}`) && (
                            <InlineDrillDownPanel
                              id={`income_${type}`}
                              title={`Other Direct Income – ${type}`}
                              subtitle="Direct non-sales receipts and credit entries"
                              periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                              totalAmount={val as number}
                              amountType="positive"
                              items={data.misc_income.drill_records || []}
                              moduleLink={{ label: "Open Banking Module", href: "/banking" }}
                              onClose={() => toggleDrill(`income_${type}`)}
                            />
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}
                    <PLTotalRow label="TOTAL OTHER INCOME" value={data.misc_income.total} positive />
                  </>
                )}

                {/* 5. OTHER EXPENSES */}
                {data.other_expenses.total > 0 && (
                  <>
                    <SectionHeader label="5. OTHER EXPENSES & WRITE-OFFS" color="rose" />
                    <PLRow
                      label="Bad Debts Written Off"
                      value={data.other_expenses.bad_debts}
                      negative
                      indent
                      isExpanded={expandedDrills.has("bad_debts")}
                      onSelect={() => toggleDrill("bad_debts")}
                    />
                    <AnimatePresence>
                      {expandedDrills.has("bad_debts") && (
                        <InlineDrillDownPanel
                          id="bad_debts"
                          title="Bad Debts & Uncollectible Write-offs"
                          subtitle="Uncollectible sales invoices written off in this period"
                          periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                          totalAmount={data.other_expenses.bad_debts}
                          amountType="negative"
                          items={data.other_expenses.drill_records || []}
                          moduleLink={{ label: "Open Sales Module", href: "/sales/bills" }}
                          onClose={() => toggleDrill("bad_debts")}
                        />
                      )}
                    </AnimatePresence>
                    <PLTotalRow label="TOTAL OTHER EXPENSES" value={data.other_expenses.total} negative />
                  </>
                )}

                {/* FINAL RESULT */}
                <PLTotalRow
                  label={data.net_profit >= 0 ? "NET PROFIT / (LOSS)" : "NET LOSS"}
                  value={data.net_profit}
                  positive={data.net_profit >= 0}
                  xlarge
                />
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">
              {/* Report Summary */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Report Summary</h3>
                {[
                  { label: "Net Sales", value: fmtINR(data.revenue.total) },
                  { label: "Total COGS", value: fmtINR(data.cogs.total) },
                  { label: "Gross Profit", value: fmtINR(data.gross_profit), highlight: true },
                  { label: "Gross Margin %", value: `${data.gross_margin_pct?.toFixed(2) ?? 0}%` },
                  { label: "Operating Profit", value: fmtINR(data.operating_profit) },
                  { label: "Net Profit", value: fmtINR(data.net_profit), highlight: true },
                  { label: "Net Margin %", value: `${data.net_margin_pct?.toFixed(2) ?? 0}%` },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center text-xs border-b border-[var(--border-light)] pb-2">
                    <span className="text-[var(--text-muted)] font-medium">{r.label}</span>
                    <span className={cn("font-bold font-mono", r.highlight ? "text-[var(--primary)]" : "text-[var(--text-primary)]")}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Expense Donut Chart */}
              {Object.keys(data.operating_expenses.breakdown ?? {}).length > 0 && (
                <ChartCard title="Expense Breakdown">
                  <ReportDonutChart
                    data={Object.entries(data.operating_expenses.breakdown).map(([k, v]) => ({ name: k, value: Number(v) }))}
                    height={180}
                    valueFormat="currency"
                  />
                </ChartCard>
              )}

              {/* COGS Breakdown Donut */}
              <ChartCard title="COGS Breakdown">
                <ReportDonutChart
                  data={[
                    { name: "Raw Material COGS", value: data.cogs.raw_material },
                    { name: "FG Purchased", value: data.cogs.finished_goods },
                    { name: "Accessories", value: data.cogs.accessories },
                    { name: "Job Work", value: data.cogs.job_work },
                  ].filter((d) => d.value > 0)}
                  height={180}
                  valueFormat="currency"
                />
              </ChartCard>

              {/* Pakka / Kaccha View Box */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-2">Pakka / Kaccha View</h3>
                <p className="text-[11px] text-[var(--text-faint)] mb-3">Switch between All, Pakka only, or Kaccha only for every report.</p>
                <div className="flex gap-1.5">
                  {(["all", "pakka", "kacha"] as const).map((bt) => (
                    <span key={bt} className={cn(
                      "px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors",
                      billType === bt
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "bg-[var(--table-header-bg)] text-[var(--text-muted)]"
                    )}>
                      {bt}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Drill Down Flow Diagram */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Costing Traceability Flow</h4>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 text-xs font-semibold">
              <div
                onClick={() => toggleDrill("cogs_rm")}
                className="bg-[var(--table-header-bg)] border border-[var(--border)] hover:border-[var(--primary)] rounded-lg p-3 min-w-[170px] shrink-0 cursor-pointer transition-colors"
              >
                <div className="text-[10px] text-[var(--text-faint)] font-bold uppercase">1. Raw Material Inflow</div>
                <div className="text-[var(--text-primary)] font-bold mt-1">Fabric Purchases</div>
                <div className="text-[var(--primary)] font-mono font-extrabold mt-0.5">{fmtINR(data.cogs.purchases_in_period.fabric)}</div>
              </div>
              <ArrowRight size={16} className="text-[var(--text-muted)] shrink-0" />
              <div
                onClick={() => toggleDrill("cogs_job_work")}
                className="bg-[var(--table-header-bg)] border border-[var(--border)] hover:border-[var(--primary)] rounded-lg p-3 min-w-[170px] shrink-0 cursor-pointer transition-colors"
              >
                <div className="text-[10px] text-[var(--text-faint)] font-bold uppercase">2. Manufacturing Labor</div>
                <div className="text-[var(--text-primary)] font-bold mt-1">Job Work Added</div>
                <div className="text-violet-600 font-mono font-extrabold mt-0.5">{fmtINR(data.cogs.job_work)}</div>
              </div>
              <ArrowRight size={16} className="text-[var(--text-muted)] shrink-0" />
              <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-lg p-3 min-w-[170px] shrink-0">
                <div className="text-[10px] text-[var(--text-faint)] font-bold uppercase">3. Closing Stock Offset</div>
                <div className="text-[var(--text-primary)] font-bold mt-1">RM + FG Stock Deducted</div>
                <div className="text-amber-600 font-mono font-extrabold mt-0.5">−{fmtINR(data.cogs.closing_stock.total)}</div>
              </div>
              <ArrowRight size={16} className="text-[var(--text-muted)] shrink-0" />
              <div
                onClick={() => toggleDrill("cogs_rm")}
                className="bg-[var(--table-header-bg)] border border-[var(--border)] hover:border-[var(--primary)] rounded-lg p-3 min-w-[170px] shrink-0 cursor-pointer transition-colors"
              >
                <div className="text-[10px] text-[var(--text-faint)] font-bold uppercase">4. Net COGS Matched</div>
                <div className="text-[var(--text-primary)] font-bold mt-1">Cost of Goods Sold</div>
                <div className="text-rose-600 font-mono font-extrabold mt-0.5">{fmtINR(data.cogs.total)}</div>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div className="flex items-start gap-2 text-[10px] text-[var(--text-faint)] bg-[var(--table-header-bg)] border border-[var(--border)] rounded-lg px-4 py-2.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>Click on any line item or card to expand its complete source transaction ledger inline. Multiple sections can be opened simultaneously and exported to PDF/Excel.</span>
          </div>
        </div>
      )}
    </PageState>
  );
}

// ─── Balance Sheet Tab ────────────────────────────────────────────────────────

function BalanceTab({
  to,
}: {
  to: string;
}) {
  const { data, isLoading, error, refetch } = useBalanceQuery(to);
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(new Set());

  const toggleDrill = (id: string) => {
    setExpandedDrills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={(error as any)?.message}
      onRetry={refetch}
      skeletonVariant="stats"
      skeletonCount={4}
    >
      {data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-[var(--text-muted)] font-medium">
            <div>
              Balance Sheet · As on <span className="font-bold text-[var(--text-body)]">{fmtDate(data.as_on)}</span>
            </div>
            {expandedDrills.size > 0 && (
              <button
                type="button"
                onClick={() => setExpandedDrills(new Set())}
                className="text-[11px] font-bold text-[var(--primary)] hover:underline cursor-pointer bg-[var(--primary-light)] px-2.5 py-1 rounded-md"
              >
                Collapse All ({expandedDrills.size} Open)
              </button>
            )}
          </div>

          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ReportKPICard
              label="Total Liabilities + Net Worth"
              value={data.assets.total}
              color="blue"
              icon={<Building2 size={16} />}
              onClick={() => toggleDrill("bs_bank")}
            />
            <ReportKPICard
              label="Total Assets"
              value={data.assets.total}
              color="indigo"
              icon={<BarChart3 size={16} />}
              onClick={() => toggleDrill("bs_inventory")}
            />
            <ReportKPICard
              label="Working Capital"
              value={data.working_capital}
              color={data.working_capital >= 0 ? "emerald" : "rose"}
              icon={<Wallet size={16} />}
              subLabel="Current Assets − Current Liabilities"
            />
            <ReportKPICard
              label="Net Worth"
              value={data.net_position}
              color="violet"
              icon={<DollarSign size={16} />}
            />
          </div>

          {/* Balance Status Banner */}
          <div className={cn(
            "rounded-xl p-3 border text-xs font-bold flex items-center justify-between",
            data.is_balanced
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
          )}>
            <span className="flex items-center gap-2">
              {data.is_balanced ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
              {data.is_balanced ? "✓ Balance Sheet is Balanced" : `Out of balance by ${fmtINR(Math.abs(data.difference))}`}
            </span>
            <span className="font-mono text-[11px] opacity-80">
              Total Assets ({fmtINR(data.assets.total)}) = Total Liabilities + Owner&apos;s Funds ({fmtINR(data.assets.total)})
            </span>
          </div>

          {/* Dual Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Liabilities & Owner's Funds */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-rose-500/10">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Liabilities &amp; Owner&apos;s Funds
                </h3>
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Amount (₹)
                </span>
              </div>
              <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
                <SectionHeader label="A. OWNER'S FUNDS" color="blue" small />
                <BSRow label="Net Worth / Capital Balance" value={data.net_position} indent />
                <BSRowTotal label="Total Owner's Funds" value={data.net_position} color="blue" />

                <SectionHeader label="B. NON-CURRENT LIABILITIES" color="slate" small />
                <BSRow label="Term Loans & Long-term Borrowings" value={data.liabilities.non_current.total} indent />
                <BSRowTotal label="Total Non-Current Liabilities" value={data.liabilities.non_current.total} />

                <SectionHeader label="C. CURRENT LIABILITIES" color="rose" small />
                
                {/* Trade Payables */}
                <BSRow
                  label="Trade Payables"
                  value={data.liabilities.current.trade_payables}
                  indent
                  isExpanded={expandedDrills.has("bs_payables")}
                  onSelect={() => toggleDrill("bs_payables")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_payables") && (
                    <InlineDrillDownPanel
                      id="bs_payables"
                      title="Trade Payables (Supplier Outstanding)"
                      subtitle="Unpaid purchase bills owed to suppliers"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.liabilities.current.trade_payables}
                      amountType="negative"
                      items={data.drill_records?.payables || []}
                      moduleLink={{ label: "Open Purchases", href: "/raw-materials/purchases" }}
                      onClose={() => toggleDrill("bs_payables")}
                    />
                  )}
                </AnimatePresence>

                {/* RM Payables */}
                <BSRow
                  label="  Raw Material Payables"
                  value={data.liabilities.current.rm_payables}
                  indent
                  sub
                  isExpanded={expandedDrills.has("bs_payables_rm")}
                  onSelect={() => toggleDrill("bs_payables_rm")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_payables_rm") && (
                    <InlineDrillDownPanel
                      id="bs_payables_rm"
                      title="Raw Material Supplier Payables"
                      subtitle="Unpaid fabric and raw material invoices"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.liabilities.current.rm_payables}
                      amountType="negative"
                      items={data.drill_records?.payables?.filter((r: any) => r.category?.includes("Raw")) || []}
                      moduleLink={{ label: "Open Purchases", href: "/raw-materials/purchases" }}
                      onClose={() => toggleDrill("bs_payables_rm")}
                    />
                  )}
                </AnimatePresence>

                {/* FG Payables */}
                <BSRow
                  label="  Finished Goods Payables"
                  value={data.liabilities.current.fg_payables}
                  indent
                  sub
                  isExpanded={expandedDrills.has("bs_payables_fg")}
                  onSelect={() => toggleDrill("bs_payables_fg")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_payables_fg") && (
                    <InlineDrillDownPanel
                      id="bs_payables_fg"
                      title="Finished Goods Supplier Payables"
                      subtitle="Unpaid garment supplier bills"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.liabilities.current.fg_payables}
                      amountType="negative"
                      items={data.drill_records?.payables?.filter((r: any) => r.category?.includes("Finished")) || []}
                      moduleLink={{ label: "Open Purchases", href: "/raw-materials/purchases" }}
                      onClose={() => toggleDrill("bs_payables_fg")}
                    />
                  )}
                </AnimatePresence>

                {/* Worker Payables */}
                <BSRow
                  label="Worker / Job Work Payables"
                  value={data.liabilities.current.worker_payables}
                  indent
                  isExpanded={expandedDrills.has("bs_worker_payables")}
                  onSelect={() => toggleDrill("bs_worker_payables")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_worker_payables") && (
                    <InlineDrillDownPanel
                      id="bs_worker_payables"
                      title="Worker & Job Work Labor Payables"
                      subtitle="Outstanding labor dues owed to piece-rate workers"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.liabilities.current.worker_payables}
                      amountType="negative"
                      items={data.drill_records?.worker_payables || []}
                      moduleLink={{ label: "Open Production", href: "/production" }}
                      onClose={() => toggleDrill("bs_worker_payables")}
                    />
                  )}
                </AnimatePresence>

                {/* Outstanding Expenses */}
                <BSRow
                  label="Outstanding Expenses"
                  value={data.liabilities.current.outstanding_expenses}
                  indent
                  isExpanded={expandedDrills.has("bs_expenses")}
                  onSelect={() => toggleDrill("bs_expenses")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_expenses") && (
                    <InlineDrillDownPanel
                      id="bs_expenses"
                      title="Outstanding Expense Liabilities"
                      subtitle="Operational expenses incurred but not yet disbursed"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.liabilities.current.outstanding_expenses}
                      amountType="negative"
                      items={data.drill_records?.expenses_unpaid || []}
                      moduleLink={{ label: "Open Expenses", href: "/expenses" }}
                      onClose={() => toggleDrill("bs_expenses")}
                    />
                  )}
                </AnimatePresence>

                <BSRowTotal label="Total Current Liabilities" value={data.liabilities.current.total} color="rose" />

                <div className="flex justify-between px-5 py-3.5 bg-rose-500/5 border-t-2 border-[var(--border)] font-extrabold">
                  <span className="text-xs uppercase text-rose-600 dark:text-rose-400">Total Liabilities + Owner&apos;s Funds</span>
                  <span className="font-mono text-sm text-rose-600 dark:text-rose-400">{fmtINR(data.assets.total)}</span>
                </div>
              </div>
            </div>

            {/* Middle Column: Assets */}
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-blue-500/10">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Assets
                </h3>
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Amount (₹)
                </span>
              </div>
              <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
                <SectionHeader label="A. NON-CURRENT ASSETS" color="slate" small />
                <BSRow label="Fixed Assets (Net)" value={0} indent />
                <BSRow label="Security Deposits" value={0} indent />
                <BSRowTotal label="Total Non-Current Assets" value={data.assets.non_current.total} />

                <SectionHeader label="B. CURRENT ASSETS" color="blue" small />

                {/* Total Inventory */}
                <BSRow
                  label="Inventory"
                  value={data.assets.current.inventory.total}
                  indent
                  isExpanded={expandedDrills.has("bs_inventory")}
                  onSelect={() => toggleDrill("bs_inventory")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_inventory") && (
                    <InlineDrillDownPanel
                      id="bs_inventory"
                      title="Total Inventory Valuation"
                      subtitle="Combined Raw Material and Finished Goods stock across all godowns"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.assets.current.inventory.total}
                      amountType="positive"
                      categories={[
                        { name: "Raw Material", amount: data.assets.current.inventory.raw_material, count: data.drill_records?.inventory_rm?.length || 0 },
                        { name: "Finished Goods", amount: data.assets.current.inventory.finished_goods, count: data.drill_records?.inventory_fg?.length || 0 },
                      ]}
                      items={[...(data.drill_records?.inventory_rm || []), ...(data.drill_records?.inventory_fg || [])]}
                      moduleLink={{ label: "Open Inventory", href: "/inventory" }}
                      onClose={() => toggleDrill("bs_inventory")}
                    />
                  )}
                </AnimatePresence>

                {/* RM Stock */}
                <BSRow
                  label="  Raw Materials"
                  value={data.assets.current.inventory.raw_material}
                  indent
                  sub
                  isExpanded={expandedDrills.has("bs_inventory_rm")}
                  onSelect={() => toggleDrill("bs_inventory_rm")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_inventory_rm") && (
                    <InlineDrillDownPanel
                      id="bs_inventory_rm"
                      title="Raw Material Inventory Valuation"
                      subtitle="Fabric rolls, trims, and raw material stock in godowns"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.assets.current.inventory.raw_material}
                      amountType="positive"
                      items={data.drill_records?.inventory_rm || []}
                      moduleLink={{ label: "Open Stock Ledger", href: "/raw-materials/stock" }}
                      onClose={() => toggleDrill("bs_inventory_rm")}
                    />
                  )}
                </AnimatePresence>

                {/* FG Stock */}
                <BSRow
                  label="  Finished Goods"
                  value={data.assets.current.inventory.finished_goods}
                  indent
                  sub
                  isExpanded={expandedDrills.has("bs_inventory_fg")}
                  onSelect={() => toggleDrill("bs_inventory_fg")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_inventory_fg") && (
                    <InlineDrillDownPanel
                      id="bs_inventory_fg"
                      title="Finished Goods Inventory Valuation"
                      subtitle="Ready-to-dispatch packed garments inventory"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.assets.current.inventory.finished_goods}
                      amountType="positive"
                      items={data.drill_records?.inventory_fg || []}
                      moduleLink={{ label: "Open Finished Stock", href: "/inventory" }}
                      onClose={() => toggleDrill("bs_inventory_fg")}
                    />
                  )}
                </AnimatePresence>

                {/* Receivables */}
                <BSRow
                  label="Trade Receivables"
                  value={data.assets.current.trade_receivables}
                  indent
                  isExpanded={expandedDrills.has("bs_receivables")}
                  onSelect={() => toggleDrill("bs_receivables")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_receivables") && (
                    <InlineDrillDownPanel
                      id="bs_receivables"
                      title="Trade Receivables (Customer Outstanding)"
                      subtitle="Unpaid customer sales invoices net of credits"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.assets.current.trade_receivables}
                      amountType="positive"
                      items={data.drill_records?.receivables || []}
                      moduleLink={{ label: "Open Sales Invoices", href: "/sales/bills" }}
                      onClose={() => toggleDrill("bs_receivables")}
                    />
                  )}
                </AnimatePresence>

                {/* Cash in Hand */}
                <BSRow
                  label="Cash in Hand"
                  value={data.assets.current.cash_in_hand}
                  indent
                  isExpanded={expandedDrills.has("bs_cash")}
                  onSelect={() => toggleDrill("bs_cash")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_cash") && (
                    <InlineDrillDownPanel
                      id="bs_cash"
                      title="Cash in Hand Balance"
                      subtitle="Physical cash registers and petty cash"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.assets.current.cash_in_hand}
                      amountType="positive"
                      items={data.drill_records?.bank_accounts?.filter((b: any) => b.category === "cash") || []}
                      moduleLink={{ label: "Open Banking", href: "/banking" }}
                      onClose={() => toggleDrill("bs_cash")}
                    />
                  )}
                </AnimatePresence>

                {/* Bank Accounts */}
                <BSRow
                  label="Bank Accounts"
                  value={data.assets.current.bank_accounts}
                  indent
                  isExpanded={expandedDrills.has("bs_bank")}
                  onSelect={() => toggleDrill("bs_bank")}
                />
                <AnimatePresence>
                  {expandedDrills.has("bs_bank") && (
                    <InlineDrillDownPanel
                      id="bs_bank"
                      title="Cash & Bank Account Balances"
                      subtitle="All active bank accounts, current accounts, and UPI balances"
                      periodText={`As on ${fmtDate(to)}`}
                      totalAmount={data.assets.current.bank_accounts}
                      amountType="positive"
                      items={data.drill_records?.bank_accounts || []}
                      moduleLink={{ label: "Open Banking", href: "/banking" }}
                      onClose={() => toggleDrill("bs_bank")}
                    />
                  )}
                </AnimatePresence>

                <BSRowTotal label="Total Current Assets" value={data.assets.current.total} color="blue" />

                <div className="flex justify-between px-5 py-3.5 bg-blue-500/5 border-t-2 border-[var(--border)] font-extrabold">
                  <span className="text-xs uppercase text-blue-600 dark:text-blue-400">Total Assets</span>
                  <span className="font-mono text-sm text-blue-600 dark:text-blue-400">{fmtINR(data.assets.total)}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Quick Summary & Drilldown Links */}
            <div className="space-y-4">
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Quick Summary</h3>
                {[
                  { label: "Current Assets", value: data.assets.current.total },
                  { label: "Current Liabilities", value: data.liabilities.current.total },
                  { label: "Working Capital", value: data.working_capital, bold: true },
                  { label: "Net Worth", value: data.net_position, bold: true },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center text-xs border-b border-[var(--border-light)] pb-2">
                    <span className="text-[var(--text-muted)] font-medium">{r.label}</span>
                    <span className={cn("font-bold font-mono", r.bold ? "text-[var(--primary)]" : "text-[var(--text-primary)]")}>{fmtINR(r.value)}</span>
                  </div>
                ))}
              </div>

              {/* Direct Drilldown Navigation Panel */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Interactive Drill Down</h3>
                <p className="text-[11px] text-[var(--text-faint)]">Click to expand underlying registers inline</p>
                <div className="space-y-1">
                  {[
                    { label: "Raw Material & FG Stock", id: "bs_inventory" },
                    { label: "Trade Receivables Register", id: "bs_receivables" },
                    { label: "Trade Payables Register", id: "bs_payables" },
                    { label: "Worker Labor Payables", id: "bs_worker_payables" },
                    { label: "Bank & Cash Accounts", id: "bs_bank" },
                    { label: "Outstanding Expenses", id: "bs_expenses" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => toggleDrill(item.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer",
                        expandedDrills.has(item.id)
                          ? "bg-[var(--primary-light)] text-[var(--primary)] font-bold"
                          : "hover:bg-[var(--table-header-bg)] text-[var(--text-body)]"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <ChevronRight size={13} className={cn("transition-transform", expandedDrills.has(item.id) ? "rotate-90 text-[var(--primary)]" : "text-[var(--text-faint)]")} />
                        {item.label}
                      </span>
                      {expandedDrills.has(item.id) && (
                        <span className="text-[10px] uppercase font-bold text-[var(--primary)]">Open</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Accounts Breakdown */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5 shadow-[var(--shadow-sm)]">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Bank Accounts</h3>
                {data.drill_records?.bank_accounts?.map((b: any) => (
                  <div
                    key={b.id}
                    onClick={() => toggleDrill("bs_bank")}
                    className="flex justify-between items-center text-xs border-b border-[var(--border-light)] pb-2 cursor-pointer hover:bg-[var(--table-row-hover)] p-1 rounded transition-colors"
                  >
                    <span className="text-[var(--text-muted)] font-medium truncate flex items-center gap-1.5">
                      <Landmark size={12} className="text-[var(--text-faint)]" />
                      {b.doc_number}
                    </span>
                    <span className="font-bold font-mono text-[var(--text-primary)] ml-2 shrink-0">{fmtINR(b.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageState>
  );
}

// ─── GST Summary Tab ──────────────────────────────────────────────────────────

type GSTSubTab = "overview" | "output" | "input" | "rcm";

const GST_SUBTABS: { id: GSTSubTab; label: string }[] = [
  { id: "overview", label: "GST Overview" },
  { id: "output", label: "Outward Supplies" },
  { id: "input", label: "Input Supplies" },
  { id: "rcm", label: "RCM" },
];

function GSTTab({
  from, to, subTab, setSubTab,
}: {
  from: string; to: string;
  subTab: GSTSubTab;
  setSubTab: (s: GSTSubTab) => void;
}) {
  const { data, isLoading, error, refetch } = useGSTQuery(from, to);
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(new Set());

  const toggleDrill = (id: string) => {
    setExpandedDrills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={(error as any)?.message}
      onRetry={refetch}
      skeletonVariant="stats"
      skeletonCount={5}
    >
      {data && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-[var(--text-muted)] font-medium">
              GST Summary · <span className="font-bold text-[var(--text-body)]">{fmtDate(from)}</span> to <span className="font-bold text-[var(--text-body)]">{fmtDate(to)}</span>
            </div>
            {expandedDrills.size > 0 && (
              <button
                type="button"
                onClick={() => setExpandedDrills(new Set())}
                className="text-[11px] font-bold text-[var(--primary)] hover:underline cursor-pointer bg-[var(--primary-light)] px-2.5 py-1 rounded-md"
              >
                Collapse All ({expandedDrills.size} Open)
              </button>
            )}
          </div>

          {/* 5 Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            <ReportKPICard
              label="Taxable Supplies (Outward)"
              value={data.output_gst.totals.taxable_value}
              color="slate"
              subLabel="Excl. Tax"
              onClick={() => toggleDrill("gst_output")}
            />
            <ReportKPICard
              label="Output GST (Total)"
              value={data.output_gst.totals.total}
              color="emerald"
              onClick={() => toggleDrill("gst_output")}
            />
            <ReportKPICard
              label="Eligible ITC (Total)"
              value={data.input_gst.totals.total}
              color="rose"
              onClick={() => toggleDrill("gst_input")}
            />
            <ReportKPICard
              label="RCM Liability"
              value={data.rcm.totals.total}
              color="amber"
              onClick={() => toggleDrill("gst_rcm")}
            />
            <div className="col-span-2 md:col-span-1">
              <ReportKPICard
                label={data.summary.net_payable.direction === "payable" ? "Net GST Payable" : "ITC Credit Available"}
                value={Math.abs(data.summary.net_payable.total)}
                color={data.summary.net_payable.direction === "payable" ? "violet" : "emerald"}
                onClick={() => toggleDrill("gst_output")}
              />
            </div>
          </div>

          {/* Sub Tab Navigation */}
          <ReportTabs
            tabs={GST_SUBTABS.map(st => ({
              ...st,
              badge: st.id === "rcm" && data.rcm.rows.length > 0 ? data.rcm.rows.length : undefined,
              badgeColor: "bg-amber-500 text-white",
            }))}
            activeTab={subTab}
            onChange={setSubTab}
            layoutIdPrefix="gst-subtabs"
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={subTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {subTab === "overview" && (
                <GSTOverview
                  data={data}
                  from={from}
                  to={to}
                  expandedDrills={expandedDrills}
                  toggleDrill={toggleDrill}
                />
              )}
              {subTab === "output" && <GSTTable rows={data.output_gst.rows} totals={data.output_gst.totals} type="output" note={data.output_gst.note} />}
              {subTab === "input" && <GSTTable rows={[...data.input_gst.rows, ...data.input_gst.expense_rows]} totals={data.input_gst.totals} type="input" note={data.input_gst.note} />}
              {subTab === "rcm" && <GSTTable rows={data.rcm.rows} totals={data.rcm.totals} type="rcm" note={data.rcm.note} />}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </PageState>
  );
}

function GSTOverview({
  data, from, to, expandedDrills, toggleDrill,
}: {
  data: any; from: string; to: string;
  expandedDrills: Set<string>;
  toggleDrill: (id: string) => void;
}) {
  const isPayable = data.summary.net_payable.direction === "payable";
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Output Tax Summary */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-emerald-500/10">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Output Tax Summary
            </h3>
            <button
              type="button"
              onClick={() => toggleDrill("gst_output")}
              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              {expandedDrills.has("gst_output") ? "Collapse ↑" : "Drill Down ↓"}
            </button>
          </div>
          <div className="divide-y divide-[var(--border-light)] text-xs">
            <div className="flex justify-between px-5 py-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide bg-[var(--table-header-bg)]">
              <span>Tax Type</span><span>Tax Amount (₹)</span>
            </div>
            {[
              { label: "CGST", value: data.output_gst.totals.cgst },
              { label: "SGST", value: data.output_gst.totals.sgst },
              { label: "IGST", value: data.output_gst.totals.igst },
              { label: "CESS", value: 0 },
            ].map((r) => (
              <div key={r.label} className="flex justify-between px-5 py-2.5 font-semibold">
                <span className="text-[var(--text-muted)]">{r.label}</span>
                <span className="font-mono font-bold text-[var(--text-body)]">{fmtINR(r.value)}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 bg-emerald-500/5 border-t border-[var(--border)] font-extrabold text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 uppercase">Total Output GST</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">{fmtINR(data.output_gst.totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Input Supplies Summary */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-rose-500/10">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Input Supplies Summary (Gross)
            </h3>
            <button
              type="button"
              onClick={() => toggleDrill("gst_input")}
              className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              {expandedDrills.has("gst_input") ? "Collapse ↑" : "Drill Down ↓"}
            </button>
          </div>
          <div className="divide-y divide-[var(--border-light)] text-xs">
            <div className="flex justify-between px-5 py-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide bg-[var(--table-header-bg)]">
              <span>Category</span><span>GST Amount (₹)</span>
            </div>
            {[
              { label: "Raw Materials", value: data.input_gst.totals.cgst + data.input_gst.totals.sgst },
              { label: "Finished Goods", value: 0 },
              { label: "Accessories", value: 0 },
              { label: "Others", value: 0 },
            ].map((r) => (
              <div key={r.label} className="flex justify-between px-5 py-2.5 font-semibold">
                <span className="text-[var(--text-muted)]">{r.label}</span>
                <span className="font-mono font-bold text-[var(--text-body)]">{fmtINR(r.value)}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-3 bg-rose-500/5 border-t border-[var(--border)] font-extrabold text-xs">
              <span className="text-rose-600 dark:text-rose-400 uppercase">Total Input GST</span>
              <span className="font-mono text-rose-600 dark:text-rose-400">{fmtINR(data.input_gst.totals.total)}</span>
            </div>
          </div>
        </div>

        {/* GST Liability Calculation */}
        <div className="space-y-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3 shadow-[var(--shadow-sm)]">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">GST Liability Calculation</h3>
            {[
              { label: "Output GST (Total)", value: data.summary.output_gst.total, color: "text-[var(--text-primary)]" },
              { label: "Add: RCM Liability", value: data.summary.rcm_gst.total, color: "text-amber-500" },
              { label: "Less: Eligible ITC", value: -data.summary.input_gst.total, color: "text-rose-500" },
              { label: "Less: Eligible RCM ITC", value: 0, color: "text-rose-500" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-2">
                <span className="text-[var(--text-muted)]">{r.label}</span>
                <span className={cn("font-bold font-mono", r.color)}>{fmtINR(r.value)}</span>
              </div>
            ))}
            <div className={cn("text-center text-sm font-extrabold py-2.5 rounded-xl mt-2 border", isPayable ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500")}>
              {isPayable ? "Net GST Payable" : "ITC Credit Available"}: <span className="font-mono">{fmtINR(Math.abs(data.summary.net_payable.total))}</span>
            </div>
          </div>

          {/* Breakdown by Head */}
          <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2 shadow-[var(--shadow-sm)]">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Net Position by Tax Head</h3>
            {[
              { label: "CGST", payable: data.summary.net_payable.cgst },
              { label: "SGST", payable: data.summary.net_payable.sgst },
              { label: "IGST", payable: data.summary.net_payable.igst },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5 last:border-0">
                <span className="text-[var(--text-muted)] font-medium">{r.label}</span>
                <span className={cn("font-bold font-mono", r.payable >= 0 ? "text-amber-500" : "text-emerald-500")}>{fmtINR(r.payable)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 text-[10px] text-[var(--text-faint)] bg-[var(--table-header-bg)] border border-[var(--border)] rounded-lg px-4 py-2.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>Kaccha bills are non-GST transactions and strictly excluded from GST computation.</span>
          </div>
        </div>
      </div>

      {/* Inline Output Drilldown */}
      <AnimatePresence>
        {expandedDrills.has("gst_output") && (
          <InlineDrillDownPanel
            id="gst_output"
            title="Outward Supplies Register (Pakka GST Sales)"
            subtitle="Taxable customer sales invoices collected"
            periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
            totalAmount={data.output_gst.totals.total}
            amountType="positive"
            items={data.output_gst.rows.map((r: any) => ({
              id: r.id,
              doc_number: r.doc_number,
              date: r.date,
              party_name: r.party_name,
              description: `GSTIN: ${r.gstin || "Unregistered"} · Taxable: ₹${r.taxable_value}`,
              amount: r.total_gst,
              badge: "Pakka",
              badge_color: "emerald",
              view_url: `/sales/bills/${r.id}`,
            }))}
            moduleLink={{ label: "Open Sales Module", href: "/sales/bills" }}
            onClose={() => toggleDrill("gst_output")}
          />
        )}
      </AnimatePresence>

      {/* Inline Input Drilldown */}
      <AnimatePresence>
        {expandedDrills.has("gst_input") && (
          <InlineDrillDownPanel
            id="gst_input"
            title="Input Tax Credit (ITC Eligible Purchases & Expenses)"
            subtitle="GST paid on raw material purchases and business expenses"
            periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
            totalAmount={data.input_gst.totals.total}
            amountType="negative"
            items={[...data.input_gst.rows, ...data.input_gst.expense_rows].map((r: any) => ({
              id: r.id,
              doc_number: r.doc_number,
              date: r.date,
              party_name: r.party_name,
              description: `Taxable: ₹${r.taxable_value} (CGST: ₹${r.cgst} · SGST: ₹${r.sgst})`,
              amount: r.total_gst,
              badge: r.type === "input_expense" ? "Expense ITC" : "Purchase ITC",
              badge_color: "blue",
              view_url: r.type === "input_expense" ? "/expenses" : `/raw-materials/purchases/${r.id}`,
            }))}
            moduleLink={{ label: "Open Purchases", href: "/raw-materials/purchases" }}
            onClose={() => toggleDrill("gst_input")}
          />
        )}
      </AnimatePresence>

      {/* Inline RCM Drilldown */}
      <AnimatePresence>
        {expandedDrills.has("gst_rcm") && (
          <InlineDrillDownPanel
            id="gst_rcm"
            title="Reverse Charge Mechanism (RCM) Liabilities"
            subtitle="Purchases where GST is payable directly by the buyer"
            periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
            totalAmount={data.rcm.totals.total}
            amountType="negative"
            items={data.rcm.rows.map((r: any) => ({
              id: r.id,
              doc_number: r.doc_number,
              date: r.date,
              party_name: r.party_name,
              description: `RCM Taxable: ₹${r.taxable_value} · Supplier: ${r.party_name}`,
              amount: r.total_gst,
              badge: "RCM",
              badge_color: "amber",
              view_url: `/raw-materials/purchases/${r.id}`,
            }))}
            moduleLink={{ label: "Open Purchases", href: "/raw-materials/purchases" }}
            onClose={() => toggleDrill("gst_rcm")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GSTTable({ rows, totals, type, note }: { rows: any[]; totals: any; type: string; note?: string }) {
  return (
    <div className="space-y-4">
      {note && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)] bg-[var(--table-header-bg)] border border-[var(--border)] rounded-lg px-4 py-2.5">
          <Info size={12} className="shrink-0" />
          <span>{note}</span>
        </div>
      )}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                {["Bill / Invoice No.", "Date", type === "output" ? "Customer" : "Supplier", "GSTIN", "Taxable (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total GST (₹)"].map((h) => (
                  <th key={h} className={`py-3 px-4 ${h.includes("₹") ? "text-right" : ""} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-[var(--text-muted)]">No records found for this period.</td></tr>
              ) : rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-[var(--table-row-hover)] h-11">
                  <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">{row.doc_number}</td>
                  <td className="py-2 px-4 text-[var(--text-muted)] whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="py-2 px-4 max-w-[180px] truncate">{row.party_name}</td>
                  <td className="py-2 px-4 font-mono text-[var(--text-faint)]">{row.gstin}</td>
                  <td className="py-2 px-4 text-right font-mono">{fmtINR(row.taxable_value)}</td>
                  <td className="py-2 px-4 text-right font-mono">{fmtINR(row.cgst)}</td>
                  <td className="py-2 px-4 text-right font-mono">{fmtINR(row.sgst)}</td>
                  <td className="py-2 px-4 text-right font-mono">{fmtINR(row.igst)}</td>
                  <td className="py-2 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(row.total_gst)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] text-xs font-bold">
              <tr>
                <td colSpan={4} className="py-3 px-4 uppercase tracking-wide text-[var(--text-muted)]">Totals</td>
                <td className="py-3 px-4 text-right font-mono">{fmtINR(totals.taxable_value ?? totals.purchases_taxable ?? 0)}</td>
                <td className="py-3 px-4 text-right font-mono">{fmtINR(totals.cgst)}</td>
                <td className="py-3 px-4 text-right font-mono">{fmtINR(totals.sgst)}</td>
                <td className="py-3 px-4 text-right font-mono">{fmtINR(totals.igst)}</td>
                <td className="py-3 px-4 text-right font-mono text-[var(--primary)]">{fmtINR(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-[var(--border-light)]">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">No records found for this period.</div>
          ) : (
            rows.map((row: any) => (
              <div key={row.id} className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[var(--primary)]">{row.doc_number}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{fmtDate(row.date)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)] truncate max-w-[65%]">{row.party_name}</span>
                  {row.gstin && <span className="font-mono text-[10px] text-[var(--text-faint)] truncate max-w-[32%]">{row.gstin}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[var(--border-light)] text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-[var(--text-faint)]">Taxable Value</span>
                    <p className="font-mono font-semibold text-[var(--text-body)]">{fmtINR(row.taxable_value)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-[var(--text-faint)]">Total GST</span>
                    <p className="font-mono font-bold text-[var(--primary)]">{fmtINR(row.total_gst)}</p>
                  </div>
                </div>
                {(row.cgst > 0 || row.sgst > 0 || row.igst > 0) && (
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)] font-mono bg-[var(--table-header-bg)] px-2 py-1 rounded">
                    {row.cgst > 0 && <span>CGST: {fmtINR(row.cgst)}</span>}
                    {row.sgst > 0 && <span>SGST: {fmtINR(row.sgst)}</span>}
                    {row.igst > 0 && <span>IGST: {fmtINR(row.igst)}</span>}
                  </div>
                )}
              </div>
            ))
          )}
          {rows.length > 0 && (
            <div className="p-3.5 bg-[var(--table-header-bg)] flex justify-between items-center text-xs font-bold">
              <span className="uppercase text-[var(--text-muted)] text-[10px]">Total ({rows.length} records)</span>
              <span className="font-mono text-[var(--primary)]">{fmtINR(totals.total)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cash Flow Tab ────────────────────────────────────────────────────────────

function CashFlowTab({
  from, to,
}: {
  from: string; to: string;
}) {
  const { data, isLoading, error, refetch } = useCashFlowQuery(from, to);
  const [cfTab, setCfTab] = useState<"overview" | "transactions">("overview");
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(new Set());

  const toggleDrill = (id: string) => {
    setExpandedDrills((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const modeLabels: Record<string, string> = {
    cash: "Cash", bank_transfer: "Bank Transfer", upi: "UPI",
    cheque: "Cheque", neft: "NEFT", rtgs: "RTGS",
  };

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={(error as any)?.message}
      onRetry={refetch}
      skeletonVariant="stats"
      skeletonCount={5}
    >
      {data && (
        <div className="space-y-6">
          {/* Top 5 Hero KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Opening Balance</p>
              <p className="text-xl font-extrabold text-[var(--text-primary)] font-mono mt-1">{fmtINR(data.opening_balance)}</p>
              <p className="text-[10px] text-[var(--text-faint)] mt-1">as on {fmtDate(from)}</p>
            </div>
            <ReportKPICard
              label="Total Inflows"
              value={data.inflows.total}
              color="emerald"
              icon={<ArrowDownLeft size={16} />}
              onClick={() => toggleDrill("cf_inflows")}
            />
            <ReportKPICard
              label="Total Outflows"
              value={data.outflows.total}
              color="rose"
              icon={<ArrowUpRight size={16} />}
              onClick={() => toggleDrill("cf_outflows")}
            />
            <ReportKPICard
              label="Net Cash Flow"
              value={Math.abs(data.net_cash_flow)}
              color={data.net_cash_flow >= 0 ? "emerald" : "rose"}
              icon={data.net_cash_flow >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              subLabel={data.net_cash_flow >= 0 ? "Positive Flow" : "Negative Flow"}
            />
            <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white rounded-xl p-4 shadow-[var(--shadow-md)]">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Closing Balance</p>
              <p className="text-xl font-extrabold font-mono mt-1">{fmtINR(data.closing_balance)}</p>
              <p className="text-[10px] opacity-70 mt-1">as on {fmtDate(to)}</p>
            </div>
          </div>

          {/* Secondary Breakdown by Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Cash in Hand", value: data.cash_in_hand, icon: <Banknote size={15} className="text-emerald-500" /> },
              { label: "Bank Accounts", value: data.bank_balance, icon: <Landmark size={15} className="text-blue-500" /> },
            ].map((r) => (
              <div key={r.label} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between shadow-[var(--shadow-sm)]">
                <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                  {r.icon}
                  {r.label}
                </span>
                <span className="font-bold font-mono text-[var(--text-primary)] text-sm">{fmtINR(r.value)}</span>
              </div>
            ))}
          </div>

          {/* Sub Navigation */}
          <ReportTabs
            tabs={[
              { id: "overview", label: "Overview & Activities" },
              { id: "transactions", label: "Recent Cash Transactions" },
            ]}
            activeTab={cfTab}
            onChange={setCfTab}
            layoutIdPrefix="cashflow-subtabs"
          />

          {cfTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inflows Card */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft size={14} className="text-emerald-500" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Cash Inflows</h3>
                    </div>
                    <button
                      onClick={() => toggleDrill("cf_inflows")}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {expandedDrills.has("cf_inflows") ? "Collapse ↑" : "Drill Down ↓"}
                    </button>
                  </div>
                  <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
                    <div className="flex justify-between px-5 py-2.5 cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => toggleDrill("cf_inflows")}>
                      <span className="text-[var(--text-muted)]">Customer Receipts (Collections)</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(data.inflows.customer_receipts)}</span>
                    </div>
                    <div className="flex justify-between px-5 py-2.5 cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => toggleDrill("cf_inflows")}>
                      <span className="text-[var(--text-muted)]">Misc Income Received</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(data.inflows.misc_income)}</span>
                    </div>
                    {Object.entries(data.inflows.by_mode ?? {}).map(([mode, amt]) => (
                      <div key={mode} className="flex justify-between px-5 py-2.5 pl-8 bg-[var(--table-header-bg)]">
                        <span className="text-[var(--text-faint)] capitalize">{modeLabels[mode] ?? mode}</span>
                        <span className="font-mono font-bold text-[var(--text-muted)]">{fmtINR(Number(amt))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-5 py-3 bg-emerald-500/5 border-t border-emerald-500/20">
                      <span className="font-extrabold text-[10px] uppercase text-emerald-600 dark:text-emerald-400">Total Operating Inflows</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{fmtINR(data.inflows.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Outflows Card */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-rose-500/10">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight size={14} className="text-rose-500" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">Cash Outflows</h3>
                    </div>
                    <button
                      onClick={() => toggleDrill("cf_outflows")}
                      className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      {expandedDrills.has("cf_outflows") ? "Collapse ↑" : "Drill Down ↓"}
                    </button>
                  </div>
                  <div className="divide-y divide-[var(--border-light)] text-xs font-semibold">
                    <div className="flex justify-between px-5 py-2.5 cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => toggleDrill("cf_outflows")}>
                      <span className="text-[var(--text-muted)]">Supplier Payments (Materials & FG)</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{fmtINR(data.outflows.supplier_payments)}</span>
                    </div>
                    <div className="flex justify-between px-5 py-2.5 cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => toggleDrill("cf_outflows")}>
                      <span className="text-[var(--text-muted)]">Worker Stage Labor Payouts</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{fmtINR(data.outflows.worker_payments)}</span>
                    </div>
                    <div className="flex justify-between px-5 py-2.5 cursor-pointer hover:bg-[var(--table-row-hover)]" onClick={() => toggleDrill("cf_outflows")}>
                      <span className="text-[var(--text-muted)]">Operating Expenses & Rent</span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{fmtINR(data.outflows.expense_payments)}</span>
                    </div>
                    {Object.entries(data.outflows.by_mode ?? {}).map(([mode, amt]) => (
                      <div key={mode} className="flex justify-between px-5 py-2.5 pl-8 bg-[var(--table-header-bg)]">
                        <span className="text-[var(--text-faint)] capitalize">{modeLabels[mode] ?? mode}</span>
                        <span className="font-mono font-bold text-[var(--text-muted)]">{fmtINR(Number(amt))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-5 py-3 bg-rose-500/5 border-t border-rose-500/20">
                      <span className="font-extrabold text-[10px] uppercase text-rose-600 dark:text-rose-400">Total Operating Outflows</span>
                      <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400">{fmtINR(data.outflows.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Summary */}
                <div className="space-y-4">
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3 shadow-[var(--shadow-sm)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Net Cash Flow Summary</h3>
                    {[
                      { label: "Total Inflows", value: fmtINR(data.inflows.total), positive: true },
                      { label: "Total Outflows", value: `−${fmtINR(data.outflows.total)}`, negative: true },
                      { label: "Net Cash Flow", value: fmtINR(data.net_cash_flow), bold: true },
                      { label: "Opening Cash/Bank", value: fmtINR(data.opening_balance) },
                      { label: "Closing Cash/Bank", value: fmtINR(data.closing_balance), bold: true },
                    ].map((r) => (
                      <div key={r.label} className="flex justify-between items-center text-xs border-b border-[var(--border-light)] pb-2">
                        <span className="text-[var(--text-muted)] font-medium">{r.label}</span>
                        <span className={cn("font-mono font-bold", r.positive && "text-emerald-600 dark:text-emerald-400", r.negative && "text-rose-600 dark:text-rose-400", r.bold && "text-[var(--primary)] text-sm")}>
                          {r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Inline Inflows Drilldown */}
              <AnimatePresence>
                {expandedDrills.has("cf_inflows") && (
                  <InlineDrillDownPanel
                    id="cf_inflows"
                    title="Cash & Bank Inflows (Customer Collections & Misc)"
                    subtitle="Direct customer receipts and cash inflow vouchers"
                    periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                    totalAmount={data.inflows.total}
                    amountType="positive"
                    items={data.inflows.rows || []}
                    moduleLink={{ label: "Open Banking", href: "/banking" }}
                    onClose={() => toggleDrill("cf_inflows")}
                  />
                )}
              </AnimatePresence>

              {/* Inline Outflows Drilldown */}
              <AnimatePresence>
                {expandedDrills.has("cf_outflows") && (
                  <InlineDrillDownPanel
                    id="cf_outflows"
                    title="Cash & Bank Outflows (Disbursements)"
                    subtitle="Payments to suppliers, workers, and operational expenses"
                    periodText={`${fmtDate(from)} – ${fmtDate(to)}`}
                    totalAmount={data.outflows.total}
                    amountType="negative"
                    items={data.outflows.rows || []}
                    moduleLink={{ label: "Open Banking", href: "/banking" }}
                    onClose={() => toggleDrill("cf_outflows")}
                  />
                )}
              </AnimatePresence>
            </div>
          )}

          {cfTab === "transactions" && (
            <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Combined Cash Flow Activity Ledger ({[...data.inflows.rows, ...data.outflows.rows].length} Transactions)
                </span>
              </div>
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Doc / Voucher</th>
                      <th className="py-3 px-4">Party / Name</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Inflow (₹)</th>
                      <th className="py-3 px-4 text-right">Outflow (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                    {[
                      ...data.inflows.rows.map((r: any) => ({ ...r, isInflow: true })),
                      ...data.outflows.rows.map((r: any) => ({ ...r, isInflow: false })),
                    ]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((row: any) => (
                        <tr key={row.id} className="hover:bg-[var(--table-row-hover)] h-10">
                          <td className="py-2 px-4 whitespace-nowrap text-[var(--text-muted)]">{fmtDate(row.date)}</td>
                          <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">{row.doc_number}</td>
                          <td className="py-2 px-4 max-w-[180px] truncate">{row.party_name || "—"}</td>
                          <td className="py-2 px-4 max-w-[220px] truncate text-[var(--text-muted)]">{row.description || "—"}</td>
                          <td className="py-2 px-4">
                            <span className={cn("text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded", row.isInflow ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
                              {row.isInflow ? "Receipt" : "Payment"}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {row.isInflow ? fmtINR(row.amount) : "—"}
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {!row.isInflow ? fmtINR(row.amount) : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-[10px] text-[var(--text-faint)] bg-[var(--table-header-bg)] border border-[var(--border)] rounded-lg px-4 py-2.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>{data.note}</span>
          </div>
        </div>
      )}
    </PageState>
  );
}

// ─── Helper Sub-Components ────────────────────────────────────────────────────

function SectionHeader({
  label, color, expanded, onToggle, total, small = false, tooltip,
}: {
  label: string; color: string;
  expanded?: boolean; onToggle?: () => void;
  total?: number; small?: boolean; tooltip?: string;
}) {
  const bg =
    color === "emerald" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
    color === "rose" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" :
    color === "amber" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" :
    color === "blue" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" :
    "bg-[var(--table-header-bg)] text-[var(--text-body)]";

  return (
    <div
      className={cn(`flex items-center justify-between px-5 py-2.5 ${bg}`, onToggle && "cursor-pointer hover:brightness-95 select-none")}
      onClick={onToggle}
      title={tooltip}
    >
      <div className="flex items-center gap-2">
        {onToggle && (expanded ? <ChevronDown size={13} className="opacity-70" /> : <ChevronRight size={13} className="opacity-70" />)}
        <span className={cn("font-extrabold uppercase tracking-wide", small ? "text-[9px]" : "text-[10px]")}>{label}</span>
      </div>
      {total !== undefined && (
        <span className="font-mono text-[10px] font-bold opacity-80">{fmtINR(total)}</span>
      )}
    </div>
  );
}

function PLRow({
  label, value, negative = false, indent = false, bold = false, isExpanded = false, onSelect,
}: {
  label: string; value: number; negative?: boolean; indent?: boolean; bold?: boolean; isExpanded?: boolean; onSelect?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex justify-between items-center px-5 py-2.5 hover:bg-[var(--table-row-hover)] transition-colors",
        indent && "pl-8",
        onSelect && "cursor-pointer group",
        isExpanded && "bg-[var(--primary-light)]/40"
      )}
    >
      <div className="flex items-center gap-2">
        {onSelect && (
          <ChevronDown
            size={13}
            className={cn(
              "text-[var(--text-faint)] transition-transform duration-200 group-hover:text-[var(--primary)]",
              isExpanded && "rotate-180 text-[var(--primary)]"
            )}
          />
        )}
        <span className={cn("text-[var(--text-muted)]", bold && "font-bold text-[var(--text-body)]", onSelect && "group-hover:text-[var(--primary)]")}>
          {label}
        </span>
      </div>
      <span className={cn(
        "font-mono",
        bold ? "font-extrabold text-[var(--text-primary)]" : "font-bold",
        negative ? "text-rose-600 dark:text-rose-400" : "text-[var(--text-body)]"
      )}>
        {negative && value > 0 ? `(${fmtINR(value)})` : fmtINR(value || 0)}
      </span>
    </div>
  );
}

function PLTotalRow({
  label, value, positive = false, negative = false, large = false, xlarge = false,
}: {
  label: string; value: number; positive?: boolean; negative?: boolean; large?: boolean; xlarge?: boolean;
}) {
  return (
    <div className={cn(
      "flex justify-between px-5 border-t border-[var(--border)] bg-[var(--table-header-bg)]",
      large ? "py-3 border-t-2" : xlarge ? "py-4 border-t-2 bg-[var(--primary-light)]" : "py-2.5",
    )}>
      <span className={cn(
        "font-extrabold uppercase tracking-wide",
        xlarge ? "text-[12px] text-[var(--primary)]" : large ? "text-[11px] text-[var(--text-body)]" : "text-[10px] text-[var(--text-body)]"
      )}>
        {label}
      </span>
      <span className={cn(
        "font-extrabold font-mono",
        xlarge ? "text-lg text-[var(--primary)]" : large ? "text-base" : "text-sm",
        !xlarge && positive ? "text-emerald-600 dark:text-emerald-400" : !xlarge && negative ? "text-rose-600 dark:text-rose-400" : "text-[var(--text-primary)]",
      )}>
        {fmtINR(value || 0)}
      </span>
    </div>
  );
}

function BSRow({
  label, value, indent = false, sub = false, isExpanded = false, onSelect,
}: {
  label: string; value: number; indent?: boolean; sub?: boolean; isExpanded?: boolean; onSelect?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex justify-between items-center px-5 py-2.5 hover:bg-[var(--table-row-hover)] transition-colors",
        indent && (sub ? "pl-12" : "pl-8"),
        onSelect && "cursor-pointer group",
        isExpanded && "bg-[var(--primary-light)]/40"
      )}
    >
      <div className="flex items-center gap-2">
        {onSelect && (
          <ChevronDown
            size={13}
            className={cn(
              "text-[var(--text-faint)] transition-transform duration-200 group-hover:text-[var(--primary)]",
              isExpanded && "rotate-180 text-[var(--primary)]"
            )}
          />
        )}
        <span className={cn("text-[var(--text-muted)]", sub && "text-[var(--text-faint)] text-[10px]", onSelect && "group-hover:text-[var(--primary)]")}>
          {label}
        </span>
      </div>
      <span className="font-bold font-mono text-[var(--text-body)]">{fmtINR(value)}</span>
    </div>
  );
}

function BSRowTotal({ label, value, color = "" }: { label: string; value: number; color?: string }) {
  const colorClass = color === "blue"
    ? "text-blue-600 dark:text-blue-400 bg-blue-500/5"
    : color === "rose"
    ? "text-rose-600 dark:text-rose-400 bg-rose-500/5"
    : "text-[var(--text-muted)] bg-[var(--table-header-bg)]";
  return (
    <div className={cn("flex justify-between px-5 py-2.5 border-t border-[var(--border)]", colorClass)}>
      <span className="font-extrabold text-[10px] uppercase tracking-wide">{label}</span>
      <span className="font-extrabold font-mono">{fmtINR(value)}</span>
    </div>
  );
}
