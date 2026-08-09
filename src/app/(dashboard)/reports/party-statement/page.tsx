"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ArrowDownLeft, ArrowUpRight, Scale, Calendar, UserCheck } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportBarChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtDate, exportToExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";

import BillTypeFilter, { BillType } from "@/components/reports/BillTypeFilter";
import FilterSelect from "@/components/reports/filters/FilterSelect";

const VOUCHER_TYPE_OPTIONS = [
  { label: "Sales Invoices", value: "sales_invoice" },
  { label: "Purchase Bills", value: "purchase_bill" },
  { label: "Payments / Receipts", value: "payment" },
  { label: "Credit Notes", value: "credit_note" },
  { label: "Debit Notes", value: "debit_note" },
];

export default function PartyStatementPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [partyId, setPartyId] = useState("");
  const [billType, setBillType] = useState<BillType>("all");
  const [voucherType, setVoucherType] = useState("all");

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  // Fetch parties list
  const { data: initData } = useQuery<{ parties: any[] }>({
    queryKey: ["party-statement-parties"],
    queryFn: async () => {
      const res = await fetch("/api/reports/party-statement");
      if (!res.ok) throw new Error("Failed to load parties");
      return res.json();
    },
    staleTime: 300_000,
  });

  // Fetch selected party statement
  const { data: statementData, isLoading, error, refetch } = useQuery({
    queryKey: ["party-statement", partyId, from, to, billType, voucherType],
    queryFn: async () => {
      if (!partyId) return null;
      const params = new URLSearchParams({ party_id: partyId, from, to });
      if (billType !== "all") params.set("bill_type", billType);
      if (voucherType !== "all") params.set("voucher_type", voucherType);
      const res = await fetch(`/api/reports/party-statement?${params}`);
      if (!res.ok) throw new Error("Failed to load party statement");
      return res.json();
    },
    enabled: !!partyId,
    staleTime: 60_000,
  });

  const parties = initData?.parties ?? [];
  const selectedParty = parties.find((p) => p.id === partyId);

  const handleExportExcel = useCallback(() => {
    if (!statementData) return;
    exportToExcel(
      [
        { key: "date", label: "Date", format: "date", width: 14 },
        { key: "type", label: "Type", width: 16 },
        { key: "reference", label: "Reference", width: 20 },
        { key: "debit", label: "Debit (Dr ₹)", format: "currency", width: 18 },
        { key: "credit", label: "Credit (Cr ₹)", format: "currency", width: 18 },
        { key: "runningBalance", label: "Running Balance (₹)", format: "currency", width: 20 },
      ],
      statementData.rows ?? [],
      `PartyStatement_${selectedParty?.name ?? partyId}_${from}_${to}`
    );
  }, [statementData, selectedParty, partyId, from, to]);

  const summary = statementData?.summary ?? {};
  const aging = statementData?.aging ?? {};
  const agingChart = Object.entries(aging).map(([k, v], i) => ({
    name: k + " days",
    value: Number(v),
    color: [CHART_COLORS[1], CHART_COLORS[2], CHART_COLORS[6], CHART_COLORS[3]][i],
  })).filter(d => d.value > 0);

  return (
    <ReportShell
      title="Party Ledger Statement"
      infoTooltip="Detailed transaction ledger, opening/closing balance, and aging analysis for any customer or supplier."
      breadcrumbs={["Reports", "Party Statement"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Party"
            value={partyId}
            onChange={setPartyId}
            options={parties.map((p) => ({
              label: `${p.company_name ? `${p.company_name} (${p.name})` : p.name}${p.party_type ? ` — ${p.party_type}` : ""}`,
              value: p.id,
            }))}
            placeholder="-- Select Customer / Supplier --"
          />
          <FilterSelect
            label="Voucher Type"
            value={voucherType}
            onChange={setVoucherType}
            options={VOUCHER_TYPE_OPTIONS}
            placeholder="All Voucher Types"
          />
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">Bill Type</span>
            <BillTypeFilter value={billType} onChange={setBillType} />
          </div>
        </div>
      }
    >

      {!partyId ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--text-muted)] space-y-3">
          <UserCheck size={36} className="mx-auto text-[var(--text-faint)]" />
          <p className="text-sm font-bold text-[var(--text-primary)]">Select a Party to View Statement</p>
          <p className="text-xs max-w-sm mx-auto">Use the party dropdown in the filter bar above to select a customer or supplier.</p>
        </div>
      ) : (
        <PageState
          isLoading={isLoading}
          isError={!!error}
          error={(error as any)?.message}
          onRetry={refetch}
          skeletonVariant="table"
          skeletonRows={8}
          skeletonColumns={6}
          isEmpty={!isLoading && (statementData?.rows ?? []).length === 0}
          emptyTitle="No transactions found"
          emptyDescription="No transactions found for this party during the selected date range."
        >
          {statementData && (
            <div className="space-y-6">
              {/* Party Header Info Card */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5 shadow-[var(--shadow-sm)] flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">{selectedParty?.company_name || selectedParty?.name}</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">
                    Type: <span className="capitalize text-[var(--text-primary)] font-semibold">{selectedParty?.party_type}</span>
                    {selectedParty?.gstin && <span className="ml-3 font-mono">GSTIN: {selectedParty.gstin}</span>}
                    {selectedParty?.mobile && <span className="ml-3 font-mono">Ph: {selectedParty.mobile}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Closing Balance</p>
                  <p className={cn(
                    "text-2xl font-extrabold font-mono",
                    summary.closingBalance >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {fmtINR(Math.abs(summary.closingBalance ?? 0))}
                    <span className="text-xs ml-1 font-bold">{summary.closingBalance >= 0 ? "Dr (Receivable)" : "Cr (Payable)"}</span>
                  </p>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReportKPICard label="Opening Balance" value={summary.openingBalance ?? 0} color="slate" />
                <ReportKPICard label="Total Debits (Billed)" value={summary.totalDebit ?? 0} color="emerald" icon={<ArrowDownLeft size={16} />} />
                <ReportKPICard label="Total Credits (Paid)" value={summary.totalCredit ?? 0} color="indigo" icon={<ArrowUpRight size={16} />} />
                <ReportKPICard label="Net Closing Balance" value={summary.closingBalance ?? 0} color={summary.closingBalance >= 0 ? "emerald" : "rose"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ledger table */}
                <div className="lg:col-span-2 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Ledger Entries</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          {["Date", "Type", "Reference", "Debit (Dr ₹)", "Credit (Cr ₹)", "Balance (₹)"].map(h => (
                            <th key={h} className={`py-2.5 px-4 ${["Debit (Dr ₹)","Credit (Cr ₹)","Balance (₹)"].includes(h) ? "text-right" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {/* Opening balance row */}
                        <tr className="bg-[var(--table-header-bg)]/50 font-bold">
                          <td className="py-2.5 px-4 text-[var(--text-muted)]">{fmtDate(from)}</td>
                          <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)]" colSpan={2}>Opening Balance</td>
                          <td className="py-2.5 px-4 text-right font-mono">—</td>
                          <td className="py-2.5 px-4 text-right font-mono">—</td>
                          <td className="py-2.5 px-4 text-right font-mono text-[var(--text-primary)]">{fmtINR(summary.openingBalance)}</td>
                        </tr>

                        {(statementData.rows ?? []).map((r: any, i: number) => (
                          <tr key={i} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(r.date)}</td>
                            <td className="py-2 px-4 font-semibold text-[var(--text-primary)] capitalize">{r.type?.replace(/_/g, " ")}</td>
                            <td className="py-2 px-4 font-mono text-[var(--text-muted)]">{r.reference || "—"}</td>
                            <td className="py-2 px-4 text-right font-mono text-emerald-500">{r.debit > 0 ? fmtINR(r.debit) : "—"}</td>
                            <td className="py-2 px-4 text-right font-mono text-indigo-500">{r.credit > 0 ? fmtINR(r.credit) : "—"}</td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(r.runningBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Closing balance row */}
                      <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                        <tr>
                          <td colSpan={3} className="py-3 px-4 uppercase tracking-wide text-[var(--text-muted)]">Totals / Closing Balance</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-500">{fmtINR(summary.totalDebit)}</td>
                          <td className="py-3 px-4 text-right font-mono text-indigo-500">{fmtINR(summary.totalCredit)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[var(--primary)]">{fmtINR(summary.closingBalance)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Aging chart sidebar */}
                <div className="space-y-4">
                  {agingChart.length > 0 && (
                    <ChartCard title="Aging Breakdown">
                      <ReportDonutChart data={agingChart} height={180} innerRadius={42} outerRadius={68} valueFormat="currency" />
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

                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Statement Summary</h3>
                    {[
                      { label: "Opening Balance", value: fmtINR(summary.openingBalance) },
                      { label: "Total Debits", value: fmtINR(summary.totalDebit) },
                      { label: "Total Credits", value: fmtINR(summary.totalCredit) },
                      { label: "Closing Balance", value: fmtINR(summary.closingBalance) },
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
      )}
    </ReportShell>
  );
}
