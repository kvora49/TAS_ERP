"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Banknote, Building2, QrCode } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportBarChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, exportToExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";

import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";

type PayTab = "receivables" | "payables" | "upi" | "bank" | "cash" | "combined";

const TABS: { id: PayTab; label: string; icon: React.ReactNode }[] = [
  { id: "receivables", label: "Receivables", icon: <ArrowDownLeft size={13} /> },
  { id: "payables", label: "Payables", icon: <ArrowUpRight size={13} /> },
  { id: "upi", label: "UPI", icon: <QrCode size={13} /> },
  { id: "bank", label: "Bank", icon: <Building2 size={13} /> },
  { id: "cash", label: "Cash", icon: <Banknote size={13} /> },
  { id: "combined", label: "Combined", icon: <Wallet size={13} /> },
];

const MODE_LABEL: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", upi: "UPI",
  cheque: "Cheque", neft: "NEFT", rtgs: "RTGS",
};

const AGING_COLORS: string[] = [
  "#10B981", "#F59E0B", "#F97316", "#EF4444",
];

const AGING_OPTIONS = [
  { id: "all", label: "All Ages" },
  { id: "0-30", label: "0-30 Days", badgeClass: "bg-emerald-600 text-white shadow-xs font-semibold" },
  { id: "31-60", label: "31-60 Days", badgeClass: "bg-amber-600 text-white shadow-xs font-semibold" },
  { id: "61-90", label: "61-90 Days", badgeClass: "bg-orange-600 text-white shadow-xs font-semibold" },
  { id: "90+", label: "90+ Days", badgeClass: "bg-rose-600 text-white shadow-xs font-semibold" },
];

