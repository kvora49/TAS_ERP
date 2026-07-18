"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import PageState from "@/components/shared/PageState";
import FinancialYearDateFilters from "@/components/ui/FinancialYearDateFilters";

export default function ProfitLossPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-04-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  const handleApply = (filters: { fromDate: string; toDate: string }) => {
    setFrom(filters.fromDate);
    setTo(filters.toDate);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-pl", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/profit-loss?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

  const isProfit = (data?.net_profit || 0) >= 0;

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Profit & Loss Statement</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Reports / Financial Reports
            </p>
          </div>
        </div>

        <FinancialYearDateFilters onApply={handleApply} onClear={() => { setFrom(`${currentYear}-04-01`); setTo(new Date().toISOString().split("T")[0]); }} />

        {isLoading ? (
          <div className="space-y-4 animate-pulse pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5 h-20" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 h-20" />
              <div className="bg-white border border-gray-200 rounded-xl p-5 h-20" />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="h-6 bg-slate-100 rounded-lg w-1/4" />
              <div className="space-y-3">
                <div className="h-5 bg-slate-50 rounded" />
                <div className="h-5 bg-slate-50 rounded" />
                <div className="h-5 bg-slate-50 rounded" />
              </div>
            </div>
          </div>
        ) : data && (
          <div className="space-y-4">
            {/* Summary KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Total Income", value: data.income?.total, color: "emerald", icon: <TrendingUp className="h-5 w-5" /> },
                { label: "Gross Profit", value: data.gross_profit, color: "blue", icon: <DollarSign className="h-5 w-5" /> },
                { label: "Net Profit / (Loss)", value: data.net_profit, color: isProfit ? "emerald" : "rose", icon: isProfit ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" /> },
              ].map((kpi) => (
                <div key={kpi.label} className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-l-4 border-l-${kpi.color}-500`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{kpi.label}</span>
                  <p className={`text-xl font-bold mt-1 text-${kpi.color}-600`}>{fmt(kpi.value)}</p>
                </div>
              ))}
            </div>

            {/* P&L Statement */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                  Income & Expenditure Statement — {data.from} to {data.to}
                </h3>
              </div>
              <div className="divide-y divide-slate-50 text-xs font-semibold">
                {/* Income */}
                <div className="px-6 py-3 bg-emerald-50/40 flex justify-between">
                  <span className="font-extrabold text-slate-700 uppercase tracking-wide text-[10px]">A. INCOME</span>
                </div>
                <Row label="Revenue from Sales" value={data.income?.revenue} fmt={fmt} indent={1} />
                <Row label="Miscellaneous Income" value={data.income?.misc_income} fmt={fmt} indent={1} />
                <TotalRow label="Total Income" value={data.income?.total} fmt={fmt} positive />

                {/* COGS */}
                <div className="px-6 py-3 bg-rose-50/40 flex justify-between">
                  <span className="font-extrabold text-slate-700 uppercase tracking-wide text-[10px]">B. COST OF GOODS SOLD</span>
                </div>
                <Row label="Raw Material Purchases" value={data.cogs} fmt={fmt} indent={1} negative />
                <TotalRow label="Gross Profit (A - B)" value={data.gross_profit} fmt={fmt} positive={data.gross_profit >= 0} />

                {/* Operating Expenses */}
                <div className="px-6 py-3 bg-amber-50/40">
                  <span className="font-extrabold text-slate-700 uppercase tracking-wide text-[10px]">C. OPERATING EXPENSES</span>
                </div>
                {Object.entries(data.expenses?.breakdown || {}).map(([cat, val]) => (
                  <Row key={cat} label={cat} value={val as number} fmt={fmt} indent={1} negative />
                ))}
                <Row label="Salaries & Wages" value={data.salary} fmt={fmt} indent={1} negative />
                <TotalRow label="Total Operating Expenses" value={data.expenses?.total + data.salary} fmt={fmt} negative />

                <TotalRow label="Operating Profit" value={data.operating_profit} fmt={fmt} positive={data.operating_profit >= 0} large />
                <Row label="Bad Debts Written Off" value={data.bad_debts} fmt={fmt} indent={1} negative />
                <TotalRow label="NET PROFIT / (LOSS)" value={data.net_profit} fmt={fmt} positive={isProfit} large />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}

function Row({ label, value, fmt, indent = 0, negative = false, positive = false }: any) {
  return (
    <div className={`flex justify-between px-6 py-2.5 hover:bg-slate-50/50 ${indent === 1 ? "pl-10" : ""}`}>
      <span className="text-slate-600">{label}</span>
      <span className={`font-bold font-mono ${negative ? "text-rose-600" : positive ? "text-emerald-600" : "text-slate-800"}`}>
        {negative && value > 0 ? `(${fmt(value)})` : fmt(value || 0)}
      </span>
    </div>
  );
}

function TotalRow({ label, value, fmt, positive = false, negative = false, large = false }: any) {
  return (
    <div className={`flex justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 ${large ? "border-t-2" : ""}`}>
      <span className={`font-extrabold uppercase tracking-wide text-slate-700 ${large ? "text-[11px]" : "text-[10px]"}`}>{label}</span>
      <span className={`font-extrabold font-mono ${large ? "text-base" : "text-sm"} ${positive ? "text-emerald-600" : negative ? "text-rose-600" : "text-slate-800"}`}>
        {fmt(value || 0)}
      </span>
    </div>
  );
}
