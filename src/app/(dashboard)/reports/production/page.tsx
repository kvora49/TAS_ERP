"use client";

import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Factory, Users, Package, CheckCircle2, Zap, Wallet } from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportBarChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtNum, fmtDate, exportToExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";

type ProdTab = "overview" | "workers";

const TABS: { id: ProdTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Production Overview", icon: <Factory size={13} /> },
  { id: "workers", label: "Worker Job Work", icon: <Users size={13} /> },
];

export default function ProductionReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeTab, setActiveTab] = useState<ProdTab>("overview");

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
  }, []);

  // Production query (existing API)
  const prodQuery = useQuery({
    queryKey: ["report-production-v2", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/production?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load production report");
      return res.json();
    },
    enabled: activeTab === "overview",
    staleTime: 60_000,
  });

  // Worker query (new API)
  const workerQuery = useQuery({
    queryKey: ["report-worker-job-work", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/worker-job-work?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to load worker job work report");
      return res.json();
    },
    enabled: activeTab === "workers",
    staleTime: 60_000,
  });

  const handleExportExcel = useCallback(() => {
    if (activeTab === "overview") {
      const lots = prodQuery.data?.lots ?? [];
      exportToExcel(
        [
          { key: "lot_number", label: "Lot No.", width: 16 },
          { key: "design_name", label: "Design", width: 28 },
          { key: "status", label: "Status", width: 14 },
          { key: "total_quantity", label: "Total Qty", format: "number", width: 14 },
          { key: "created_at", label: "Date", format: "date", width: 14 },
        ],
        lots,
        `ProductionReport_${from}_${to}`
      );
    } else {
      const workers = workerQuery.data?.workers ?? [];
      exportToExcel(
        [
          { key: "name", label: "Worker Name", width: 28 },
          { key: "stages", label: "Stages", width: 24 },
          { key: "jobs", label: "Jobs Done", format: "number", width: 12 },
          { key: "qty_in", label: "Qty In", format: "number", width: 12 },
          { key: "qty_out", label: "Qty Out", format: "number", width: 12 },
          { key: "efficiency", label: "Efficiency %", format: "percent", width: 14 },
          { key: "amount_due", label: "Amount Due (₹)", format: "currency", width: 18 },
          { key: "amount_paid", label: "Paid (₹)", format: "currency", width: 18 },
          { key: "outstanding", label: "Outstanding (₹)", format: "currency", width: 18 },
        ],
        workers,
        `WorkerJobWork_${from}_${to}`
      );
    }
  }, [activeTab, prodQuery.data, workerQuery.data, from, to]);

  const isLoading = activeTab === "overview" ? prodQuery.isLoading : workerQuery.isLoading;
  const error = activeTab === "overview" ? prodQuery.error : workerQuery.error;
  const refetch = activeTab === "overview" ? prodQuery.refetch : workerQuery.refetch;
  const data = activeTab === "overview" ? prodQuery.data : workerQuery.data;

  // Production chart data
  const lotStatusChart = Object.entries(prodQuery.data?.lotsByStatus ?? {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: Number(value),
  }));
  const stageThroughputChart = (prodQuery.data?.stageThroughput ?? []).map((s: any) => ({
    stage: s.stage.length > 12 ? s.stage.slice(0, 12) + "…" : s.stage,
    in: s.in,
    out: s.out,
  }));

  return (
    <ReportShell
      title="Production & Workers"
      infoTooltip="Production lot analysis and worker job work report with efficiency tracking."
      breadcrumbs={["Reports", "Production & Workers"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
    >
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] gap-0.5 -mt-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer",
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
        skeletonVariant="table"
        skeletonRows={8}
        skeletonColumns={5}
        isEmpty={false}
      >
        {data && (
          <>
            {/* ── Production Overview ── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ReportKPICard label="Total Lots" value={data.summary?.totalLots ?? 0} format="number" color="blue" icon={<Factory size={16} />} />
                  <ReportKPICard label="Completed Lots" value={data.summary?.completedLots ?? 0} format="number" color="emerald" icon={<CheckCircle2 size={16} />} />
                  <ReportKPICard label="Total Produced (Qty)" value={data.summary?.totalProduced ?? 0} format="number" color="violet" icon={<Package size={16} />} />
                  <ReportKPICard label="Job Work Amount" value={data.summary?.totalJobWorkAmount ?? 0} color="amber" icon={<Wallet size={16} />} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {/* Stage throughput chart */}
                    {stageThroughputChart.length > 0 && (
                      <ChartCard title="Stage Throughput (Qty In vs Out)">
                        <ReportBarChart
                          data={stageThroughputChart}
                          xKey="stage"
                          bars={[
                            { key: "in", label: "Qty In", color: CHART_COLORS[0] },
                            { key: "out", label: "Qty Out", color: CHART_COLORS[1] },
                          ]}
                          valueFormat="number"
                          height={240}
                        />
                      </ChartCard>
                    )}

                    {/* Lots Table */}
                    <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Production Lots</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                              {["Lot No.", "Design", "Brand", "Qty", "Status", "Date"].map(h => (
                                <th key={h} className={`py-2.5 px-4 ${h === "Qty" ? "text-right" : ""}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-light)]">
                            {(data.lots ?? []).slice(0, 15).map((l: any) => (
                              <tr key={l.id} className="hover:bg-[var(--table-row-hover)] h-10">
                                <td className="py-2 px-4 font-mono font-bold text-[var(--text-primary)]">{l.lot_number}</td>
                                <td className="py-2 px-4">{l.design_name}</td>
                                <td className="py-2 px-4 text-[var(--text-muted)]">{l.brand?.name ?? "—"}</td>
                                <td className="py-2 px-4 text-right font-mono">{fmtNum(l.total_quantity)}</td>
                                <td className="py-2 px-4">
                                  <span className={cn(
                                    "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                                    l.status === "completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                    l.status === "in_progress" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                    "bg-[var(--table-header-bg)] text-[var(--text-muted)] border-[var(--border)]"
                                  )}>
                                    {l.status?.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className="py-2 px-4 text-[var(--text-muted)]">{fmtDate(l.created_at)}</td>
                              </tr>
                            ))}
                            {(data.lots ?? []).length === 0 && (
                              <tr><td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">No production lots found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right: status donut */}
                  <div className="space-y-4">
                    {lotStatusChart.length > 0 && (
                      <ChartCard title="Lots by Status">
                        <ReportDonutChart data={lotStatusChart} height={200} innerRadius={50} outerRadius={75} valueFormat="number" />
                      </ChartCard>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Worker Job Work ── */}
            {activeTab === "workers" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ReportKPICard label="Total Workers" value={data.summary?.totalWorkers ?? 0} format="number" color="blue" icon={<Users size={16} />} />
                  <ReportKPICard label="Total Jobs Done" value={data.summary?.totalJobs ?? 0} format="number" color="violet" icon={<Zap size={16} />} />
                  <ReportKPICard label="Total Amount Due" value={data.summary?.totalDue ?? 0} color="amber" icon={<Wallet size={16} />} />
                  <ReportKPICard label="Outstanding" value={data.summary?.totalOutstanding ?? 0} color="rose" />
                </div>

                {/* Workers Table */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Worker Summary</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          {["Worker", "Stages", "Jobs", "Qty In", "Qty Out", "Efficiency", "Amount Due", "Paid", "Outstanding"].map(h => (
                            <th key={h} className={`py-2.5 px-3 ${["Jobs","Qty In","Qty Out","Efficiency","Amount Due","Paid","Outstanding"].includes(h) ? "text-right" : ""}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)]">
                        {(data.workers ?? []).map((w: any) => (
                          <tr key={w.id} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-3 font-bold text-[var(--text-primary)] max-w-[120px] truncate">{w.name}</td>
                            <td className="py-2 px-3 text-[var(--text-muted)] max-w-[120px] truncate text-[10px]">{w.stages || "—"}</td>
                            <td className="py-2 px-3 text-right font-mono">{w.jobs}</td>
                            <td className="py-2 px-3 text-right font-mono">{fmtNum(w.qty_in)}</td>
                            <td className="py-2 px-3 text-right font-mono">{fmtNum(w.qty_out)}</td>
                            <td className="py-2 px-3 text-right">
                              <span className={cn(
                                "font-bold",
                                w.efficiency >= 95 ? "text-emerald-500" :
                                w.efficiency >= 80 ? "text-amber-500" : "text-rose-500"
                              )}>
                                {w.efficiency.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold">{fmtINR(w.amount_due)}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-500">{fmtINR(w.amount_paid)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-500">{fmtINR(w.outstanding)}</td>
                          </tr>
                        ))}
                        {(data.workers ?? []).length === 0 && (
                          <tr><td colSpan={9} className="py-8 text-center text-[var(--text-muted)]">No worker job work entries found.</td></tr>
                        )}
                      </tbody>
                      {/* Totals */}
                      <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)]">
                        <tr>
                          <td colSpan={6} className="py-3 px-3 text-[10px] font-extrabold uppercase text-[var(--text-muted)]">Total</td>
                          <td className="py-3 px-3 text-right font-mono font-bold">{fmtINR(data.summary?.totalDue ?? 0)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-500">{fmtINR(data.summary?.totalPaid ?? 0)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-rose-500">{fmtINR(data.summary?.totalOutstanding ?? 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </PageState>
    </ReportShell>
  );
}