export default function PaymentReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<PayTab>("receivables");
  const [billType, setBillType] = useState<BillType>("all");
  const [partyId, setPartyId] = useState("all");
  const [agingBucket, setAgingBucket] = useState("all");

  // Fetch Parties list
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
    queryKey: ["report-payments", from, to, activeTab, billType, partyId, agingBucket],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to, tab: activeTab });
      if (billType !== "all") params.set("bill_type", billType);
      if (partyId !== "all") params.set("party_id", partyId);
      if (agingBucket !== "all") params.set("aging_bucket", agingBucket);
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

  const handleExportExcel = useCallback(() => {
    if (!data) return;
    if (activeTab === "receivables" || activeTab === "payables") {
      exportToExcel(
        [
          { key: "number", label: "Bill No.", width: 18 },
          { key: "date", label: "Date", format: "date", width: 14 },
          { key: "party", label: "Party", width: 30 },
          { key: "total", label: "Total (₹)", format: "currency", width: 18 },
          { key: "paid", label: "Paid (₹)", format: "currency", width: 18 },
          { key: "outstanding", label: "Outstanding (₹)", format: "currency", width: 18 },
          { key: "status", label: "Status", width: 12 },
        ],
        data.rows ?? [],
        `${activeTab}_${from}_${to}`
      );
    } else {
      exportToExcel(
        [
          { key: "number", label: "Payment No.", width: 18 },
          { key: "date", label: "Date", format: "date", width: 14 },
          { key: "direction", label: "Direction", width: 12 },
          { key: "mode", label: "Mode", width: 14 },
          { key: "party", label: "Party", width: 30 },
          { key: "amount", label: "Amount (₹)", format: "currency", width: 18 },
          { key: "reference", label: "Reference", width: 18 },
        ],
        data.rows ?? [],
        `Payments_${activeTab}_${from}_${to}`
      );
    }
  }, [data, activeTab, from, to]);

  const s = data?.summary ?? {};
  const aging = data?.aging ?? {};
  const agingChart = Object.entries(aging).map(([k, v], i) => ({
    name: k + " days",
    value: Number(v),
    color: AGING_COLORS[i],
  })).filter(d => d.value > 0);

  const byModeChart = Object.entries(data?.byMode ?? {}).map(([k, v]) => ({
    name: MODE_LABEL[k] ?? k,
    value: Number(v),
  }));

  const isReceivablesOrPayables = activeTab === "receivables" || activeTab === "payables";

  return (
    <ReportShell
      title="Payment Reports"
      infoTooltip="Track receivables, payables, and payment mode analysis (UPI, Bank, Cash) in one place."
      breadcrumbs={["Reports", "Payment Reports"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Party"
            value={partyId}
            onChange={setPartyId}
            options={partyOptions}
            placeholder="All Parties"
          />
          {isReceivablesOrPayables && (
            <FilterPills
              label="Aging Bracket"
              value={agingBucket}
              onChange={setAgingBucket}
              options={AGING_OPTIONS}
            />
          )}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={billType} onChange={setBillType} />
          </div>
        </div>
      }
    >

      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] gap-0.5 -mt-2 overflow-x-auto print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
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
        skeletonCount={3}
        isEmpty={!isLoading && (data?.rows ?? []).length === 0}
        emptyTitle="No records found"
        emptyDescription={`No ${activeTab} records found for the selected period.`}
      >
        {data && (
          <div className="space-y-6">
            {/* KPI cards */}
            {isReceivablesOrPayables ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ReportKPICard
                  label={activeTab === "receivables" ? "Total Receivable" : "Total Payable"}
                  value={s.totalOutstanding ?? 0}
                  color={activeTab === "receivables" ? "emerald" : "rose"}
                  icon={activeTab === "receivables" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                />
                <ReportKPICard label="Total Bills" value={s.totalBills ?? 0} format="number" color="blue" />
                {activeTab === "receivables" && (
                  <ReportKPICard label="Total Received" value={s.totalPaid ?? 0} color="indigo" icon={<Wallet size={16} />} />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ReportKPICard label="Total Received" value={s.totalIn ?? 0} color="emerald" icon={<ArrowDownLeft size={16} />} />
                <ReportKPICard label="Total Paid Out" value={s.totalOut ?? 0} color="rose" icon={<ArrowUpRight size={16} />} />
                <ReportKPICard
                  label="Net Flow"
                  value={Math.abs(s.net ?? 0)}
                  color={(s.net ?? 0) >= 0 ? "emerald" : "rose"}
                  subLabel={(s.net ?? 0) >= 0 ? "Net Inflow" : "Net Outflow"}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main table */}
              <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                    {isReceivablesOrPayables ? "Outstanding Bills" : "Transactions"}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                        {isReceivablesOrPayables
                          ? ["Bill No.", "Date", "Party", "Total", "Paid", "Outstanding", "Status"].map(h => (
                              <th key={h} className={`py-2.5 px-4 ${["Total","Paid","Outstanding"].includes(h) ? "text-right" : ""}`}>{h}</th>
                            ))
                          : ["Payment No.", "Date", "Direction", "Mode", "Party", "Amount"].map(h => (
                              <th key={h} className={`py-2.5 px-4 ${h === "Amount" ? "text-right" : ""}`}>{h}</th>
                            ))
                        }
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                      {isReceivablesOrPayables
                        ? (data.rows ?? []).slice(0, 20).map((r: any) => (
                            <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)]">{r.number}</td>
                              <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                              <td className="py-2 px-4 max-w-[140px] truncate">{r.party}</td>
                              <td className="py-2 px-4 text-right font-mono">{fmtINR(r.total)}</td>
                              <td className="py-2 px-4 text-right font-mono text-emerald-500">{fmtINR(r.paid)}</td>
                              <td className="py-2 px-4 text-right font-mono font-bold text-rose-500">{fmtINR(r.outstanding)}</td>
                              <td className="py-2 px-4">
                                <span className={cn(
                                  "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                                  r.status === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                  r.status === "partial" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                  "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                )}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        : (data.rows ?? []).slice(0, 20).map((r: any) => (
                            <tr key={r.id} className="hover:bg-[var(--table-row-hover)] h-10">
                              <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)]">{r.number}</td>
                              <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                              <td className="py-2 px-4">
                                <span className={cn(
                                  "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border",
                                  r.direction === "received"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                )}>
                                  {r.direction === "received" ? "Received" : "Paid"}
                                </span>
                              </td>
                              <td className="py-2 px-4">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                                  {MODE_LABEL[r.mode] ?? r.mode}
                                </span>
                              </td>
                              <td className="py-2 px-4 max-w-[120px] truncate">{r.party}</td>
                              <td className={cn(
                                "py-2 px-4 text-right font-mono font-bold",
                                r.direction === "received" ? "text-emerald-500" : "text-rose-500"
                              )}>
                                {fmtINR(r.amount)}
                              </td>
                            </tr>
                          ))
                      }
                      {(data.rows ?? []).length === 0 && (
                        <tr><td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">No records found.</td></tr>
                      )}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                      <tr>
                        {isReceivablesOrPayables ? (
                          <>
                            <td colSpan={3} className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-4 text-right font-mono font-bold">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.total, 0))}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.paid, 0))}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-500">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.outstanding, 0))}</td>
                            <td />
                          </>
                        ) : (
                          <>
                            <td colSpan={5} className="py-3 px-4 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">Total</td>
                            <td className="py-3 px-4 text-right font-mono font-bold">{fmtINR((data.rows ?? []).reduce((s: number, r: any) => s + r.amount, 0))}</td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Sidebar charts */}
              <div className="space-y-4">
                {/* Aging chart for receivables/payables */}
                {isReceivablesOrPayables && agingChart.length > 0 && (
                  <ChartCard title="Aging Analysis">
                    <ReportDonutChart data={agingChart} height={180} innerRadius={40} outerRadius={65} valueFormat="currency" />
                    <div className="mt-3 space-y-1.5">
                      {Object.entries(aging).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-[var(--text-muted)]">{k} days</span>
                          <span className="font-mono font-bold text-[var(--text-primary)]">{fmtINR(Number(v))}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}

                {/* Mode breakdown for payment tabs */}
                {!isReceivablesOrPayables && byModeChart.length > 0 && (
                  <ChartCard title="By Payment Mode">
                    <ReportDonutChart data={byModeChart} height={180} innerRadius={40} outerRadius={65} valueFormat="currency" />
                  </ChartCard>
                )}

                {/* Monthly trend bar */}
                {(data.monthlyTrend ?? []).length > 1 && !isReceivablesOrPayables && (
                  <ChartCard title="Monthly Trend">
                    <ReportBarChart
                      data={data.monthlyTrend}
                      xKey="month"
                      bars={[
                        { key: "received", label: "Received", color: CHART_COLORS[1] },
                        { key: "paid", label: "Paid", color: CHART_COLORS[3] },
                      ]}
                      height={200}
                    />
                  </ChartCard>
                )}
              </div>
            </div>
          </div>
        )}
      </PageState>
    </ReportShell>
  );
}
