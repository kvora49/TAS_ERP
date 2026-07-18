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

  const { data, isLoading, error } = useQuery({
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
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Balance Sheet</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Reports / Financial Reports</p>
          </div>
        </div>

        <FinancialYearDateFilters onApply={handleApply} onClear={() => { setFrom(`${currentYear}-04-01`); setTo(new Date().toISOString().split("T")[0]); }} />

        {data && (
          <div className="space-y-4">
            {/* Balance check */}
            <div className={`rounded-xl p-4 border text-sm font-bold flex items-center gap-2 ${
              Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              <Scale className="h-4 w-4" />
              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1
                ? "Balance Sheet is balanced ✓"
                : `Out of balance by ${fmt(Math.abs(totalAssets - (totalLiabilities + totalEquity)))}`}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Assets */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-blue-50">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Assets</h3>
                </div>
                <div className="divide-y divide-slate-50 text-xs font-semibold">
                  {Object.entries(data.assets || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between px-5 py-3">
                      <span className="text-slate-600 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-bold font-mono text-slate-900">{fmt(Number(val))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 bg-blue-50/60 border-t border-blue-100">
                    <span className="font-extrabold text-[10px] uppercase text-blue-700">Total Assets</span>
                    <span className="font-extrabold font-mono text-blue-700">{fmt(totalAssets)}</span>
                  </div>
                </div>
              </div>

              {/* Liabilities + Equity */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-rose-50">
                  <Scale className="h-4 w-4 text-rose-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-700">Liabilities & Equity</h3>
                </div>
                <div className="divide-y divide-slate-50 text-xs font-semibold">
                  <div className="px-5 py-2 bg-rose-50/30">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Liabilities</span>
                  </div>
                  {Object.entries(data.liabilities || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between px-5 py-3 pl-8">
                      <span className="text-slate-600 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-bold font-mono text-slate-900">{fmt(Number(val))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 bg-rose-50/30 border-t border-rose-100">
                    <span className="font-extrabold text-[10px] uppercase text-rose-700">Total Liabilities</span>
                    <span className="font-extrabold font-mono text-rose-700">{fmt(totalLiabilities)}</span>
                  </div>

                  <div className="px-5 py-2 bg-emerald-50/30">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Equity</span>
                  </div>
                  {Object.entries(data.equity || {}).map(([key, val]) => (
                    <div key={key} className="flex justify-between px-5 py-3 pl-8">
                      <span className="text-slate-600 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="font-bold font-mono text-slate-900">{fmt(Number(val))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 bg-slate-50 border-t-2 border-slate-200">
                    <span className="font-extrabold text-[10px] uppercase text-slate-600">Total Liabilities + Equity</span>
                    <span className="font-extrabold font-mono text-slate-900">{fmt(totalLiabilities + totalEquity)}</span>
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
