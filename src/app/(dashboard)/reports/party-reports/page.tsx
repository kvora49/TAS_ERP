"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  FileText, ArrowDownLeft, ArrowUpRight, Scale, Calendar, UserCheck,
  RotateCcw, ChevronDown, ChevronRight, AlertCircle, Clock, Info,
  CreditCard, FileSpreadsheet, Tag, Star, Users, Building2,
  TrendingUp, TrendingDown, ShoppingBag, Receipt, Filter, Eye, Printer
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportAreaChart, ReportBarChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, fmtNum, exportMultiSheetExcel, getPresetDates, printReport } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";
import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";
import InlineDrillDownPanel, { DrillDownItem } from "@/components/reports/InlineDrillDownPanel";

// ─── Top Level Tabs ───────────────────────────────────────────────────────────

type PartyTab = "statement" | "outstanding" | "aging" | "customer_report" | "supplier_report" | "all_transactions";

const PARTY_TABS: { id: PartyTab; label: string; icon: React.ReactNode }[] = [
  { id: "statement", label: "Party Statement / Ledger", icon: <Receipt size={13} /> },
  { id: "outstanding", label: "Outstanding", icon: <AlertCircle size={13} /> },
  { id: "aging", label: "Aging", icon: <Clock size={13} /> },
  { id: "customer_report", label: "Customer Report", icon: <Users size={13} /> },
  { id: "supplier_report", label: "Supplier Report", icon: <Building2 size={13} /> },
  { id: "all_transactions", label: "All Party Transactions", icon: <FileText size={13} /> },
];

const PARTY_TYPE_PILLS = [
  { id: "all", label: "All (Customers & Suppliers)" },
  { id: "customer", label: "Customers (Receivables)" },
  { id: "supplier", label: "Suppliers (Payables)" },
];

const VOUCHER_TYPE_OPTIONS = [
  { label: "All Voucher Types", value: "all" },
  { label: "Sales Invoices", value: "sales_invoice" },
  { label: "Purchase Bills", value: "purchase_bill" },
  { label: "Payments / Receipts", value: "payment" },
  { label: "Credit Notes", value: "credit_note" },
  { label: "Debit Notes", value: "debit_note" },
];

const PURCHASE_TYPE_OPTIONS = [
  { label: "All (Raw Material + FG + Accessories + Others)", value: "all" },
  { label: "Raw Material", value: "raw_material" },
  { label: "Finished Goods", value: "finished_goods" },
  { label: "Accessories", value: "accessory" },
  { label: "Others", value: "others" },
];

const AGING_BASED_ON_OPTIONS = [
  { label: "Due Date", value: "due_date" },
  { label: "Invoice Date", value: "invoice_date" },
];

