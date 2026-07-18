"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Factory, Package, CheckCircle2, IndianRupee } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportPageHeader from "@/components/ui/ReportPageHeader";
import FinancialYearDateFilters from "@/components/ui/FinancialYearDateFilters";
import InsightsCard from "@/components/ui/InsightsCard";

export default function ProductionReportPage() {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-04-01`);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);

  const handleApply = (filters: { fromDate: string; toDate: string }) => {
    setFrom(filters.fromDate);
    setTo(filters.toDate);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-production", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/production?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load production report");
      return res.json();
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

  const stats = data?.summary || {};
  const completionRate = stats.totalLots ? Math.round((stats.completedLots / stats.totalLots) * 100) : 0;

  const insights: string[] = data
    ? [
        `${stats.totalLots} lots created in the period, ${stats.completedLots} completed (${completionRate}% completion rate).`,
        `Total production output: ${stats.totalProduced?.toLocaleString("en-IN") || 0} pieces.`,
        `Job work contracted out: ${fmt(stats.totalJobWorkAmount || 0)} total.`,
      ]
    : [];

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
    active: "bg-blue-50 text-blue-700 border-blue-100",
    pending: "bg-amber-50 text-amber-700 border-amber-100",
    cancelled: "bg-slate-50 text-slate-500 border-slate-100",
  };

  return (
    <PageState isLoading={isLoading} error={error?.message}>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <ReportPageHeader
          title="Production Report"
          infoTooltip="Aggregated view of production lots, stage throughput, and job work activity for the selected period."
          breadcrumbs={["Reports", "Production Report"]}
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
                { label: "Total Lots", value: stats.totalLots, icon: <Factory className="h-5 w-5" />, color: "blue", isNum: true },
                { label: "Completed Lots", value: stats.completedLots, icon: <CheckCircle2 className="h-5 w-5" />, color: "emerald", isNum: true },
                { label: "Total Produced (Pcs)", value: stats.totalProduced?.toLocaleString("en-IN") || 0, icon: <Package className="h-5 w-5" />, color: "violet", isNum: false },
                { label: "Job Work Cost", value: fmt(stats.totalJobWorkAmount), icon: <IndianRupee className="h-5 w-5" />, color: "amber", isNum: false },
              ].map((kpi) => (
                <div key={kpi.label} className={`bg-white border border-gray-200 rounded-xl p-5 shadow-sm border-l-4 border-l-${kpi.color}-500`}>
                  <div className={`p-2.5 bg-${kpi.color}-50 rounded-lg w-fit text-${kpi.color}-600 mb-3`}>{kpi.icon}</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{kpi.label}</span>
                  <p className={`text-2xl font-bold text-${kpi.color}-600 mt-0.5`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Stage Throughput */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Stage-wise Throughput</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-200 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-6">Stage</th>
                      <th className="py-3 px-6 text-right">Qty In</th>
                      <th className="py-3 px-6 text-right">Qty Out</th>
                      <th className="py-3 px-6 text-right">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                    {(data.stageThroughput || []).length === 0 ? (
                      <tr><td colSpan={4} className="py-8 text-center text-slate-400">No stage entries in this period.</td></tr>
                    ) : (
                      (data.stageThroughput || []).map((s: any) => {
                        const eff = s.in > 0 ? Math.round((s.out / s.in) * 100) : 0;
                        return (
                          <tr key={s.stage} className="hover:bg-slate-50/50 h-12">
                            <td className="py-3 px-6 font-bold text-slate-900">{s.stage}</td>
                            <td className="py-3 px-6 text-right font-mono">{s.in.toLocaleString("en-IN")}</td>
                            <td className="py-3 px-6 text-right font-mono">{s.out.toLocaleString("en-IN")}</td>
                            <td className="py-3 px-6 text-right">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${eff >= 90 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : eff >= 70 ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
                                {eff}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lots by Status */}
            {data.lotsByStatus && Object.keys(data.lotsByStatus).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-4">Lots by Status</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(data.lotsByStatus).map(([status, count]) => (
                    <div key={status} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-bold ${statusColors[status] || "bg-slate-50 text-slate-600 border-slate-100"}`}>
                      <span className="capitalize">{status}</span>
                      <span className="ml-1 text-lg font-extrabold">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <InsightsCard insights={insights} />
          </div>
        )}
      </div>
    </PageState>
  );
}
