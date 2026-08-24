"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Banknote, Building2, QrCode,
  FileText, Clock, RotateCcw, ChevronDown, ChevronRight, Eye,
  CheckCircle2, AlertCircle, IndianRupee, TrendingUp, TrendingDown,
  Layers, ArrowLeftRight, Package, Star, ChevronUp
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportBarChart, ReportDonutChart, ReportAreaChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, fmtNum, exportToExcel, exportMultiSheetExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";

// ─── Tab Types ────────────────────────────────────────────────────────────────

type PayTab = "receivables" | "payables" | "receipts" | "payments" | "accounts" | "cheques" | "advances" | "transfers" | "all_transactions";

const TABS: { id: PayTab; label: string; icon: React.ReactNode }[] = [
  { id: "receivables", label: "Receivables", icon: <ArrowDownLeft size={12} /> },
  { id: "payables", label: "Payables", icon: <ArrowUpRight size={12} /> },
  { id: "receipts", label: "Receipts", icon: <CheckCircle2 size={12} /> },
  { id: "payments", label: "Payments", icon: <CreditCard size={12} /> },
  { id: "accounts", label: "Accounts", icon: <Building2 size={12} /> },
  { id: "cheques", label: "Cheques", icon: <FileText size={12} /> },
  { id: "advances", label: "Advances", icon: <Package size={12} /> },
  { id: "transfers", label: "Transfers", icon: <ArrowLeftRight size={12} /> },
  { id: "all_transactions", label: "All Transactions", icon: <Layers size={12} /> },
];

const AGING_COLORS = ["#10B981", "#F59E0B", "#F97316", "#EF4444"];
const AGING_LABELS: Record<string, string> = { "0-30": "0 – 30 Days", "31-60": "31 – 60 Days", "61-90": "61 – 90 Days", "90+": "90+ Days" };

