"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import PageState from "@/components/shared/PageState";
import FinancialYearDateFilters from "@/components/ui/FinancialYearDateFilters";

export default function CashFlowPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-04-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  const handleApply = (filters: { fromDate: string; toDate: string }) => {
    setFrom(filters.fromDate);
    setTo(filters.toDate);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-cashflow", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cash-flow?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

  const isPositive = (data?.net_cash_flow || 0) >= 0;

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Cash Flow Statement</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Reports / Financial Reports</p>
          </div>
        </div>

        <FinancialYearDateFilters onApply={handleApply} onClear={() => { setFrom(`${currentYear}-04-01`); setTo(new Date().toISOString().split("T")[0]); }} />

        {data && (
          <div className="space-y-4">
            {/* Net Cash Flow Card */}
            <div className={`rounded-xl p-6 border shadow-sm text-white ${isPositive ? "bg-emerald-600 border-emerald-700" : "bg-rose-600 border-rose-700"}`}>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">Net Cash Flow</p>
              <p className="text-3xl font-extrabold mt-1">{fmt(data.net_cash_flow)}</p>
              <p className="text-xs opacity-70 mt-1">{data.from} to {data.to}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inflows */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-emerald-50">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Cash Inflows</h3>
                </div>
                <div className="divide-y divide-slate-50 text-xs font-semibold">
                  <div className="flex justify-between px-5 py-3">
                    <span className="text-slate-600">Customer Payments</span>
                    <span className="font-mono font-bold text-emerald-600">{fmt(data.inflows.customer_payments)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3">
                    <span className="text-slate-600">Miscellaneous Income</span>
                    <span className="font-mono font-bold text-emerald-600">{fmt(data.inflows.misc_income)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 bg-emerald-50/60 border-t border-emerald-100">
                    <span className="font-extrabold text-slate-700 text-[10px] uppercase">Total Inflows</span>
                    <span className="font-mono font-extrabold text-emerald-700">{fmt(data.total_inflows)}</span>
                  </div>
                </div>
              </div>

              {/* Outflows */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-rose-50">
                  <ArrowUpRight className="h-4 w-4 text-rose-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-700">Cash Outflows</h3>
                </div>
                <div className="divide-y divide-slate-50 text-xs font-semibold">
                  <div className="flex justify-between px-5 py-3">
                    <span className="text-slate-600">Supplier Payments</span>
                    <span className="font-mono font-bold text-rose-600">{fmt(data.outflows.supplier_payments)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3">
                    <span className="text-slate-600">Operating Expenses</span>
                    <span className="font-mono font-bold text-rose-600">{fmt(data.outflows.expenses)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3">
                    <span className="text-slate-600">Salary Disbursals</span>
                    <span className="font-mono font-bold text-rose-600">{fmt(data.outflows.salary)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 bg-rose-50/60 border-t border-rose-100">
                    <span className="font-extrabold text-slate-700 text-[10px] uppercase">Total Outflows</span>
                    <span className="font-mono font-extrabold text-rose-700">{fmt(data.total_outflows)}</span>
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
