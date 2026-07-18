"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageState from "@/components/shared/PageState";
import FinancialYearDateFilters from "@/components/ui/FinancialYearDateFilters";

export default function GSTSummaryPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-04-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState<"sales" | "purchases">("sales");

  const handleApply = (filters: { fromDate: string; toDate: string }) => {
    setFrom(filters.fromDate);
    setTo(filters.toDate);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-gst", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/gst-summary?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

  const isPayable = (data?.summary?.net_gst_payable || 0) >= 0;
  const rows = activeTab === "sales" ? data?.sales || [] : data?.purchases || [];

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">GST Summary Report</h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Reports / Tax Reports
            </p>
          </div>
        </div>

        <FinancialYearDateFilters onApply={handleApply} onClear={() => { setFrom(`${currentYear}-04-01`); setTo(new Date().toISOString().split("T")[0]); }} />

        {isLoading ? (
          <div className="space-y-4 animate-pulse pt-2">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 h-16" />
              <div className="bg-white border border-gray-200 rounded-xl p-4 h-16" />
              <div className="bg-white border border-gray-200 rounded-xl p-4 h-16" />
              <div className="bg-white border border-gray-200 rounded-xl p-4 h-16" />
              <div className="bg-white border border-gray-200 rounded-xl p-4 h-16" />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 h-64" />
          </div>
        ) : data && (
          <div className="space-y-4">
            {/* GST KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Taxable Sales", value: data.summary.net_taxable_sales, color: "text-slate-900" },
                { label: "Output GST (Collected)", value: data.summary.total_output_gst, color: "text-emerald-600" },
                { label: "Taxable Purchases", value: data.summary.net_taxable_purchases, color: "text-slate-900" },
                { label: "Input GST (Paid)", value: data.summary.total_input_gst, color: "text-rose-600" },
                { label: isPayable ? "Net GST Payable" : "GST Credit", value: Math.abs(data.summary.net_gst_payable), color: isPayable ? "text-amber-600" : "text-emerald-600" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{kpi.label}</span>
                  <p className={`text-base font-bold mt-1 ${kpi.color}`}>{fmt(kpi.value)}</p>
                </div>
              ))}
            </div>

            {/* Tab Toggle */}
            <div className="flex border-b border-gray-200 gap-6">
              {(["sales", "purchases"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer capitalize ${
                    activeTab === tab ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}>
                  {tab === "sales" ? "Sales / Output GST" : "Purchases / Input GST"}
                </button>
              ))}
            </div>

            {/* Transactions Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-6">Bill / Invoice No.</th>
                      <th className="py-3 px-6">Date</th>
                      <th className="py-3 px-6">Party</th>
                      <th className="py-3 px-6 text-right">Taxable (₹)</th>
                      <th className="py-3 px-6 text-right">GST (₹)</th>
                      <th className="py-3 px-6 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                    {rows.length === 0 ? (
                      <tr><td colSpan={6} className="py-10 text-center text-slate-400">No records found for selected period.</td></tr>
                    ) : (
                      rows.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50 h-12">
                          <td className="py-3 px-6 font-mono font-bold text-slate-900">{row.number}</td>
                          <td className="py-3 px-6 font-mono text-slate-500">
                            {new Date(row.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="py-3 px-6">{row.party || "—"}</td>
                          <td className="py-3 px-6 text-right font-mono">{fmt(row.taxable)}</td>
                          <td className="py-3 px-6 text-right font-mono font-bold text-[var(--primary)]">{fmt(row.gst)}</td>
                          <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">{fmt(row.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-300 bg-slate-50 font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="py-3 px-6 uppercase tracking-wide text-slate-500">Totals</td>
                      <td className="py-3 px-6 text-right font-mono">{fmt(rows.reduce((s: number, r: any) => s + r.taxable, 0))}</td>
                      <td className="py-3 px-6 text-right font-mono text-[var(--primary)]">{fmt(rows.reduce((s: number, r: any) => s + r.gst, 0))}</td>
                      <td className="py-3 px-6 text-right font-mono">{fmt(rows.reduce((s: number, r: any) => s + r.total, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageState>
  );
}