const MODE_LABEL: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", upi: "UPI",
  cheque: "Cheque", neft: "NEFT", rtgs: "RTGS", other: "Other",
};

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  partial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  unpaid: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  Adjusted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Partial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Unadjusted: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  cleared: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  deposited: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  bounced: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  Completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const TYPE_BADGE: Record<string, string> = {
  "Raw Material": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Finished Goods": "bg-violet-500/10 text-violet-600 border-violet-500/20",
  "Accessories": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Others": "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

const CHEQUE_SUB = [{ id: "received", label: "Cheques Received" }, { id: "issued", label: "Cheques Issued" }];
const ADV_SUB = [{ id: "customer", label: "Customer Advances" }, { id: "supplier", label: "Supplier Advances" }];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentCollectionsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<PayTab>("receivables");
  const [billType, setBillType] = useState<BillType>("all");
  const [partyId, setPartyId] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [agingBucket, setAgingBucket] = useState("all");
  const [direction, setDirection] = useState("all");
  const [chequeSubTab, setChequeSubTab] = useState("received");
  const [advSubTab, setAdvSubTab] = useState("customer");

  // Parties list
  const { data: partiesData } = useQuery({
    queryKey: ["parties-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/parties");
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
    queryKey: ["report-payments-v2", from, to, activeTab, billType, partyId, accountId, agingBucket, direction],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, tab: activeTab });
      if (billType !== "all") params.set("bill_type", billType);
      if (partyId !== "all") params.set("party_id", partyId);
      if (accountId !== "all") params.set("account_id", accountId);
      if (agingBucket !== "all") params.set("aging_bucket", agingBucket);
      if (direction !== "all") params.set("direction", direction);
      const res = await fetch(`/api/reports/payments?${params}`);
      if (!res.ok) throw new Error("Failed to load payment report");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  const s = data?.summary ?? {};

  // Export handler
  const handleExport = useCallback(() => {
    if (!data?.rows?.length) return;
    if (activeTab === "receivables" || activeTab === "payables") {
      exportToExcel([
        { key: "number", label: "Invoice No.", width: 18 },
        { key: "date", label: "Date", format: "date", width: 14 },
        { key: "due_date", label: "Due Date", format: "date", width: 14 },
        { key: "party", label: "Party", width: 30 },
        { key: "bill_type", label: "Bill Type", width: 12 },
        { key: "total", label: "Bill Amount (₹)", format: "currency", width: 18 },
        { key: "paid", label: "Paid (₹)", format: "currency", width: 18 },
        { key: "outstanding", label: "Outstanding (₹)", format: "currency", width: 18 },
        { key: "age_days", label: "Age (Days)", format: "number", width: 12 },
        { key: "status", label: "Status", width: 12 },
      ], data.rows, `${activeTab}_${from}_${to}`);
    } else {
      exportToExcel([
        { key: "number", label: "No.", width: 16 },
        { key: "date", label: "Date", format: "date", width: 14 },
        { key: "party", label: "Party", width: 28 },
        { key: "mode", label: "Mode", width: 14 },
        { key: "account", label: "Account", width: 22 },
        { key: "amount", label: "Amount (₹)", format: "currency", width: 18 },
        { key: "reference", label: "Reference", width: 20 },
      ], data.rows, `${activeTab}_${from}_${to}`);
    }
  }, [data, activeTab, from, to]);

  const agingChart = useMemo(() => Object.entries(data?.aging ?? {}).map(([k, v], i) => ({
    name: AGING_LABELS[k] ?? k, value: Number(v), color: AGING_COLORS[i],
  })).filter(d => d.value > 0), [data?.aging]);

  const byModeChart = useMemo(() => Object.entries(data?.byMode ?? {}).map(([k, v]) => ({
    name: MODE_LABEL[k] ?? k, value: Number(v),
  })).filter(d => d.value > 0), [data?.byMode]);

  const byTypeChart = useMemo(() => Object.entries(data?.byType ?? {}).map(([k, v]) => ({
    name: k, value: Number(v),
  })).filter(d => d.value > 0), [data?.byType]);

  return (
    <ReportShell
      title="Payment & Collections"
      infoTooltip="Track all financial inflows and outflows — receivables, payables, receipts, payments, accounts, cheques, advances, and transfers."
      breadcrumbs={["Reports", "Payment & Collections"]}
      onApply={handleApply}
      onExportExcel={handleExport}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Party"
            value={partyId}
            onChange={setPartyId}
            options={partyOptions}
            placeholder="All Parties"
          />
          {(activeTab === "accounts") && (
            <FilterSelect
              label="Account"
              value={accountId}
              onChange={setAccountId}
              options={(data?.accountOptions ?? []).map((a: any) => ({ label: a.label, value: a.id }))}
              placeholder="All Accounts"
            />
          )}
          {(activeTab === "receipts" || activeTab === "payments" || activeTab === "transfers" || activeTab === "all_transactions") && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Flow:</span>
              <div className="flex gap-0.5 bg-[var(--card-bg)] border border-[var(--border)] p-1 rounded-xl">
                {["all", "received", "paid"].map(d => (
                  <button key={d} type="button"
                    onClick={() => setDirection(d)}
                    className={cn("px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all capitalize",
                      direction === d
                        ? d === "received" ? "bg-emerald-600 text-white shadow-xs"
                          : d === "paid" ? "bg-rose-600 text-white shadow-xs"
                            : "bg-[var(--primary)] text-white shadow-xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {d === "all" ? "All" : d === "received" ? "In" : "Out"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(activeTab === "receivables" || activeTab === "payables") && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Aging:</span>
                <div className="flex gap-0.5 bg-[var(--card-bg)] border border-[var(--border)] p-1 rounded-xl">
                  {[
                    { id: "all", label: "All" },
                    { id: "0-30", label: "0-30d" },
                    { id: "31-60", label: "31-60d" },
                    { id: "61-90", label: "61-90d" },
                    { id: "90+", label: "90+d" },
                  ].map(b => (
                    <button key={b.id} type="button"
                      onClick={() => setAgingBucket(b.id)}
                      className={cn("px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all",
                        agingBucket === b.id ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
                <BillTypeFilter value={billType} onChange={setBillType} />
              </div>
            </>
          )}
        </div>
      }
    >
      {/* ── Tab Bar ── */}
      <div className="flex border-b border-[var(--border)] gap-0 -mt-2 overflow-x-auto print:hidden">
        {TABS.map(t => (
          <button key={t.id} type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === t.id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]"
            )}
          >
            {t.icon}
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
        isEmpty={false}
      >
        {data && (
          <div className="space-y-6">

            {/* ── RECEIVABLES ─────────────────────────────────────────── */}
            {activeTab === "receivables" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <ReportKPICard label="Total Receivable" value={s.totalOutstanding ?? 0} color="rose" icon={<IndianRupee size={15} />} />
                  <ReportKPICard label="Overdue Receivable" value={s.overdueAmount ?? 0} color="rose" icon={<AlertCircle size={15} />} />
                  <ReportKPICard label="Received (Period)" value={s.totalReceived ?? 0} color="emerald" icon={<ArrowDownLeft size={15} />} />
                  <ReportKPICard label="Outstanding Bills" value={s.totalBills ?? 0} format="number" color="blue" />
                  <ReportKPICard label="Cash & Bank Balance" value={s.cashBalance ?? 0} color="violet" icon={<Building2 size={15} />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <OutstandingTable
                      rows={data.rows ?? []}
                      columns={["Invoice No.", "Customer", "Bill Type", "Invoice Amt", "Received", "Outstanding", "Due Date", "Age", "Status"]}
                      renderRow={(r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10 transition-colors">
                          <td className="py-2 px-4 font-mono font-bold text-[var(--primary)] text-xs">{r.number}</td>
                          <td className="py-2 px-4 max-w-[150px] truncate text-[var(--text-body)] text-xs">{r.party}</td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                              r.bill_type === "pakka" ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            )}>{r.bill_type ?? "—"}</span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-xs text-[var(--text-body)]">{fmtINR(r.total)}</td>
                          <td className="py-2 px-4 text-right font-mono text-xs text-emerald-500">{fmtINR(r.paid)}</td>
                          <td className="py-2 px-4 text-right font-mono text-xs font-bold text-rose-500">{fmtINR(r.outstanding)}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.due_date)}</td>
                          <td className="py-2 px-4 text-xs">
                            <span className={cn("font-bold", r.age_days > 90 ? "text-rose-500" : r.age_days > 60 ? "text-orange-500" : r.age_days > 30 ? "text-amber-500" : "text-emerald-500")}>
                              {r.age_days}d
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_BADGE[r.status ?? "unpaid"])}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      )}
                      footer={
                        <tr className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                          <td colSpan={3} className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">TOTAL</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.total, 0))}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-emerald-500">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.paid, 0))}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-rose-500">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.outstanding, 0))}</td>
                          <td colSpan={3} />
                        </tr>
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    {agingChart.length > 0 && (
                      <ChartCard title="Receivable Ageing (₹)">
                        <ReportDonutChart data={agingChart} height={180} innerRadius={40} outerRadius={68} valueFormat="currency" legendPosition="right" />
                        <div className="mt-3 space-y-1">
                          {Object.entries(data.aging ?? {}).map(([k, v], i) => (
                            <div key={k} className="flex justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: AGING_COLORS[i] }} />
                                <span className="text-[var(--text-muted)]">{k} days</span>
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">{fmtINR(Number(v))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs font-extrabold border-t border-[var(--border)] pt-1 mt-2">
                            <span className="text-[var(--text-muted)]">Total Outstanding</span>
                            <span className="font-mono text-rose-500">{fmtINR(s.totalOutstanding ?? 0)}</span>
                          </div>
                        </div>
                      </ChartCard>
                    )}
                  </div>
                </div>

                {/* Bottom summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Top Customers */}
                  {(data.topCustomers ?? []).length > 0 && (
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Top Customers (Outstanding)</h3>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="pb-2 text-left">Customer</th>
                            <th className="pb-2 text-right">Total Sales</th>
                            <th className="pb-2 text-right">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(data.topCustomers ?? []).map((c: any) => (
                            <tr key={c.name} className="hover:bg-[var(--table-row-hover)]">
                              <td className="py-1.5 font-semibold text-[var(--text-body)] truncate max-w-[120px]">{c.name}</td>
                              <td className="py-1.5 text-right font-mono text-[var(--text-body)]">{fmtINR(c.total)}</td>
                              <td className="py-1.5 text-right font-mono font-bold text-rose-500">{fmtINR(c.outstanding)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Status Summary */}
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-4">Status Summary</h3>
                    <div className="space-y-3">
                      {[
                        { key: "paid", label: "Paid in Full", color: "text-emerald-500", bg: "bg-emerald-500" },
                        { key: "partial", label: "Partial", color: "text-amber-500", bg: "bg-amber-500" },
                        { key: "unpaid", label: "Unpaid", color: "text-rose-500", bg: "bg-rose-500" },
                      ].map(st => {
                        const item = (data.statusSummary ?? {})[st.key] ?? { count: 0, amount: 0 };
                        return (
                          <div key={st.key} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2.5 h-2.5 rounded-full", st.bg)} />
                              <span className="text-xs text-[var(--text-body)]">{st.label}</span>
                              <span className="text-[10px] text-[var(--text-muted)] font-bold">{item.count} bills</span>
                            </div>
                            <span className={cn("font-mono font-bold text-xs", st.color)}>{fmtINR(item.amount)}</span>
                          </div>
                        );
                      })}
                      <div className="border-t border-[var(--border)] pt-2 flex justify-between text-xs font-extrabold">
                        <span className="text-[var(--text-muted)]">Total Outstanding Bills</span>
                        <span className="text-[var(--text-primary)]">{s.totalBills ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Receipts */}
                  {(data.recentReceipts ?? []).length > 0 && (
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Recent Receipts</h3>
                      <div className="space-y-2">
                        {(data.recentReceipts ?? []).map((r: any) => (
                          <div key={r.id} className="flex justify-between items-center py-1.5 border-b border-[var(--border-light)]">
                            <div>
                              <div className="text-xs font-bold text-[var(--primary)]">{r.number}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{r.party} · {fmtDate(r.date)}</div>
                            </div>
                            <span className="font-mono font-bold text-xs text-emerald-500">{fmtINR(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── PAYABLES ─────────────────────────────────────────────── */}
            {activeTab === "payables" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <ReportKPICard label="Total Payable" value={s.totalOutstanding ?? 0} color="rose" icon={<IndianRupee size={15} />} />
                  <ReportKPICard label="Overdue Payable" value={s.overdueAmount ?? 0} color="rose" icon={<AlertCircle size={15} />} />
                  <ReportKPICard label="Paid (Period)" value={s.totalPaid ?? 0} color="emerald" icon={<ArrowUpRight size={15} />} />
                  <ReportKPICard label="Outstanding Bills" value={s.totalBills ?? 0} format="number" color="blue" />
                  <ReportKPICard label="Cash & Bank Outflow" value={s.cashBalance ?? 0} color="violet" icon={<Building2 size={15} />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <OutstandingTable
                      title="OUTSTANDING PAYABLES"
                      rows={data.rows ?? []}
                      columns={["Purchase No.", "Supplier", "Type", "Bill Amt", "Paid", "Outstanding", "Due Date", "Age", "Status"]}
                      renderRow={(r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10 transition-colors">
                          <td className="py-2 px-4 font-mono font-bold text-[var(--primary)] text-xs">{r.number}</td>
                          <td className="py-2 px-4 max-w-[130px] truncate text-[var(--text-body)] text-xs">{r.party}</td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", TYPE_BADGE[r.type] ?? "bg-slate-500/10 text-slate-600 border-slate-500/20")}>
                              {r.type}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-xs text-[var(--text-body)]">{fmtINR(r.total)}</td>
                          <td className="py-2 px-4 text-right font-mono text-xs text-emerald-500">{fmtINR(r.paid)}</td>
                          <td className="py-2 px-4 text-right font-mono text-xs font-bold text-rose-500">{fmtINR(r.outstanding)}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.due_date)}</td>
                          <td className="py-2 px-4 text-xs">
                            <span className={cn("font-bold", r.age_days > 90 ? "text-rose-500" : r.age_days > 60 ? "text-orange-500" : r.age_days > 30 ? "text-amber-500" : "text-emerald-500")}>
                              {r.age_days}d
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_BADGE[r.status ?? "unpaid"])}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      )}
                      footer={
                        <tr className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                          <td colSpan={3} className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">TOTAL</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.total, 0))}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-emerald-500">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.paid, 0))}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-rose-500">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.outstanding, 0))}</td>
                          <td colSpan={3} />
                        </tr>
                      }
                    />
                  </div>
                  <div className="space-y-4">
                    {agingChart.length > 0 && (
                      <ChartCard title="Payable Ageing (₹)">
                        <ReportDonutChart data={agingChart} height={180} innerRadius={40} outerRadius={68} valueFormat="currency" legendPosition="right" />
                        <div className="mt-3 space-y-1">
                          {Object.entries(data.aging ?? {}).map(([k, v], i) => (
                            <div key={k} className="flex justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: AGING_COLORS[i] }} />
                                <span className="text-[var(--text-muted)]">{k} days</span>
                              </span>
                              <span className="font-mono font-bold text-[var(--text-primary)]">{fmtINR(Number(v))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs font-extrabold border-t border-[var(--border)] pt-1 mt-2">
                            <span className="text-[var(--text-muted)]">Total Outstanding</span>
                            <span className="font-mono text-rose-500">{fmtINR(s.totalOutstanding ?? 0)}</span>
                          </div>
                        </div>
                      </ChartCard>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {(data.topSuppliers ?? []).length > 0 && (
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Top Suppliers (Outstanding)</h3>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--text-muted)] font-bold uppercase tracking-wider">
                            <th className="pb-2 text-left">Supplier</th>
                            <th className="pb-2 text-right">Total Purch.</th>
                            <th className="pb-2 text-right">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(data.topSuppliers ?? []).map((c: any) => (
                            <tr key={c.name} className="hover:bg-[var(--table-row-hover)]">
                              <td className="py-1.5 font-semibold text-[var(--text-body)] truncate max-w-[120px]">{c.name}</td>
                              <td className="py-1.5 text-right font-mono text-[var(--text-body)]">{fmtINR(c.total)}</td>
                              <td className="py-1.5 text-right font-mono font-bold text-rose-500">{fmtINR(c.outstanding)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-4">Payment Status</h3>
                    <div className="space-y-3">
                      {[
                        { key: "paid", label: "Paid", color: "text-emerald-500", bg: "bg-emerald-500" },
                        { key: "partial", label: "Partial", color: "text-amber-500", bg: "bg-amber-500" },
                        { key: "unpaid", label: "Unpaid", color: "text-rose-500", bg: "bg-rose-500" },
                      ].map(st => {
                        const item = (data.statusSummary ?? {})[st.key] ?? { count: 0, amount: 0 };
                        return (
                          <div key={st.key} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2.5 h-2.5 rounded-full", st.bg)} />
                              <span className="text-xs text-[var(--text-body)]">{st.label}</span>
                              <span className="text-[10px] text-[var(--text-muted)] font-bold">{item.count} bills</span>
                            </div>
                            <span className={cn("font-mono font-bold text-xs", st.color)}>{fmtINR(item.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {(data.recentPayments ?? []).length > 0 && (
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Recent Payments Made</h3>
                      <div className="space-y-2">
                        {(data.recentPayments ?? []).map((r: any) => (
                          <div key={r.id} className="flex justify-between items-center py-1.5 border-b border-[var(--border-light)]">
                            <div>
                              <div className="text-xs font-bold text-[var(--primary)]">{r.number}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{r.party} · {fmtDate(r.date)}</div>
                            </div>
                            <span className="font-mono font-bold text-xs text-rose-500">{fmtINR(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── RECEIPTS ─────────────────────────────────────────────── */}
            {activeTab === "receipts" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <ReportKPICard label="Total Received" value={s.totalReceived ?? 0} color="emerald" icon={<ArrowDownLeft size={15} />} />
                  <ReportKPICard label="Customer Receipts" value={s.invoiceReceived ?? 0} color="blue" />
                  <ReportKPICard label="Advances Received" value={s.advanceReceived ?? 0} color="violet" />
                  <ReportKPICard label="Other Receipts" value={s.otherReceived ?? 0} color="amber" />
                  <ReportKPICard label="Bank & Cash Balance" value={s.cashBalance ?? 0} color="indigo" icon={<Building2 size={15} />} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <TransactionTable
                      title="RECEIPT REGISTER (All Receipts)"
                      rows={data.rows ?? []}
                      columns={["Date", "Receipt No.", "Party", "Type", "Mode", "Account", "Reference", "Amount"]}
                      renderRow={(r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10 transition-colors">
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                          <td className="py-2 px-4 font-mono font-bold text-[var(--primary)] text-xs">{r.number}</td>
                          <td className="py-2 px-4 max-w-[130px] truncate text-[var(--text-body)] text-xs">{r.party}</td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border",
                              r.type === "Advance" ? "bg-violet-500/10 text-violet-600 border-violet-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            )}>{r.type}</span>
                          </td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)] capitalize">{MODE_LABEL[r.mode] ?? r.mode}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-body)] truncate max-w-[100px]">{r.account}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)] font-mono truncate max-w-[120px]">{r.reference}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-xs text-emerald-500">{fmtINR(r.amount)}</td>
                        </tr>
                      )}
                    />
                  </div>
                  <div className="space-y-4">
                    {byModeChart.length > 0 && (
                      <ChartCard title="Receipts by Mode (₹)">
                        <ReportDonutChart data={byModeChart} height={160} innerRadius={35} outerRadius={60} valueFormat="currency" legendPosition="right" />
                      </ChartCard>
                    )}
                    {byTypeChart.length > 0 && (
                      <ChartCard title="Receipts by Type (₹)">
                        <ReportBarChart data={byTypeChart} xKey="name" bars={[{ key: "value", label: "Amount", color: CHART_COLORS[1] }]} height={140} />
                      </ChartCard>
                    )}
                    {(data.dailyTrend ?? []).length > 1 && (
                      <ChartCard title="Daily Receipt Trend (₹)">
                        <ReportAreaChart data={data.dailyTrend} xKey="date" lines={[{ key: "amount", label: "Receipts", color: CHART_COLORS[1] }]} height={140} />
                      </ChartCard>
                    )}
                  </div>
                </div>
                {(data.topCustomers ?? []).length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Top Customers (By Receipts)</h3>
                      <table className="w-full text-xs">
                        <thead><tr className="text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="pb-2 text-left">Customer</th>
                          <th className="pb-2 text-right">Received (₹)</th>
                          <th className="pb-2 text-right">% of Total</th>
                        </tr></thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(data.topCustomers ?? []).map((c: any) => (
                            <tr key={c.name} className="hover:bg-[var(--table-row-hover)]">
                              <td className="py-1.5 font-semibold text-[var(--text-body)] truncate max-w-[150px]">{c.name}</td>
                              <td className="py-1.5 text-right font-mono font-bold text-emerald-500">{fmtINR(c.amount)}</td>
                              <td className="py-1.5 text-right text-[var(--text-muted)]">{c.pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── PAYMENTS ──────────────────────────────────────────────── */}
            {activeTab === "payments" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <ReportKPICard label="Total Paid" value={s.totalPaid ?? 0} color="rose" icon={<ArrowUpRight size={15} />} />
                  <ReportKPICard label="Supplier Payments" value={s.supplierPayments ?? 0} color="blue" />
                  <ReportKPICard label="Worker / Job Work" value={s.workerPayments ?? 0} color="violet" />
                  <ReportKPICard label="Other Payments" value={s.otherPayments ?? 0} color="amber" />
                  <ReportKPICard label="Bank & Cash Outflow" value={s.cashBalance ?? 0} color="indigo" icon={<Building2 size={15} />} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <TransactionTable
                      title="PAYMENT REGISTER (All Payments)"
                      rows={data.rows ?? []}
                      columns={["Date", "Payment No.", "Payee", "Purpose/Type", "Mode", "Account", "Reference", "Amount"]}
                      renderRow={(r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10 transition-colors">
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                          <td className="py-2 px-4 font-mono font-bold text-[var(--primary)] text-xs">{r.number}</td>
                          <td className="py-2 px-4 max-w-[130px] truncate text-[var(--text-body)] text-xs">{r.payee}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{r.purpose_type}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)] capitalize">{MODE_LABEL[r.mode] ?? r.mode}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-body)] truncate max-w-[100px]">{r.account}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)] font-mono truncate max-w-[120px]">{r.reference}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-xs text-rose-500">{fmtINR(r.amount)}</td>
                        </tr>
                      )}
                    />
                  </div>
                  <div className="space-y-4">
                    {byModeChart.length > 0 && (
                      <ChartCard title="Payments by Mode (₹)">
                        <ReportDonutChart data={byModeChart} height={160} innerRadius={35} outerRadius={60} valueFormat="currency" legendPosition="right" />
                      </ChartCard>
                    )}
                    {byTypeChart.length > 0 && (
                      <ChartCard title="Payments by Type (₹)">
                        <ReportBarChart data={byTypeChart} xKey="name" bars={[{ key: "value", label: "Amount", color: CHART_COLORS[3] }]} height={140} />
                      </ChartCard>
                    )}
                    {(data.dailyTrend ?? []).length > 1 && (
                      <ChartCard title="Daily Payment Trend (₹)">
                        <ReportAreaChart data={data.dailyTrend} xKey="date" lines={[{ key: "amount", label: "Payments", color: CHART_COLORS[3] }]} height={140} />
                      </ChartCard>
                    )}
                  </div>
                </div>
                {(data.topSuppliers ?? []).length > 0 && (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Top Suppliers (By Payments)</h3>
                    <table className="w-full text-xs">
                      <thead><tr className="text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        <th className="pb-2 text-left">Supplier</th>
                        <th className="pb-2 text-right">Total Paid (₹)</th>
                        <th className="pb-2 text-right">% of Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {(data.topSuppliers ?? []).map((c: any) => (
                          <tr key={c.name} className="hover:bg-[var(--table-row-hover)]">
                            <td className="py-1.5 font-semibold text-[var(--text-body)] truncate max-w-[200px]">{c.name}</td>
                            <td className="py-1.5 text-right font-mono font-bold text-rose-500">{fmtINR(c.amount)}</td>
                            <td className="py-1.5 text-right text-[var(--text-muted)]">{c.pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── ACCOUNTS ──────────────────────────────────────────────── */}
            {activeTab === "accounts" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <ReportKPICard label="Total Cash in Hand" value={(data.accounts ?? []).filter((a: any) => a.type === "cash").reduce((s: number, a: any) => s + a.current_balance, 0)} color="emerald" icon={<Banknote size={15} />} />
                  <ReportKPICard label="Total Bank Balance" value={(data.accounts ?? []).filter((a: any) => a.type === "bank").reduce((s: number, a: any) => s + a.current_balance, 0)} color="blue" icon={<Building2 size={15} />} />
                  <ReportKPICard label="Total UPI Balance" value={(data.accounts ?? []).filter((a: any) => a.type === "upi").reduce((s: number, a: any) => s + a.current_balance, 0)} color="violet" icon={<QrCode size={15} />} />
                  <ReportKPICard label="Total Accounts Balance" value={s.totalBalance ?? 0} color="indigo" icon={<Wallet size={15} />} />
                  <ReportKPICard label="Net Transfers" value={s.netTransfers ?? 0} color="amber" icon={<ArrowLeftRight size={15} />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">ACCOUNT SUMMARY</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-4">Account</th>
                              <th className="py-2.5 px-4 text-right">Opening Bal.</th>
                              <th className="py-2.5 px-4 text-right">Received</th>
                              <th className="py-2.5 px-4 text-right">Paid</th>
                              <th className="py-2.5 px-4 text-right">Closing Bal.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                            {(data.accounts ?? []).map((a: any) => (
                              <tr key={a.id} className="hover:bg-[var(--table-row-hover)] h-10">
                                <td className="py-2 px-4">
                                  <div className="font-semibold text-[var(--text-primary)]">{a.name}</div>
                                  <div className="text-[10px] text-[var(--text-muted)] uppercase">{a.type}</div>
                                </td>
                                <td className="py-2 px-4 text-right font-mono">{fmtINR(a.opening_balance)}</td>
                                <td className="py-2 px-4 text-right font-mono text-emerald-500">{fmtINR(a.received)}</td>
                                <td className="py-2 px-4 text-right font-mono text-rose-500">{fmtINR(a.paid)}</td>
                                <td className="py-2 px-4 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(a.closing_balance)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                            <tr>
                              <td className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">TOTAL</td>
                              <td className="py-3 px-4 text-right font-mono font-bold">{fmtINR((data.accounts ?? []).reduce((s: number, a: any) => s + a.opening_balance, 0))}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">{fmtINR((data.accounts ?? []).reduce((s: number, a: any) => s + a.received, 0))}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-rose-500">{fmtINR((data.accounts ?? []).reduce((s: number, a: any) => s + a.paid, 0))}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold">{fmtINR(s.totalBalance ?? 0)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {(data.txRows ?? []).length > 0 && (
                      <div className="mt-4 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">ACCOUNT TRANSACTIONS</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                                <th className="py-2.5 px-4">Date</th>
                                <th className="py-2.5 px-4">Ref. No.</th>
                                <th className="py-2.5 px-4">Type</th>
                                <th className="py-2.5 px-4">Party / Account</th>
                                <th className="py-2.5 px-4">Mode</th>
                                <th className="py-2.5 px-4 text-right">Debit (₹)</th>
                                <th className="py-2.5 px-4 text-right">Credit (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                              {(data.txRows ?? []).slice(0, 25).map((r: any, idx: number) => (
                                <tr key={idx} className="hover:bg-[var(--table-row-hover)] h-10">
                                  <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                                  <td className="py-2 px-4 font-mono font-bold text-[var(--primary)]">{r.number}</td>
                                  <td className="py-2 px-4">
                                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                      r.type === "Receipt" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                    )}>{r.type}</span>
                                  </td>
                                  <td className="py-2 px-4 truncate max-w-[120px]">{r.party}</td>
                                  <td className="py-2 px-4 text-[var(--text-muted)] capitalize">{MODE_LABEL[r.mode] ?? r.mode}</td>
                                  <td className="py-2 px-4 text-right font-mono text-rose-500">{r.debit > 0 ? fmtINR(r.debit) : "—"}</td>
                                  <td className="py-2 px-4 text-right font-mono text-emerald-500">{r.credit > 0 ? fmtINR(r.credit) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {(data.accounts ?? []).length > 0 && (
                      <ChartCard title="Account Balance Overview">
                        <ReportDonutChart
                          data={(data.accounts ?? []).filter((a: any) => a.current_balance > 0).map((a: any) => ({ name: a.name, value: a.current_balance }))}
                          height={180} innerRadius={45} outerRadius={68} valueFormat="currency"
                        />
                      </ChartCard>
                    )}
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Account Category</h3>
                      <div className="space-y-2">
                        {[
                          { label: "Cash Accounts", type: "cash", color: "text-emerald-500" },
                          { label: "Bank Accounts", type: "bank", color: "text-blue-500" },
                          { label: "UPI Accounts", type: "upi", color: "text-violet-500" },
                        ].map(cat => {
                          const count = (data.accounts ?? []).filter((a: any) => a.type === cat.type).length;
                          return (
                            <div key={cat.type} className="flex justify-between text-xs">
                              <span className="text-[var(--text-muted)]">{cat.label}</span>
                              <span className={cn("font-bold", cat.color)}>{count}</span>
                            </div>
                          );
                        })}
                        <div className="border-t border-[var(--border)] pt-2 flex justify-between text-xs font-extrabold">
                          <span className="text-[var(--text-muted)]">Total Accounts</span>
                          <span className="text-[var(--text-primary)]">{(data.accounts ?? []).length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── CHEQUES ───────────────────────────────────────────────── */}
            {activeTab === "cheques" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <ReportKPICard label="Cheques Received" value={s.totalReceived ?? 0} color="emerald" icon={<ArrowDownLeft size={14} />} />
                  <ReportKPICard label="Cheques Issued" value={s.totalIssued ?? 0} color="rose" icon={<ArrowUpRight size={14} />} />
                  <ReportKPICard label="PDC (Received)" value={s.pdcReceived ?? 0} color="blue" />
                  <ReportKPICard label="PDC (Issued)" value={s.pdcIssued ?? 0} color="amber" />
                  <ReportKPICard label="Cheques Bounced" value={s.bounced ?? 0} color="rose" />
                  <ReportKPICard label="Cheques Cleared" value={s.cleared ?? 0} color="emerald" />
                </div>

                {/* Sub tabs */}
                <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] p-1 rounded-xl w-fit">
                  {CHEQUE_SUB.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => setChequeSubTab(t.id)}
                      className={cn("px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all",
                        chequeSubTab === t.id ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      )}
                    >{t.label}</button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <TransactionTable
                      title={chequeSubTab === "received" ? "CHEQUES RECEIVED" : "CHEQUES ISSUED"}
                      rows={chequeSubTab === "received" ? (data.received ?? []) : (data.issued ?? [])}
                      columns={["Date", "Cheque No.", "Party", "Bank", "Amount", "Cheque Date", "Status", "Days Left"]}
                      renderRow={(r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10 transition-colors">
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                          <td className="py-2 px-4 font-mono font-bold text-[var(--primary)] text-xs">{r.number}</td>
                          <td className="py-2 px-4 max-w-[120px] truncate text-[var(--text-body)] text-xs">{r.party}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{r.bank}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-xs text-[var(--text-primary)]">{fmtINR(r.amount)}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.cheque_date)}</td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize", STATUS_BADGE[r.status] ?? "bg-slate-500/10 text-slate-500 border-slate-500/20")}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-xs">
                            <span className={cn("font-bold", r.days_left < 0 ? "text-rose-500" : r.days_left < 7 ? "text-amber-500" : "text-emerald-500")}>
                              {r.days_left < 0 ? `${Math.abs(r.days_left)}d ago` : `${r.days_left}d`}
                            </span>
                          </td>
                        </tr>
                      )}
                    />
                  </div>
                  <div className="space-y-4">
                    {Object.keys(chequeSubTab === "received" ? (data.byStatusReceived ?? {}) : (data.byStatusIssued ?? {})).length > 0 && (
                      <ChartCard title="Cheques by Status">
                        <ReportDonutChart
                          data={Object.entries(chequeSubTab === "received" ? (data.byStatusReceived ?? {}) : (data.byStatusIssued ?? {})).map(([k, v]) => ({
                            name: k, value: Number(v),
                          }))}
                          height={160} innerRadius={35} outerRadius={58} valueFormat="currency"
                        />
                      </ChartCard>
                    )}
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Cheque Summary</h3>
                      <div className="space-y-2">
                        {[
                          { label: "Total Received", value: s.totalReceived ?? 0, color: "text-emerald-500" },
                          { label: "Total Issued", value: s.totalIssued ?? 0, color: "text-rose-500" },
                          { label: "Total PDC (Received)", value: s.pdcReceived ?? 0, color: "text-blue-500" },
                          { label: "Total PDC (Issued)", value: s.pdcIssued ?? 0, color: "text-amber-500" },
                          { label: "Total Cleared", value: s.cleared ?? 0, color: "text-emerald-500" },
                          { label: "Total Bounced", value: s.bounced ?? 0, color: "text-rose-500" },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between text-xs">
                            <span className="text-[var(--text-muted)]">{item.label}</span>
                            <span className={cn("font-mono font-bold", item.color)}>{fmtINR(item.value)}</span>
                          </div>
                        ))}
                        <div className="border-t border-[var(--border)] pt-2 flex justify-between text-xs font-extrabold">
                          <span className="text-[var(--text-muted)]">Net Cheque Position</span>
                          <span className={cn("font-mono", (s.totalReceived ?? 0) - (s.totalIssued ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                            {fmtINR((s.totalReceived ?? 0) - (s.totalIssued ?? 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── ADVANCES ──────────────────────────────────────────────── */}
            {activeTab === "advances" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <ReportKPICard label="Customer Advances" value={s.customerAdvances ?? 0} color="blue" icon={<ArrowDownLeft size={15} />} />
                  <ReportKPICard label="Supplier Advances" value={s.supplierAdvances ?? 0} color="rose" icon={<ArrowUpRight size={15} />} />
                  <ReportKPICard label="Total Advances" value={s.totalAdvances ?? 0} color="violet" icon={<Package size={15} />} />
                  <ReportKPICard label="Adjusted (Period)" value={s.adjustedThisPeriod ?? 0} color="emerald" />
                  <ReportKPICard label="Outstanding Advances" value={s.outstandingAdvances ?? 0} color="amber" />
                </div>

                {/* Sub tabs */}
                <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] p-1 rounded-xl w-fit">
                  {ADV_SUB.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => setAdvSubTab(t.id)}
                      className={cn("px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all",
                        advSubTab === t.id ? "bg-[var(--primary)] text-white shadow-xs" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      )}
                    >{t.label}</button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <TransactionTable
                      title={advSubTab === "customer" ? "CUSTOMER ADVANCES (UNADJUSTED)" : "SUPPLIER ADVANCES (UNADJUSTED)"}
                      rows={advSubTab === "customer" ? (data.customerAdvances ?? []) : (data.supplierAdvances ?? [])}
                      columns={["Date", "Advance No.", "Party", "Mode", "Account", "Amount", "Adjusted", "Balance", "Status"]}
                      renderRow={(r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10 transition-colors">
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                          <td className="py-2 px-4 font-mono font-bold text-[var(--primary)] text-xs">{r.advance_number}</td>
                          <td className="py-2 px-4 max-w-[120px] truncate text-[var(--text-body)] text-xs">{r.party}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)] capitalize">{MODE_LABEL[r.mode] ?? r.mode}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-body)] truncate max-w-[90px]">{r.account}</td>
                          <td className="py-2 px-4 text-right font-mono text-xs text-[var(--text-primary)]">{fmtINR(r.amount)}</td>
                          <td className="py-2 px-4 text-right font-mono text-xs text-emerald-500">{fmtINR(r.adjusted)}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-xs text-amber-500">{fmtINR(r.balance)}</td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border", STATUS_BADGE[r.status] ?? "bg-slate-500/10 text-slate-500 border-slate-500/20")}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      )}
                    />
                  </div>
                  <div className="space-y-4">
                    <ChartCard title={advSubTab === "customer" ? "Customer Advances Summary" : "Supplier Advances Summary"}>
                      <ReportDonutChart
                        data={[
                          { name: "Adjusted", value: advSubTab === "customer" ? (s.customerAdvances ?? 0) - (s.outstandingAdvances ?? 0) / 2 : (s.supplierAdvances ?? 0) - (s.outstandingAdvances ?? 0) / 2 },
                          { name: "Partial", value: (s.outstandingAdvances ?? 0) * 0.4 },
                          { name: "Unadjusted", value: (s.outstandingAdvances ?? 0) * 0.6 },
                        ].filter(d => d.value > 0)}
                        height={160} innerRadius={35} outerRadius={58} valueFormat="currency"
                      />
                    </ChartCard>
                  </div>
                </div>
              </>
            )}

            {/* ── TRANSFERS ─────────────────────────────────────────────── */}
            {activeTab === "transfers" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ReportKPICard label="Total Transfers" value={s.totalTransfers ?? 0} color="blue" icon={<ArrowLeftRight size={15} />} />
                  <ReportKPICard label="Total Transactions" value={s.totalRows ?? 0} format="number" color="violet" />
                  <ReportKPICard label="Net Amount" value={s.totalTransfers ?? 0} color="indigo" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <TransactionTable
                      title="TRANSFERS REGISTER"
                      rows={data.rows ?? []}
                      columns={["Date", "Reference No.", "Direction", "From Account", "To Account", "Party", "Mode", "Amount", "Status"]}
                      renderRow={(r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10 transition-colors">
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                          <td className="py-2 px-4 font-mono font-bold text-[var(--primary)] text-xs">{r.number}</td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border",
                              r.direction === "received" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            )}>{r.direction === "received" ? "Received" : "Paid"}</span>
                          </td>
                          <td className="py-2 px-4 text-xs text-[var(--text-body)]">{r.from_account}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-body)]">{r.to_account}</td>
                          <td className="py-2 px-4 max-w-[100px] truncate text-xs text-[var(--text-muted)]">{r.party}</td>
                          <td className="py-2 px-4 text-xs text-[var(--text-muted)] capitalize">{MODE_LABEL[r.mode] ?? r.mode}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-xs text-[var(--text-primary)]">{fmtINR(r.amount)}</td>
                          <td className="py-2 px-4">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border", STATUS_BADGE[r.status] ?? "bg-slate-500/10 text-slate-500 border-slate-500/20")}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      )}
                    />
                  </div>
                  <div className="space-y-4">
                    {byModeChart.length > 0 && (
                      <ChartCard title="Transfers by Mode (₹)">
                        <ReportDonutChart data={byModeChart} height={160} innerRadius={35} outerRadius={58} valueFormat="currency" legendPosition="right" />
                      </ChartCard>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── ALL TRANSACTIONS ──────────────────────────────────────── */}
            {activeTab === "all_transactions" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <ReportKPICard label="Total Transactions" value={s.totalTransactions ?? 0} format="number" color="indigo" icon={<Layers size={14} />} />
                  <ReportKPICard label="Total Receipts" value={s.totalReceipts ?? 0} color="emerald" icon={<ArrowDownLeft size={14} />} />
                  <ReportKPICard label="Total Payments" value={s.totalPayments ?? 0} color="rose" icon={<ArrowUpRight size={14} />} />
                  <ReportKPICard label="Total Advances" value={s.totalAdvances ?? 0} color="violet" />
                  <ReportKPICard label="Total Transfers" value={s.totalCheques ?? 0} color="amber" />
                  <ReportKPICard label="Closing Balance" value={s.closingBalance ?? 0} color="blue" icon={<Building2 size={14} />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex justify-between items-center">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">ALL TRANSACTIONS (MASTER REGISTER)</h3>
                        <span className="text-[10px] text-[var(--text-muted)]">Showing {Math.min(50, (data.rows ?? []).length)} of {(data.rows ?? []).length}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                              {["Date", "Voucher No.", "Type", "Party / Account", "Mode", "From Acct", "To Acct", "Debit (₹)", "Credit (₹)", "Amount (₹)", "Status"].map(h => (
                                <th key={h} className={cn("py-2.5 px-3", ["Debit (₹)", "Credit (₹)", "Amount (₹)"].includes(h) ? "text-right" : "")}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                            {(data.rows ?? []).slice(0, 50).map((r: any, idx: number) => (
                              <tr key={idx} className="hover:bg-[var(--table-row-hover)] h-10">
                                <td className="py-2 px-3 text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                                <td className="py-2 px-3 font-mono font-bold text-[var(--primary)]">{r.voucher_no}</td>
                                <td className="py-2 px-3">
                                  <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[8px] font-bold border whitespace-nowrap",
                                    r.credit > 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  )}>{r.type}</span>
                                </td>
                                <td className="py-2 px-3 max-w-[110px] truncate">{r.party}</td>
                                <td className="py-2 px-3 text-[var(--text-muted)] capitalize">{MODE_LABEL[r.mode] ?? r.mode}</td>
                                <td className="py-2 px-3 text-[var(--text-muted)] truncate max-w-[90px]">{r.from_account}</td>
                                <td className="py-2 px-3 text-[var(--text-muted)] truncate max-w-[90px]">{r.to_account}</td>
                                <td className="py-2 px-3 text-right font-mono text-rose-500">{r.debit > 0 ? fmtINR(r.debit) : "—"}</td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-500">{r.credit > 0 ? fmtINR(r.credit) : "—"}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(r.amount)}</td>
                                <td className="py-2 px-3">
                                  <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[8px] font-bold border capitalize", STATUS_BADGE[r.status] ?? "")}>{r.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {Object.keys(data.byType ?? {}).length > 0 && (
                      <ChartCard title="Transactions by Type">
                        <ReportDonutChart
                          data={Object.entries(data.byType ?? {}).map(([k, v]: [string, any]) => ({ name: k, value: v.count }))}
                          height={160} innerRadius={35} outerRadius={58}
                        />
                      </ChartCard>
                    )}
                    {byModeChart.length > 0 && (
                      <ChartCard title="Transactions by Mode (₹)">
                        <ReportDonutChart data={byModeChart} height={160} innerRadius={35} outerRadius={58} valueFormat="currency" legendPosition="right" />
                      </ChartCard>
                    )}
                    {(data.topParties ?? []).length > 0 && (
                      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Top Parties (By Net Impact)</h3>
                        <div className="space-y-2">
                          {(data.topParties ?? []).map((p: any) => (
                            <div key={p.name} className="flex justify-between items-center text-xs">
                              <span className="text-[var(--text-body)] truncate max-w-[140px]">{p.name}</span>
                              <span className={cn("font-mono font-bold", p.net >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {p.net >= 0 ? "+" : ""}{fmtINR(p.net)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">Net Cash Flow Summary</h3>
                      <div className="space-y-2">
                        {[
                          { label: "Total Receipts (Inflows)", value: s.totalReceipts ?? 0, color: "text-emerald-500" },
                          { label: "Total Payments (Outflows)", value: s.totalPayments ?? 0, color: "text-rose-500" },
                          { label: "Net Cash Flow", value: s.netCashFlow ?? 0, color: (s.netCashFlow ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500" },
                          { label: "Closing Balance (All Accounts)", value: s.closingBalance ?? 0, color: "text-[var(--primary)]" },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between text-xs">
                            <span className="text-[var(--text-muted)]">{item.label}</span>
                            <span className={cn("font-mono font-bold", item.color)}>{fmtINR(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        )}
      </PageState>
    </ReportShell>
  );
}

// ─── Shared Sub-Components ────────────────────────────────────────────────────

function OutstandingTable({
  rows, columns, renderRow, footer, title = "OUTSTANDING RECEIVABLES",
}: {
  rows: any[];
  columns: string[];
  renderRow: (r: any) => React.ReactNode;
  footer?: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex justify-between items-center">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">{title}</h3>
        <span className="text-[10px] text-[var(--text-muted)]">Showing {Math.min(rows.length, 30)} of {rows.length} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
              {columns.map(c => (
                <th key={c} className={cn("py-2.5 px-4", ["Invoice Amt", "Bill Amt", "Received", "Paid", "Outstanding"].includes(c) ? "text-right" : "")}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
            {rows.slice(0, 30).map(renderRow)}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="py-8 text-center text-[var(--text-muted)]">No records found.</td></tr>
            )}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
}

function TransactionTable({
  rows, columns, renderRow, title,
}: {
  rows: any[];
  columns: string[];
  renderRow: (r: any) => React.ReactNode;
  title: string;
}) {
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)] flex justify-between items-center">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">{title}</h3>
        <span className="text-[10px] text-[var(--text-muted)]">Showing {Math.min(rows.length, 30)} of {rows.length} entries</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
              {columns.map(c => (
                <th key={c} className={cn("py-2.5 px-4", c === "Amount" ? "text-right" : "")}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
            {rows.slice(0, 30).map(renderRow)}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="py-8 text-center text-[var(--text-muted)]">No records found.</td></tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
            <tr>
              <td colSpan={columns.length - 1} className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">TOTAL</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-xs text-[var(--text-primary)]">
                {fmtINR(rows.reduce((s: number, r: any) => s + (r.amount ?? 0), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