const AGING_COLORS = ["#10B981", "#F59E0B", "#6366F1", "#EF4444"];
const CATEGORY_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PartyReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<PartyTab>("statement");

  // Filters
  const [partyId, setPartyId] = useState<string>("all");
  const [partyType, setPartyType] = useState<string>("all");
  const [billType, setBillType] = useState<BillType>("all");
  const [voucherType, setVoucherType] = useState<string>("all");
  const [purchaseType, setPurchaseType] = useState<string>("all");
  const [agingBasedOn, setAgingBasedOn] = useState<string>("due_date");
  const [brandId, setBrandId] = useState<string>("all");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Sub-views for customer / supplier tabs
  const [customerSubTab, setCustomerSubTab] = useState<"summary" | "customer_wise" | "top_customers" | "tx_details">("summary");
  const [supplierSubTab, setSupplierSubTab] = useState<"summary" | "supplier_wise" | "top_suppliers" | "purchase_details">("summary");
  const [txSubTab, setTxSubTab] = useState<"all" | "by_voucher" | "by_party_type" | "by_bill_type">("all");

  // Fetch Master Parties for dropdown
  const { data: partiesData } = useQuery({
    queryKey: ["parties-master-list", partyType],
    queryFn: async () => {
      const pParam = partyType !== "all" ? `?type=${partyType}` : "";
      const res = await fetch(`/api/parties${pParam}`);
      if (!res.ok) return { parties: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  const partiesList = partiesData?.parties ?? [];
  const partyOptions = [
    { label: "All Parties", value: "all" },
    ...partiesList.map((p: any) => ({
      label: p.company_name ? `${p.company_name} (${p.name})` : p.name,
      value: p.id,
    })),
  ];

  // Fetch Report Data based on activeTab
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "party-reports-v4",
      activeTab,
      from,
      to,
      partyId,
      partyType,
      billType,
      voucherType,
      purchaseType,
      agingBasedOn,
      brandId,
    ],
    queryFn: async () => {
      const apiTab = activeTab.replace(/_/g, "-");
      const params = new URLSearchParams({
        tab: apiTab,
        from,
        to,
      });
      if (partyId !== "all") params.set("party_id", partyId);
      if (partyType !== "all") params.set("party_type", partyType);
      if (billType !== "all") params.set("bill_type", billType);
      if (voucherType !== "all") params.set("voucher_type", voucherType);
      if (purchaseType !== "all") params.set("purchase_type", purchaseType);
      if (agingBasedOn) params.set("aging_based_on", agingBasedOn);
      if (brandId !== "all") params.set("brand_id", brandId);

      const res = await fetch(`/api/reports/party-reports?${params}`);
      if (!res.ok) throw new Error("Failed to load party report data");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
    setExpandedRowId(null);
  }, []);

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    if (activeTab === "statement") {
      exportMultiSheetExcel([
        {
          name: "Party Ledger",
          columns: [
            { key: "date", label: "Date", format: "date", width: 14 },
            { key: "type", label: "Voucher Type", width: 18 },
            { key: "voucher_no", label: "Voucher No.", width: 18 },
            { key: "reference", label: "Reference", width: 18 },
            { key: "bill_type", label: "Bill Type", width: 12 },
            { key: "debit", label: "Debit (Rs.)", format: "currency", width: 16 },
            { key: "credit", label: "Credit (Rs.)", format: "currency", width: 16 },
            { key: "runningBalance", label: "Running Balance (Rs.)", format: "currency", width: 20 },
            { key: "narration", label: "Narration", width: 30 },
          ],
          rows: data.rows ?? [],
        },
      ], `PartyStatement_${data.party?.name || "Party"}_${from}_${to}`);
    } else if (activeTab === "outstanding" || activeTab === "aging") {
      exportMultiSheetExcel([
        {
          name: activeTab === "outstanding" ? "Outstanding Summary" : "Aging Analysis",
          columns: [
            { key: "party_name", label: "Party Name", width: 30 },
            { key: "party_type", label: "Type", width: 14 },
            { key: "total_due", label: "Total Due (Rs.)", format: "currency", width: 18 },
            { key: "d30", label: "0-30 Days (Rs.)", format: "currency", width: 16 },
            { key: "d60", label: "31-60 Days (Rs.)", format: "currency", width: 16 },
            { key: "d90", label: "61-90 Days (Rs.)", format: "currency", width: 16 },
            { key: "over90", label: "90+ Days (Rs.)", format: "currency", width: 16 },
            { key: "overdue", label: "Overdue (Rs.)", format: "currency", width: 16 },
            { key: "last_transaction", label: "Last Transaction", width: 24 },
          ],
          rows: data.rows ?? [],
        },
      ], `Party_${activeTab}_${from}_${to}`);
    } else if (activeTab === "customer_report") {
      exportMultiSheetExcel([
        {
          name: "Customer Summary",
          columns: [
            { key: "name", label: "Customer Name", width: 30 },
            { key: "invoices", label: "Sales Invoices", format: "number", width: 14 },
            { key: "gross", label: "Gross Sales (Rs.)", format: "currency", width: 18 },
            { key: "returns", label: "Sales Returns (Rs.)", format: "currency", width: 18 },
            { key: "net", label: "Net Sales (Rs.)", format: "currency", width: 18 },
            { key: "receipts", label: "Receipts (Rs.)", format: "currency", width: 18 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 18 },
            { key: "overdue", label: "Overdue (Rs.)", format: "currency", width: 18 },
          ],
          rows: data.rows ?? [],
        },
      ], `CustomerReport_${from}_${to}`);
    } else if (activeTab === "supplier_report") {
      exportMultiSheetExcel([
        {
          name: "Supplier Summary",
          columns: [
            { key: "name", label: "Supplier Name", width: 30 },
            { key: "bills", label: "Purchase Bills", format: "number", width: 14 },
            { key: "gross", label: "Gross Purchases (Rs.)", format: "currency", width: 18 },
            { key: "returns", label: "Returns (Rs.)", format: "currency", width: 18 },
            { key: "net", label: "Net Purchases (Rs.)", format: "currency", width: 18 },
            { key: "payments", label: "Payments (Rs.)", format: "currency", width: 18 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 18 },
            { key: "overdue", label: "Overdue (Rs.)", format: "currency", width: 18 },
          ],
          rows: data.rows ?? [],
        },
      ], `SupplierReport_${from}_${to}`);
    } else if (activeTab === "all_transactions") {
      exportMultiSheetExcel([
        {
          name: "All Party Transactions",
          columns: [
            { key: "date", label: "Date", format: "date", width: 14 },
            { key: "voucher_type", label: "Voucher Type", width: 16 },
            { key: "voucher_no", label: "Voucher No.", width: 18 },
            { key: "party_name", label: "Party", width: 28 },
            { key: "party_type", label: "Party Type", width: 12 },
            { key: "bill_type", label: "Bill Type", width: 14 },
            { key: "debit", label: "Debit (Rs.)", format: "currency", width: 16 },
            { key: "credit", label: "Credit (Rs.)", format: "currency", width: 16 },
            { key: "net", label: "Net (Rs.)", format: "currency", width: 16 },
            { key: "payment_mode", label: "Mode", width: 14 },
            { key: "reference", label: "Reference", width: 20 },
          ],
          rows: data.rows ?? [],
        },
      ], `AllPartyTransactions_${from}_${to}`);
    }
  }, [data, activeTab, from, to]);

  const summary = data?.summary ?? {};

  // Aging Donut
  const agingDonutData = useMemo(() => {
    if (!data?.aging && !data?.summary?.buckets) return [];
    if (data?.aging) {
      return [
        { name: "0 - 30 Days", value: data.aging.d30 ?? 0, color: AGING_COLORS[0] },
        { name: "31 - 60 Days", value: data.aging.d60 ?? 0, color: AGING_COLORS[1] },
        { name: "61 - 90 Days", value: data.aging.d90 ?? 0, color: AGING_COLORS[2] },
        { name: "90+ Days", value: data.aging.over90 ?? 0, color: AGING_COLORS[3] },
      ].filter(d => d.value > 0);
    }
    const b = data.summary.buckets;
    return [
      { name: "0 - 30 Days", value: b.d30 ?? 0, color: AGING_COLORS[0] },
      { name: "31 - 60 Days", value: b.d60 ?? 0, color: AGING_COLORS[1] },
      { name: "61 - 90 Days", value: b.d90 ?? 0, color: AGING_COLORS[2] },
      { name: "90+ Days", value: b.over90 ?? 0, color: AGING_COLORS[3] },
    ].filter(d => d.value > 0);
  }, [data]);

  // Drilldown items generator
  const getPartyDrillItems = (row: any): DrillDownItem[] => [
    {
      id: row.id + "_detail",
      doc_number: row.voucher_no || row.id.substring(0, 8),
      date: row.date || row.last_transaction,
      party_name: row.party_name || data?.party?.name,
      description: row.narration || row.reference || `${row.party_type || "Party"} transaction`,
      category: row.voucher_type || row.party_type,
      amount: row.net || row.total_due || row.amount || 0,
      view_url: row.view_url,
      badge: row.bill_type || row.party_type,
      badge_color: "blue",
    },
  ];

  return (
    <ReportShell
      title="Party Reports"
      infoTooltip="Comprehensive financial records, party ledger statement, outstanding dues, aging analysis, customer & supplier transaction registers."
      breadcrumbs={["Reports", "Party Reports", PARTY_TABS.find(t => t.id === activeTab)?.label ?? ""]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          {/* Party Dropdown */}
          {(activeTab === "statement" || activeTab === "outstanding" || activeTab === "aging" || activeTab === "all_transactions") && (
            <FilterSelect
              label="Party"
              value={partyId}
              onChange={setPartyId}
              options={partyOptions}
              placeholder="All Parties"
            />
          )}

          {activeTab === "customer_report" && (
            <FilterSelect
              label="Customer"
              value={partyId}
              onChange={setPartyId}
              options={partyOptions}
              placeholder="All Customers"
            />
          )}

          {activeTab === "supplier_report" && (
            <FilterSelect
              label="Supplier"
              value={partyId}
              onChange={setPartyId}
              options={partyOptions}
              placeholder="All Suppliers"
            />
          )}

          {/* Party Type Pills for Outstanding & Aging */}
          {(activeTab === "outstanding" || activeTab === "aging" || activeTab === "all_transactions") && (
            <FilterSelect
              label="Party Type"
              value={partyType}
              onChange={setPartyType}
              options={[
                { label: "All (Customers & Suppliers)", value: "all" },
                { label: "Customers", value: "customer" },
                { label: "Suppliers", value: "supplier" },
              ]}
              placeholder="All Party Types"
            />
          )}

          {/* Voucher Type for Statement & All Transactions */}
          {(activeTab === "statement" || activeTab === "all_transactions") && (
            <FilterSelect
              label="Voucher Type"
              value={voucherType}
              onChange={setVoucherType}
              options={VOUCHER_TYPE_OPTIONS}
              placeholder="All Voucher Types"
            />
          )}

          {/* Purchase Type for Supplier Report */}
          {activeTab === "supplier_report" && (
            <FilterSelect
              label="Purchase Type"
              value={purchaseType}
              onChange={setPurchaseType}
              options={PURCHASE_TYPE_OPTIONS}
              placeholder="All Purchase Types"
            />
          )}

          {/* Aging Based On for Aging Report */}
          {activeTab === "aging" && (
            <FilterSelect
              label="Aging Based On"
              value={agingBasedOn}
              onChange={setAgingBasedOn}
              options={AGING_BASED_ON_OPTIONS}
              placeholder="Due Date"
            />
          )}

          {/* Bill Type Filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={billType} onChange={(v) => { setBillType(v); setExpandedRowId(null); }} />
          </div>
        </div>
      }
    >
      {/* ── Top Level Tabs Navigation ── */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto scrollbar-none pb-0 -mt-2">
        {PARTY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setExpandedRowId(null);
            }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-all border-b-2 cursor-pointer shrink-0",
              activeTab === tab.id
                ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--table-header-bg)] rounded-t-lg"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]"
            )}
          >
            {tab.icon}
            {tab.label}
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
        isEmpty={false}
      >
        {data && (
          <div className="space-y-5 pt-2">
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: PARTY STATEMENT / LEDGER */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {activeTab === "statement" && (
              <div className="space-y-5">
                {/* Selected Party Header Info Card */}
                {data.party ? (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex flex-wrap justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-[var(--primary)] font-black text-lg">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                            {data.party.company_name || data.party.name}
                          </h2>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                            data.party.party_type === "supplier" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          )}>
                            {data.party.party_type}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] mt-1 font-medium">
                          {data.party.gstin && <span>GSTIN: <strong className="text-[var(--text-primary)] font-mono">{data.party.gstin}</strong></span>}
                          {data.party.mobile && <span>Mobile: <strong className="text-[var(--text-primary)] font-mono">{data.party.mobile}</strong></span>}
                          {data.party.address && <span className="truncate max-w-xs">{data.party.address}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Balances Summary in Header */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Opening Balance</p>
                        <p className="text-sm font-bold font-mono text-[var(--text-primary)]">{fmtINR(summary.openingBalance)}</p>
                        <p className="text-[9px] text-[var(--text-faint)]">as on {fmtDate(from)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Debits</p>
                        <p className="text-sm font-bold font-mono text-emerald-600">{fmtINR(summary.totalDebits)}</p>
                        <p className="text-[9px] text-[var(--text-faint)]">In selected period</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Total Credits</p>
                        <p className="text-sm font-bold font-mono text-rose-600">{fmtINR(summary.totalCredits)}</p>
                        <p className="text-[9px] text-[var(--text-faint)]">In selected period</p>
                      </div>
                      <div className="text-right bg-[var(--table-header-bg)] border border-[var(--border)] px-4 py-2 rounded-xl">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">Closing Balance</p>
                        <p className={cn("text-lg font-black font-mono", summary.closingBalanceType === "Cr" ? "text-rose-600" : "text-emerald-600")}>
                          {fmtINR(Math.abs(summary.closingBalance ?? 0))} <span className="text-xs">{summary.closingBalanceType}</span>
                        </p>
                        <p className="text-[9px] text-[var(--text-faint)]">as on {fmtDate(to)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-8 text-center text-[var(--text-muted)]">
                    <UserCheck size={32} className="mx-auto mb-2 opacity-40 text-[var(--primary)]" />
                    <p className="text-sm font-bold text-[var(--text-primary)]">Select a Party from the Filter Bar</p>
                    <p className="text-xs mt-1">Choose any customer or supplier to view their complete chronological ledger statement.</p>
                  </div>
                )}

                {/* Ledger & Aging Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  {/* Left: Chronological Ledger Table */}
                  <div className="xl:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1.5">
                        <Receipt size={13} /> Ledger (Chronological)
                      </h3>
                      <span className="text-xs text-[var(--text-muted)]">{(data.rows ?? []).length} transactions</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Voucher Type</th>
                            <th className="py-2.5 px-3">Voucher No.</th>
                            <th className="py-2.5 px-3">Reference</th>
                            <th className="py-2.5 px-3">Bill Type</th>
                            <th className="py-2.5 px-3 text-right">Debit (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Credit (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Running Balance (Rs.)</th>
                            <th className="py-2.5 px-3">Narration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {/* Opening Balance Row */}
                          <tr className="bg-[var(--table-header-bg)]/60 font-bold">
                            <td className="py-2.5 px-3 text-[var(--text-muted)]">{fmtDate(from)}</td>
                            <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]" colSpan={4}>Opening Balance</td>
                            <td className="py-2.5 px-3 text-right font-mono">—</td>
                            <td className="py-2.5 px-3 text-right font-mono">—</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[var(--text-primary)]">{fmtINR(summary.openingBalance)}</td>
                            <td className="py-2.5 px-3 text-[var(--text-faint)]">Opening Balance</td>
                          </tr>

                          {(data.rows ?? []).map((r: any, i: number) => (
                            <tr key={r.id || i} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-3 whitespace-nowrap text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                              <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">
                                {r.view_url ? (
                                  <Link href={r.view_url} className="hover:underline text-[var(--primary)]">{r.type}</Link>
                                ) : r.type}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-[var(--text-primary)]">
                                {r.view_url ? (
                                  <Link href={r.view_url} className="hover:underline text-[var(--primary)]">{r.voucher_no}</Link>
                                ) : r.voucher_no}
                              </td>
                              <td className="py-2 px-3 font-mono text-[var(--text-muted)] text-[11px]">{r.reference || "—"}</td>
                              <td className="py-2 px-3">
                                {r.bill_type !== "—" ? (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                                    r.bill_type === "Pakka" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  )}>
                                    {r.bill_type}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600 font-bold">{r.debit > 0 ? fmtINR(r.debit) : "—"}</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">{r.credit > 0 ? fmtINR(r.credit) : "—"}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-[var(--text-primary)]">{r.runningBalanceFormatted || fmtINR(r.runningBalance)}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)] max-w-xs truncate text-[11px]">{r.narration || "—"}</td>
                            </tr>
                          ))}
                          {(data.rows ?? []).length === 0 && (
                            <tr><td colSpan={9} className="py-10 text-center text-[var(--text-muted)]">No transactions found for this party.</td></tr>
                          )}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                          <tr>
                            <td colSpan={5} className="py-3 px-3 uppercase tracking-wide text-[var(--text-muted)] text-[10px]">Total Debits / Credits / Closing</td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-600 font-black">{fmtINR(summary.totalDebits)}</td>
                            <td className="py-3 px-3 text-right font-mono text-rose-600 font-black">{fmtINR(summary.totalCredits)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-[var(--primary)]">{fmtINR(summary.closingBalance)} {summary.closingBalanceType}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Right: Aging Donut + Statement Summary */}
                  <div className="space-y-4">
                    {agingDonutData.length > 0 && (
                      <ChartCard title={`Aging Analysis (as on ${fmtDate(to)})`}>
                        <ReportDonutChart data={agingDonutData} height={180} innerRadius={42} outerRadius={68} valueFormat="currency" />
                        <div className="mt-3 space-y-1.5">
                          {agingDonutData.map(d => (
                            <div key={d.name} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1">
                              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                {d.name}
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">{fmtINR(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      </ChartCard>
                    )}

                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Statement Summary</h3>
                      {[
                        { label: "Opening Balance", value: fmtINR(summary.openingBalance), cls: "text-[var(--text-primary)]" },
                        { label: "Total Debits", value: fmtINR(summary.totalDebits), cls: "text-emerald-600" },
                        { label: "Total Credits", value: fmtINR(summary.totalCredits), cls: "text-rose-600" },
                        { label: "Closing Balance", value: `${fmtINR(Math.abs(summary.closingBalance ?? 0))} ${summary.closingBalanceType || ""}`, cls: "text-violet-600 font-black text-sm" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-2">
                          <span className="text-[var(--text-muted)]">{r.label}</span>
                          <span className={`font-bold font-mono ${r.cls}`}>{r.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-[11px] text-[var(--text-muted)] flex items-start gap-2">
                      <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      <span>Cr (Credit) balance means amount is payable to the party. Dr (Debit) balance means amount is receivable from the party.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: OUTSTANDING REPORT */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {activeTab === "outstanding" && (
              <div className="space-y-5">
                {/* 4 KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ReportKPICard
                    label="Total Outstanding"
                    value={summary.totalOutstanding}
                    color="blue"
                    icon={<Scale size={16} />}
                    subLabel={`Across ${summary.totalParties ?? 0} Parties`}
                  />
                  <ReportKPICard
                    label="Receivables (Customers)"
                    value={summary.totalReceivables}
                    color="emerald"
                    icon={<ArrowDownLeft size={16} />}
                    subLabel={`From ${summary.customerCount ?? 0} Customers`}
                  />
                  <ReportKPICard
                    label="Payables (Suppliers)"
                    value={summary.totalPayables}
                    color="rose"
                    icon={<ArrowUpRight size={16} />}
                    subLabel={`To ${summary.supplierCount ?? 0} Suppliers`}
                  />
                  <ReportKPICard
                    label="Overdue Amount"
                    value={summary.overdueTotal}
                    color="amber"
                    icon={<Clock size={16} />}
                    subLabel={`${summary.partiesWithOverdue ?? 0} Parties with Overdue`}
                  />
                </div>

                {/* Main Table */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Party Outstanding List
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">{(data.rows ?? []).length} parties</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Party Name</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Total Due (Rs.)</th>
                          <th className="py-2.5 px-3 text-right">Not Due (0-30 Days)</th>
                          <th className="py-2.5 px-3 text-right">31-60 Days</th>
                          <th className="py-2.5 px-3 text-right">61-90 Days</th>
                          <th className="py-2.5 px-3 text-right">90+ Days</th>
                          <th className="py-2.5 px-3 text-right">Overdue (Rs.)</th>
                          <th className="py-2.5 px-3">Last Transaction</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(data.rows ?? []).map((p: any) => (
                          <React.Fragment key={p.id}>
                            <tr
                              className="hover:bg-[var(--table-row-hover)] border-b border-[var(--border-light)] cursor-pointer h-10"
                              onClick={() => setExpandedRowId(expandedRowId === p.id ? null : p.id)}
                            >
                              <td className="py-2 px-3 font-bold text-[var(--text-primary)] max-w-[150px] truncate">
                                {p.party_name}
                              </td>
                              <td className="py-2 px-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                                  p.party_type === "supplier" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                )}>
                                  {p.party_type}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-black text-[var(--text-primary)]">{fmtINR(p.total_due)}</td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmtINR(p.d30)}</td>
                              <td className="py-2 px-3 text-right font-mono text-blue-600">{fmtINR(p.d60)}</td>
                              <td className="py-2 px-3 text-right font-mono text-amber-600">{fmtINR(p.d90)}</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">{fmtINR(p.over90)}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-rose-600">{fmtINR(p.overdue)}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)] text-[11px] whitespace-nowrap">{p.last_transaction}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPartyId(p.id);
                                    setActiveTab("statement");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[var(--primary)] hover:bg-violet-500/10 transition-colors"
                                >
                                  <Eye size={12} /> View
                                </button>
                              </td>
                            </tr>
                            <AnimatePresence>
                              {expandedRowId === p.id && (
                                <tr>
                                  <td colSpan={10} className="p-0">
                                    <InlineDrillDownPanel
                                      id={p.id}
                                      title={`${p.party_name} — Outstanding Breakdown`}
                                      subtitle={`${p.party_type?.toUpperCase()} · Total Outstanding ${fmtINR(p.total_due)}`}
                                      totalAmount={p.total_due}
                                      amountType={p.party_type === "supplier" ? "negative" : "positive"}
                                      items={getPartyDrillItems(p)}
                                      moduleLink={{
                                        label: "Open Full Ledger Statement",
                                        href: `/reports/party-reports?tab=statement&party_id=${p.id}`,
                                      }}
                                      onClose={() => setExpandedRowId(null)}
                                    />
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                        <tr>
                          <td colSpan={2} className="py-3 px-3 uppercase text-[10px] text-[var(--text-muted)]">Totals</td>
                          <td className="py-3 px-3 text-right font-mono font-black text-[var(--primary)]">{fmtINR(summary.totalOutstanding)}</td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-600">{fmtINR(summary.buckets?.d30)}</td>
                          <td className="py-3 px-3 text-right font-mono text-blue-600">{fmtINR(summary.buckets?.d60)}</td>
                          <td className="py-3 px-3 text-right font-mono text-amber-600">{fmtINR(summary.buckets?.d90)}</td>
                          <td className="py-3 px-3 text-right font-mono text-rose-600">{fmtINR(summary.buckets?.over90)}</td>
                          <td className="py-3 px-3 text-right font-mono font-black text-rose-600">{fmtINR(summary.overdueTotal)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* TAB 3: AGING REPORT */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {activeTab === "aging" && (
              <div className="space-y-5">
                {/* 4 Bucket KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ReportKPICard
                    label="Current (0-30 Days)"
                    value={summary.buckets?.d30}
                    color="emerald"
                    subLabel={`${summary.buckets?.d30Pct?.toFixed(1) ?? 0}% of Total Outstanding`}
                  />
                  <ReportKPICard
                    label="31 - 60 Days"
                    value={summary.buckets?.d60}
                    color="amber"
                    subLabel={`${summary.buckets?.d60Pct?.toFixed(1) ?? 0}% of Total Outstanding`}
                  />
                  <ReportKPICard
                    label="61 - 90 Days"
                    value={summary.buckets?.d90}
                    color="blue"
                    subLabel={`${summary.buckets?.d90Pct?.toFixed(1) ?? 0}% of Total Outstanding`}
                  />
                  <ReportKPICard
                    label="90+ Days"
                    value={summary.buckets?.over90}
                    color="rose"
                    subLabel={`${summary.buckets?.over90Pct?.toFixed(1) ?? 0}% of Total Outstanding`}
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  {/* Left: Aging Table */}
                  <div className="xl:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Aging Analysis (as on {fmtDate(to)})
                      </h3>
                      <span className="text-xs text-[var(--text-muted)]">{(data.rows ?? []).length} parties</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Party Name</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3 text-right">0 - 30 Days (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">31 - 60 Days (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">61 - 90 Days (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">90+ Days (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Total Outstanding (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Overdue (Rs.)</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(data.rows ?? []).map((p: any) => (
                            <tr key={p.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-3 font-bold text-[var(--text-primary)] max-w-[140px] truncate">{p.party_name}</td>
                              <td className="py-2 px-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                                  p.party_type === "supplier" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                )}>
                                  {p.party_type}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmtINR(p.d30)}</td>
                              <td className="py-2 px-3 text-right font-mono text-blue-600">{fmtINR(p.d60)}</td>
                              <td className="py-2 px-3 text-right font-mono text-amber-600">{fmtINR(p.d90)}</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">{fmtINR(p.over90)}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-[var(--text-primary)]">{fmtINR(p.total_due)}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-rose-600">{fmtINR(p.overdue)}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setPartyId(p.id);
                                    setActiveTab("statement");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[var(--primary)] hover:bg-violet-500/10 transition-colors"
                                >
                                  <Eye size={12} /> View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                          <tr>
                            <td colSpan={2} className="py-3 px-3 uppercase text-[10px] text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-600 font-black">{fmtINR(summary.buckets?.d30)}</td>
                            <td className="py-3 px-3 text-right font-mono text-blue-600 font-black">{fmtINR(summary.buckets?.d60)}</td>
                            <td className="py-3 px-3 text-right font-mono text-amber-600 font-black">{fmtINR(summary.buckets?.d90)}</td>
                            <td className="py-3 px-3 text-right font-mono text-rose-600 font-black">{fmtINR(summary.buckets?.over90)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-[var(--primary)]">{fmtINR(summary.totalOutstanding)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-rose-600">{fmtINR(summary.overdueTotal)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Right: Aging Donut + Quick Summary */}
                  <div className="space-y-4">
                    {agingDonutData.length > 0 && (
                      <ChartCard title="Aging Distribution">
                        <ReportDonutChart data={agingDonutData} height={180} innerRadius={42} outerRadius={68} valueFormat="currency" />
                        <div className="mt-3 space-y-1.5">
                          {agingDonutData.map(d => (
                            <div key={d.name} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1">
                              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                                {d.name}
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">{fmtINR(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      </ChartCard>
                    )}

                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Quick Summary</h3>
                      {[
                        { label: "Total Receivables", value: fmtINR(summary.totalReceivables), cls: "text-emerald-600" },
                        { label: "Total Payables", value: fmtINR(summary.totalPayables), cls: "text-rose-600" },
                        { label: "Total Outstanding", value: fmtINR(summary.totalOutstanding), cls: "text-violet-600 font-black" },
                        { label: "Overdue Amount", value: fmtINR(summary.overdueTotal), cls: "text-rose-600 font-bold" },
                        { label: "Parties with Overdue", value: summary.partiesWithOverdue ?? 0, cls: "text-[var(--text-primary)] font-mono" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-2">
                          <span className="text-[var(--text-muted)]">{r.label}</span>
                          <span className={`font-bold font-mono ${r.cls}`}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* TAB 4: CUSTOMER REPORT */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {activeTab === "customer_report" && (
              <div className="space-y-5">
                {/* 5 KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <ReportKPICard
                    label="Total Sales (Gross)"
                    value={summary.grossSales}
                    color="blue"
                    icon={<ShoppingBag size={16} />}
                    subLabel={`Avg. Invoice: ${fmtINR(summary.avgInvoice ?? 0)}`}
                  />
                  <ReportKPICard
                    label="Sales Returns"
                    value={summary.totalReturns}
                    color="amber"
                    icon={<RotateCcw size={16} />}
                    subLabel={`Return %: ${(summary.returnPct ?? 0).toFixed(2)}%`}
                  />
                  <ReportKPICard
                    label="Net Sales"
                    value={summary.netSales}
                    color="emerald"
                    icon={<TrendingUp size={16} />}
                    subLabel={`Invoices: ${summary.invoiceCount ?? 0}`}
                  />
                  <ReportKPICard
                    label="Receipts"
                    value={summary.totalReceipts}
                    color="indigo"
                    icon={<CreditCard size={16} />}
                    subLabel={`Payments: ${summary.receiptCount ?? 0}`}
                  />
                  <ReportKPICard
                    label="Outstanding"
                    value={summary.totalOutstanding}
                    color="rose"
                    icon={<Clock size={16} />}
                    subLabel={`Overdue: ${fmtINR(summary.totalOverdue ?? 0)}`}
                  />
                </div>

                {/* Customer Sub Tabs */}
                <div className="flex items-center gap-1 border-b border-[var(--border)]">
                  {[
                    { id: "summary", label: "Summary" },
                    { id: "customer_wise", label: "Customer Wise" },
                    { id: "top_customers", label: "Top Customers" },
                    { id: "tx_details", label: "Transaction Details" },
                  ].map((st: any) => (
                    <button
                      key={st.id}
                      onClick={() => setCustomerSubTab(st.id)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all border-b-2 cursor-pointer",
                        customerSubTab === st.id ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]"
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* 3 Analytics Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Monthly Trend */}
                  {(data.trend ?? []).length > 0 && (
                    <ChartCard title="Sales Trend (Net Sales)">
                      <ReportAreaChart
                        data={data.trend}
                        xKey="month"
                        lines={[{ key: "amount", label: "Net Sales", color: CHART_COLORS[0] }]}
                        height={160}
                      />
                    </ChartCard>
                  )}

                  {/* Product Category Donut */}
                  {(data.categoryBreakdown ?? []).length > 0 && (
                    <ChartCard title="Sales by Product Category (Net)">
                      <ReportDonutChart
                        data={(data.categoryBreakdown ?? []).map((c: any, i: number) => ({
                          name: c.category,
                          value: c.amount,
                          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                        }))}
                        height={160}
                        innerRadius={40}
                        outerRadius={65}
                        valueFormat="currency"
                      />
                    </ChartCard>
                  )}

                  {/* Bill Type Donut */}
                  {(data.billTypeBreakdown ?? []).length > 0 && (
                    <ChartCard title="Sales by Bill Type (Net)">
                      <ReportDonutChart
                        data={[
                          { name: "Pakka (GST)", value: data.billTypeBreakdown[0]?.value ?? 0, color: CHART_COLORS[0] },
                          { name: "Kachha (Non-GST)", value: data.billTypeBreakdown[1]?.value ?? 0, color: CHART_COLORS[1] },
                        ]}
                        height={160}
                        innerRadius={40}
                        outerRadius={65}
                        valueFormat="currency"
                      />
                    </ChartCard>
                  )}
                </div>

                {/* Customer Summary Table + Top 5 Overdue */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                  <div className="xl:col-span-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Customer Summary
                      </h3>
                      <span className="text-xs text-[var(--text-muted)]">{(data.rows ?? []).length} customers</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-8">#</th>
                            <th className="py-2.5 px-3">Customer Name</th>
                            <th className="py-2.5 px-3 text-center">Invoices</th>
                            <th className="py-2.5 px-3 text-right">Gross Sales (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Returns (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Net Sales (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Receipts (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Outstanding (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Overdue (Rs.)</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(data.rows ?? []).map((c: any, idx: number) => (
                            <tr key={c.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-3 text-[var(--text-faint)] font-bold">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-[var(--text-primary)] max-w-[140px] truncate">{c.name}</td>
                              <td className="py-2 px-3 text-center text-[var(--text-muted)]">{c.invoices}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(c.gross)}</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600">{fmtINR(c.returns)}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-emerald-600">{fmtINR(c.net)}</td>
                              <td className="py-2 px-3 text-right font-mono text-indigo-600">{fmtINR(c.receipts)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">{fmtINR(c.outstanding)}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-rose-600">{fmtINR(c.overdue)}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setPartyId(c.id);
                                    setActiveTab("statement");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[var(--primary)] hover:bg-violet-500/10 transition-colors"
                                >
                                  <Eye size={12} /> View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                          <tr>
                            <td colSpan={2} className="py-3 px-3 uppercase text-[10px] text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-3 text-center">{summary.invoiceCount}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(summary.grossSales)}</td>
                            <td className="py-3 px-3 text-right font-mono text-rose-600">{fmtINR(summary.totalReturns)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-emerald-600">{fmtINR(summary.netSales)}</td>
                            <td className="py-3 px-3 text-right font-mono text-indigo-600">{fmtINR(summary.totalReceipts)}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">{fmtINR(summary.totalOutstanding)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-rose-600">{fmtINR(summary.totalOverdue)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Top 5 Overdue Customers */}
                  <div className="space-y-4">
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Payment Status Summary</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">Total Receipts</span>
                          <span className="font-bold font-mono text-emerald-600">{fmtINR(summary.totalReceipts)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">Pending Receipts</span>
                          <span className="font-bold font-mono text-rose-600">{fmtINR(summary.totalOutstanding)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">Overdue Amount</span>
                          <span className="font-bold font-mono text-rose-600">{fmtINR(summary.totalOverdue)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">Average Payment Days</span>
                          <span className="font-bold font-mono text-[var(--text-primary)]">28 Days</span>
                        </div>
                      </div>
                    </div>

                    {(data.topOverdue ?? []).length > 0 && (
                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-rose-600">Top 5 Overdue Customers</h3>
                        <div className="space-y-2">
                          {(data.topOverdue ?? []).map((c: any, i: number) => (
                            <div key={c.id} className="flex items-center justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                              <span className="font-semibold text-[var(--text-primary)] truncate max-w-[130px]">{i + 1}. {c.name}</span>
                              <span className="font-mono font-bold text-rose-600">{fmtINR(c.overdue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* TAB 5: SUPPLIER REPORT */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {activeTab === "supplier_report" && (
              <div className="space-y-5">
                {/* 5 KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <ReportKPICard
                    label="Total Purchases (Gross)"
                    value={summary.grossPurchases}
                    color="violet"
                    icon={<ShoppingBag size={16} />}
                    subLabel={`Avg. Invoice: ${fmtINR(summary.avgInvoice ?? 0)}`}
                  />
                  <ReportKPICard
                    label="Purchase Returns"
                    value={summary.totalReturns}
                    color="amber"
                    icon={<RotateCcw size={16} />}
                    subLabel={`Return %: ${(summary.returnPct ?? 0).toFixed(2)}%`}
                  />
                  <ReportKPICard
                    label="Net Purchases"
                    value={summary.netPurchases}
                    color="blue"
                    icon={<TrendingDown size={16} />}
                    subLabel={`Invoices: ${summary.invoiceCount ?? 0}`}
                  />
                  <ReportKPICard
                    label="Payments"
                    value={summary.totalPayments}
                    color="emerald"
                    icon={<CreditCard size={16} />}
                    subLabel={`Payments: ${summary.paymentCount ?? 0}`}
                  />
                  <ReportKPICard
                    label="Outstanding"
                    value={summary.totalOutstanding}
                    color="rose"
                    icon={<Clock size={16} />}
                    subLabel={`Overdue: ${fmtINR(summary.totalOverdue ?? 0)}`}
                  />
                </div>

                {/* 3 Analytics Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Monthly Purchase Trend */}
                  {(data.trend ?? []).length > 0 && (
                    <ChartCard title="Purchase Trend (Net Purchases)">
                      <ReportAreaChart
                        data={data.trend}
                        xKey="month"
                        lines={[{ key: "amount", label: "Net Purchases", color: CHART_COLORS[4] }]}
                        height={160}
                      />
                    </ChartCard>
                  )}

                  {/* Purchases by Purchase Type Donut */}
                  {(data.purchaseTypeBreakdown ?? []).length > 0 && (
                    <ChartCard title="Purchases by Purchase Type (Net)">
                      <ReportDonutChart
                        data={(data.purchaseTypeBreakdown ?? []).map((pt: any, i: number) => ({
                          name: pt.type,
                          value: pt.amount,
                          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                        }))}
                        height={160}
                        innerRadius={40}
                        outerRadius={65}
                        valueFormat="currency"
                      />
                    </ChartCard>
                  )}

                  {/* Purchases by Bill Type Donut */}
                  {(data.billTypeBreakdown ?? []).length > 0 && (
                    <ChartCard title="Purchases by Bill Type (Net)">
                      <ReportDonutChart
                        data={[
                          { name: "Pakka (GST)", value: data.billTypeBreakdown[0]?.value ?? 0, color: CHART_COLORS[0] },
                          { name: "Kachha (Non-GST)", value: data.billTypeBreakdown[1]?.value ?? 0, color: CHART_COLORS[1] },
                        ]}
                        height={160}
                        innerRadius={40}
                        outerRadius={65}
                        valueFormat="currency"
                      />
                    </ChartCard>
                  )}
                </div>

                {/* Supplier Summary Table + Top 5 Overdue */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                  <div className="xl:col-span-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Supplier Summary
                      </h3>
                      <span className="text-xs text-[var(--text-muted)]">{(data.rows ?? []).length} suppliers</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-8">#</th>
                            <th className="py-2.5 px-3">Supplier Name</th>
                            <th className="py-2.5 px-3 text-center">Purchase Bills</th>
                            <th className="py-2.5 px-3 text-right">Gross Purchases (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Returns (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Net Purchases (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Payments (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Outstanding (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Overdue (Rs.)</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(data.rows ?? []).map((s: any, idx: number) => (
                            <tr key={s.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-3 text-[var(--text-faint)] font-bold">{idx + 1}</td>
                              <td className="py-2 px-3 font-bold text-[var(--text-primary)] max-w-[140px] truncate">{s.name}</td>
                              <td className="py-2 px-3 text-center text-[var(--text-muted)]">{s.bills}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(s.gross)}</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600">{fmtINR(s.returns)}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-blue-600">{fmtINR(s.net)}</td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmtINR(s.payments)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">{fmtINR(s.outstanding)}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-rose-600">{fmtINR(s.overdue)}</td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => {
                                    setPartyId(s.id);
                                    setActiveTab("statement");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[var(--primary)] hover:bg-violet-500/10 transition-colors"
                                >
                                  <Eye size={12} /> View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                          <tr>
                            <td colSpan={2} className="py-3 px-3 uppercase text-[10px] text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-3 text-center">{summary.invoiceCount}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(summary.grossPurchases)}</td>
                            <td className="py-3 px-3 text-right font-mono text-rose-600">{fmtINR(summary.totalReturns)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-blue-600">{fmtINR(summary.netPurchases)}</td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-600">{fmtINR(summary.totalPayments)}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">{fmtINR(summary.totalOutstanding)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-rose-600">{fmtINR(summary.totalOverdue)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Top 5 Overdue Suppliers */}
                  <div className="space-y-4">
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Payment Status Summary</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">Total Payments</span>
                          <span className="font-bold font-mono text-emerald-600">{fmtINR(summary.totalPayments)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">Pending Payments</span>
                          <span className="font-bold font-mono text-rose-600">{fmtINR(summary.totalOutstanding)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">Overdue Amount</span>
                          <span className="font-bold font-mono text-rose-600">{fmtINR(summary.totalOverdue)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">Average Payment Days</span>
                          <span className="font-bold font-mono text-[var(--text-primary)]">26 Days</span>
                        </div>
                      </div>
                    </div>

                    {(data.topOverdue ?? []).length > 0 && (
                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-rose-600">Top 5 Overdue Suppliers</h3>
                        <div className="space-y-2">
                          {(data.topOverdue ?? []).map((s: any, i: number) => (
                            <div key={s.id} className="flex items-center justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                              <span className="font-semibold text-[var(--text-primary)] truncate max-w-[130px]">{i + 1}. {s.name}</span>
                              <span className="font-mono font-bold text-rose-600">{fmtINR(s.overdue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* TAB 6: ALL PARTY TRANSACTIONS */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {activeTab === "all_transactions" && (
              <div className="space-y-5">
                {/* 5 KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <ReportKPICard
                    label="Total Transactions"
                    value={summary.totalTransactions}
                    format="number"
                    color="blue"
                    icon={<FileText size={16} />}
                    subLabel="In Selected Period"
                  />
                  <ReportKPICard
                    label="Total Debits (Dr)"
                    value={summary.totalDebits}
                    color="emerald"
                    icon={<ArrowDownLeft size={16} />}
                    subLabel="Payments, Returns, Debit Notes etc."
                  />
                  <ReportKPICard
                    label="Total Credits (Cr)"
                    value={summary.totalCredits}
                    color="rose"
                    icon={<ArrowUpRight size={16} />}
                    subLabel="Sales, Purchases, Receipts etc."
                  />
                  <ReportKPICard
                    label="Net Balance (Cr - Dr)"
                    value={summary.netBalance}
                    color="amber"
                    icon={<Scale size={16} />}
                    subLabel={`${summary.netBalanceType === "Cr" ? "Credit" : "Debit"} Balance`}
                  />
                  <ReportKPICard
                    label="Parties Involved"
                    value={summary.partiesInvolved}
                    format="number"
                    color="violet"
                    icon={<Users size={16} />}
                    subLabel={`Customers: ${summary.customerParties ?? 0} · Suppliers: ${summary.supplierParties ?? 0}`}
                  />
                </div>

                {/* Main Table + Right Breakdowns */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                  <div className="xl:col-span-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Transaction List (Chronological)
                      </h3>
                      <span className="text-xs text-[var(--text-muted)]">{(data.rows ?? []).length} entries</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Voucher Type</th>
                            <th className="py-2.5 px-3">Voucher No.</th>
                            <th className="py-2.5 px-3">Party</th>
                            <th className="py-2.5 px-3">Party Type</th>
                            <th className="py-2.5 px-3">Bill Type</th>
                            <th className="py-2.5 px-3 text-right">Debit (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Credit (Rs.)</th>
                            <th className="py-2.5 px-3 text-right">Net (Rs.)</th>
                            <th className="py-2.5 px-3">Payment Mode</th>
                            <th className="py-2.5 px-3">Reference</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(data.rows ?? []).map((t: any) => (
                            <tr key={t.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-3 whitespace-nowrap text-[var(--text-muted)]">{fmtDate(t.date)}</td>
                              <td className="py-2 px-3 font-semibold text-[var(--primary)]">{t.voucher_type}</td>
                              <td className="py-2 px-3 font-mono font-bold text-[var(--text-primary)]">{t.voucher_no}</td>
                              <td className="py-2 px-3 font-bold text-[var(--text-primary)] max-w-[130px] truncate">{t.party_name}</td>
                              <td className="py-2 px-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                                  t.party_type === "Supplier" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                )}>
                                  {t.party_type}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[11px] text-[var(--text-muted)]">{t.bill_type}</td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600 font-bold">{t.debit > 0 ? fmtINR(t.debit) : "—"}</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">{t.credit > 0 ? fmtINR(t.credit) : "—"}</td>
                              <td className="py-2 px-3 text-right font-mono font-black text-[var(--text-primary)]">{fmtINR(t.net)}</td>
                              <td className="py-2 px-3 text-[11px] font-mono text-[var(--text-muted)]">{t.payment_mode}</td>
                              <td className="py-2 px-3 text-[11px] font-mono text-[var(--text-muted)] max-w-[100px] truncate">{t.reference}</td>
                              <td className="py-2 px-3 text-center">
                                {t.view_url && (
                                  <Link
                                    href={t.view_url}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[var(--primary)] hover:bg-violet-500/10 transition-colors"
                                  >
                                    <Eye size={12} />
                                  </Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                          <tr>
                            <td colSpan={6} className="py-3 px-3 uppercase text-[10px] text-[var(--text-muted)]">Totals</td>
                            <td className="py-3 px-3 text-right font-mono text-emerald-600 font-black">{fmtINR(summary.totalDebits)}</td>
                            <td className="py-3 px-3 text-right font-mono text-rose-600 font-black">{fmtINR(summary.totalCredits)}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-[var(--primary)]">{fmtINR(summary.netBalance)}</td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Right Breakdowns */}
                  <div className="space-y-4">
                    {/* Transaction Breakdown Donut */}
                    {(data.transactionBreakdown ?? []).length > 0 && (
                      <ChartCard title="Transaction Breakdown">
                        <ReportDonutChart
                          data={(data.transactionBreakdown ?? []).map((tb: any, i: number) => ({
                            name: tb.name,
                            value: tb.count,
                            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                          }))}
                          height={160}
                          innerRadius={40}
                          outerRadius={65}
                          valueFormat="number"
                        />
                      </ChartCard>
                    )}

                    {/* Party Type Breakdown */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Party Type Breakdown</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                          <p className="text-[10px] font-bold uppercase text-emerald-600">Customers</p>
                          <p className="text-lg font-black font-mono text-emerald-600">{data.partyTypeBreakdown?.customers ?? 0}</p>
                          <p className="text-[9px] text-[var(--text-muted)]">{(data.partyTypeBreakdown?.customerPct ?? 0).toFixed(1)}%</p>
                        </div>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                          <p className="text-[10px] font-bold uppercase text-amber-600">Suppliers</p>
                          <p className="text-lg font-black font-mono text-amber-600">{data.partyTypeBreakdown?.suppliers ?? 0}</p>
                          <p className="text-[9px] text-[var(--text-muted)]">{(data.partyTypeBreakdown?.supplierPct ?? 0).toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Voucher Type Breakdown List */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Voucher Breakdown</h3>
                      {[
                        { label: "Sales", value: data.voucherBreakdown?.sales ?? 0, color: "text-blue-600" },
                        { label: "Purchases", value: data.voucherBreakdown?.purchases ?? 0, color: "text-violet-600" },
                        { label: "Payments", value: data.voucherBreakdown?.payments ?? 0, color: "text-rose-600" },
                        { label: "Receipts", value: data.voucherBreakdown?.receipts ?? 0, color: "text-emerald-600" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1.5">
                          <span className="text-[var(--text-muted)]">{r.label}</span>
                          <span className={`font-bold font-mono ${r.color}`}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </PageState>
    </ReportShell>
  );
}
