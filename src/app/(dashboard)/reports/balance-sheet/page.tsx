"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Scale } from "lucide-react";
import PageState from "@/components/shared/PageState";
import FinancialYearDateFilters from "@/components/ui/FinancialYearDateFilters";

export default function BalanceSheetPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-04-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  const handleApply = (filters: { fromDate: string; toDate: string }) => {
    setFrom(filters.fromDate);
    setTo(filters.toDate);
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["report-balance-sheet", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/balance-sheet?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

  const totalAssets = data
    ? Object.values(data.assets || {}).reduce((s: number, v) => s + Number(v), 0)
    : 0;
  const totalLiabilities = data
    ? Object.values(data.liabilities || {}).reduce((s: number, v) => s + Number(v), 0)
    : 0;
  const totalEquity = data
    ? Object.values(data.equity || {}).reduce((s: number, v) => s + Number(v), 0)
    : 0;

  return (
    <PageState
      isLoading={isLoading}
      isError={!!error}
      error={error?.message}
      onRetry={refetch}
      skeletonVariant="card"
      skeletonCount={2}
    >
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Balance Sheet</h1>
            <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Reports / Financial Reports</p>
          </div>
        </div>

        <FinancialYearDateFilters onApply={handleApply} onClear={() => { setFrom(`${currentYear}-04-01`); setTo(new Date().toISOString().split("T")[0]); }} />

        {data && (
          <div className="space-y-4">
            {/* Balance check */}
            <div className={`rounded-xl p-4 border text-sm font-bold flex items-center gap-2 ${
              Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-amber-500/10 border-amber-500/20 text-amber-500"
            }`}>
              <Scale className="h-4 w-4" />
              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1
                ? "Balance Sheet is balanced ✓"
                : `Out of balance by ${fmt(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}`}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Assets */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)] bg-blue-500/10">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-500">Assets</h3>
                </div>
                <div className="divide-y divide-[var(--border)] text-xs font-semibold">
                  {Object.entries(data.assets || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between px-5 py-3">
                      <span className="text-[var(--text-muted)] capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-bold font-mono text-[var(--text-primary)]">{fmt(Number(val))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 bg-blue-500/5 border-t border-[var(--border)]">
                    <span className="font-extrabold text-[10px] uppercase text-blue-500">Total Assets</span>
                    <span className="font-extrabold font-mono text-blue-500">{fmt(totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities + Equity */}
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)] bg-rose-500/10">
                  <Scale className="h-4 w-4 text-rose-500" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-500">Liabilities & Equity</h3>
                </div>
                <div className="divide-y divide-[var(--border)] text-xs font-semibold">
                  <div className="px-5 py-2 bg-rose-500/5">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Liabilities</span>
                  </div>
                  {Object.entries(data.liabilities || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between px-5 py-3 pl-8">
                      <span className="text-[var(--text-muted)] capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-bold font-mono text-[var(--text-primary)]">{fmt(Number(val))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 bg-rose-500/5 border-t border-[var(--border)]">
                    <span className="font-extrabold text-[10px] uppercase text-rose-500">Total Liabilities</span>
                    <span className="font-extrabold font-mono text-rose-500">{fmt(totalLiabilities)}</span>
                  </div>

                  <div className="px-5 py-2 bg-emerald-500/5">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Equity</span>
                  </div>
                  {Object.entries(data.equity || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between px-5 py-3 pl-8">
                      <span className="text-[var(--text-muted)] capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-bold font-mono text-[var(--text-primary)]">{fmt(Number(val))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 bg-[var(--table-header-bg)] border-t-2 border-[var(--border)]">
                    <span className="font-extrabold text-[10px] uppercase text-[var(--text-muted)]">Total Liabilities + Equity</span>
                    <span className="font-extrabold font-mono text-[var(--text-primary)]">{fmt(totalLiabilities + totalEquity)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}
