"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, FileText, ArrowRight, IndianRupee, Users, ShoppingBag } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportPageHeader from "@/components/ui/ReportPageHeader";
import FinancialYearDateFilters from "@/components/ui/FinancialYearDateFilters";
import InsightsCard from "@/components/ui/InsightsCard";

export default function SalesReportPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-04-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  const handleApply = (filters: { fromDate: string; toDate: string }) => {
    setFrom(filters.fromDate);
    setTo(filters.toDate);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-sales", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load sales report");
      return res.json();
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

  const stats = data?.summary || {};

  const insights: string[] = data
    ? [
        `Generated ${fmt(stats.totalRevenue)} in gross revenue across ${stats.totalBills} billing transactions.`,
        `Net sales revenue (after returns of ${fmt(stats.totalReturns)}) is ${fmt(stats.netRevenue)}.`,
        `Currently outstanding unpaid sales balance stands at ${fmt(stats.totalOutstanding)}.`,
      ]
    : [];

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <ReportPageHeader
          title="Sales Report"
          infoTooltip="Comprehensive analysis of billings, tax liabilities, customer sales rankings, and returns."
          breadcrumbs={["Reports", "Sales Report"]}
          filters={
            <FinancialYearDateFilters
              onApply={handleApply}
              onClear={() => { setFrom(`${currentYear}-04-01`); setTo(new Date().toISOString().split("T")[0]); }}
            />
          }
          onExportPDF={() => window.print()}
          onPrint={() => window.print()}
        />

        {data && (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Gross Revenue", value: fmt(stats.totalRevenue), icon: <TrendingUp className="h-5 w-5" />, color: "emerald" },
                { label: "Sales Returns", value: fmt(stats.totalReturns), icon: <ShoppingBag className="h-5 w-5" />, color: "rose" },
                { label: "Net Revenue", value: fmt(stats.netRevenue), icon: <IndianRupee className="h-5 w-5" />, color: "blue" },
                { label: "Outstanding Dues", value: fmt(stats.totalOutstanding), icon: <Users className="h-5 w-5" />, color: "amber" },
              ].map((kpi) => (
                <div key={kpi.label} className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-l-4 border-l-${kpi.color}-500`}>
                  <div className={`p-2.5 bg-${kpi.color}-50 rounded-lg w-fit text-${kpi.color}-600 mb-3`}>{kpi.icon}</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{kpi.label}</span>
                  <p className={`text-xl font-bold text-${kpi.color}-600 mt-0.5`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Customers Table */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Top Customers (By Value)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-6">Customer</th>
                        <th className="py-3 px-6 text-right">Revenue Contributed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                      {(data.topParties || []).length === 0 ? (
                        <tr><td colSpan={2} className="py-8 text-center text-slate-400">No customer sales recorded in this period.</td></tr>
                      ) : (
                        (data.topParties || []).map((customer: any, idx: number) => (
                          <tr key={customer.id || idx} className="hover:bg-slate-50/50 h-12">
                            <td className="py-3 px-6 font-bold text-slate-900">{customer.name}</td>
                            <td className="py-3 px-6 text-right font-mono font-bold text-emerald-600">{fmt(customer.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Monthly Trend Table */}
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Monthly Revenue Trend</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-6">Month</th>
                        <th className="py-3 px-6 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                      {(data.monthlyTrend || []).length === 0 ? (
                        <tr><td colSpan={2} className="py-8 text-center text-slate-400">No monthly sales trends found.</td></tr>
                      ) : (
                        (data.monthlyTrend || []).map((trend: any, idx: number) => (
                          <tr key={trend.month || idx} className="hover:bg-slate-50/50 h-12">
                            <td className="py-3 px-6 font-bold text-slate-900">{trend.month}</td>
                            <td className="py-3 px-6 text-right font-mono font-bold text-blue-600">{fmt(trend.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <InsightsCard insights={insights} />
          </div>
        )}
      </div>
    </PageState>
  );
}
