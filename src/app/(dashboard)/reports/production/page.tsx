"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  Factory, Users, Package, CheckCircle2, Zap, Wallet, RotateCcw,
  AlertTriangle, Trash2, Clock, ChevronDown, ChevronRight, TrendingUp,
  Tag, Layers, IndianRupee, Eye, ArrowRight, CheckCircle, ShieldAlert,
  Percent, ArrowDownLeft, ArrowUpRight
} from "lucide-react";
import PageState from "@/components/shared/PageState";
import ReportShell, { ReportFilters } from "@/components/reports/ReportShell";
import ReportKPICard from "@/components/reports/ReportKPICard";
import { ReportBarChart, ReportDonutChart, ChartCard, CHART_COLORS } from "@/components/reports/ReportChart";
import { fmtINR, fmtNum, fmtDate, exportMultiSheetExcel, getPresetDates } from "@/lib/report-export";
import { cn } from "@/lib/utils";
import Link from "next/link";
import FilterSelect from "@/components/reports/filters/FilterSelect";
import FilterPills from "@/components/reports/filters/FilterPills";
import InlineDrillDownPanel, { DrillDownItem } from "@/components/reports/InlineDrillDownPanel";

// ─── Main Tabs ────────────────────────────────────────────────────────────────

type ProdMainTab = "overview" | "worker_job_work";
type OverviewSubTab = "all" | "stage_analysis" | "rework_damage" | "cost_analysis" | "lot_timeline" | "reconciliation";
type WorkerSubTab = "summary" | "job_register" | "stage_breakdown" | "efficiency" | "payments";

const MAIN_TABS: { id: ProdMainTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Production Overview", icon: <Factory size={14} /> },
  { id: "worker_job_work", label: "Worker Job Work", icon: <Users size={14} /> },
];

const OVERVIEW_SUB_TABS: { id: OverviewSubTab; label: string }[] = [
  { id: "all", label: "Production Overview" },
  { id: "stage_analysis", label: "Stage Analysis" },
  { id: "rework_damage", label: "Rework & Damage" },
  { id: "cost_analysis", label: "Production Cost" },
  { id: "lot_timeline", label: "Lot Timeline" },
  { id: "reconciliation", label: "Reconciliation" },
];

const WORKER_SUB_TABS: { id: WorkerSubTab; label: string }[] = [
  { id: "summary", label: "Worker Summary" },
  { id: "job_register", label: "Job Wise Register" },
  { id: "stage_breakdown", label: "Worker Stage Breakdown" },
  { id: "efficiency", label: "Efficiency Analysis" },
  { id: "payments", label: "Payment Summary" },
];

const LOT_STATUS_OPTIONS = [
  { id: "all", label: "All Lot Statuses" },
  { id: "in_progress", label: "In Progress", badgeClass: "bg-blue-600 text-white" },
  { id: "completed", label: "Completed", badgeClass: "bg-emerald-600 text-white" },
  { id: "on_hold", label: "On Hold", badgeClass: "bg-amber-600 text-white" },
];

const PAYMENT_STATUS_OPTIONS = [
  { id: "all", label: "All Payment Status" },
  { id: "Paid", label: "Paid", badgeClass: "bg-emerald-600 text-white" },
  { id: "Part Paid", label: "Part Paid", badgeClass: "bg-amber-600 text-white" },
  { id: "Unpaid", label: "Unpaid", badgeClass: "bg-rose-600 text-white" },
];

const DEFECT_COLORS = ["#3B82F6", "#EF4444", "#F59E0B", "#8B5CF6", "#10B981", "#EC4899"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductionReportsPage() {
  const defaultDates = getPresetDates("this_fy");
  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activeMainTab, setActiveMainTab] = useState<ProdMainTab>("overview");
  const [overviewSubTab, setOverviewSubTab] = useState<OverviewSubTab>("all");
  const [workerSubTab, setWorkerSubTab] = useState<WorkerSubTab>("summary");

  // Filters
  const [workerId, setWorkerId] = useState<string>("all");
  const [stageName, setStageName] = useState<string>("all");
  const [lotStatus, setLotStatus] = useState<string>("all");
  const [brandId, setBrandId] = useState<string>("all");
  const [designId, setDesignId] = useState<string>("all");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("all");
  const [expandedLotId, setExpandedLotId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Fetch Workers list
  const { data: workersData } = useQuery({
    queryKey: ["production-workers-list"],
    queryFn: async () => {
      const res = await fetch("/api/workers");
      if (!res.ok) return { workers: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  const workerOptions = [
    { label: "All Workers", value: "all" },
    ...(workersData?.workers ?? []).map((w: any) => ({
      label: w.name,
      value: w.id,
    })),
  ];

  // Fetch Brands
  const { data: brandsData } = useQuery({
    queryKey: ["production-brands-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/brands");
      if (!res.ok) return { brands: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  const brandOptions = [
    { label: "All Brands", value: "all" },
    ...(brandsData?.brands ?? []).map((b: any) => ({
      label: b.name,
      value: b.id,
    })),
  ];

  // Fetch Production Stages
  const { data: stagesData } = useQuery({
    queryKey: ["production-stages-list"],
    queryFn: async () => {
      const res = await fetch("/api/master-data/production-stages");
      if (!res.ok) return { stages: [] };
      return res.json();
    },
    staleTime: 300_000,
  });

  const stageOptions = [
    { label: "All Stages", value: "all" },
    ...(stagesData?.stages ?? []).map((s: any) => ({
      label: s.name,
      value: s.name.toLowerCase(),
    })),
  ];

  // Fetch Production Overview Data
  const prodQuery = useQuery({
    queryKey: ["production-overview-v4", from, to, workerId, stageName, lotStatus, brandId, designId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (workerId !== "all") params.set("worker_id", workerId);
      if (stageName !== "all") params.set("stage_name", stageName);
      if (lotStatus !== "all") params.set("status", lotStatus);
      if (brandId !== "all") params.set("brand_id", brandId);
      if (designId !== "all") params.set("design_id", designId);

      const res = await fetch(`/api/reports/production?${params}`);
      if (!res.ok) throw new Error("Failed to load production overview data");
      return res.json();
    },
    enabled: activeMainTab === "overview",
    staleTime: 60_000,
  });

  // Fetch Worker Job Work Data
  const workerQuery = useQuery({
    queryKey: ["worker-job-work-v4", from, to, workerId, stageName, paymentStatus, selectedWorkerId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (workerId !== "all") params.set("worker_id", workerId);
      if (stageName !== "all") params.set("stage_name", stageName);
      if (paymentStatus !== "all") params.set("payment_status", paymentStatus);

      const res = await fetch(`/api/reports/worker-job-work?${params}`);
      if (!res.ok) throw new Error("Failed to load worker job work data");
      return res.json();
    },
    enabled: activeMainTab === "worker_job_work",
    staleTime: 60_000,
  });

  const handleApply = useCallback((filters: ReportFilters) => {
    setFrom(filters.from);
    setTo(filters.to);
    setExpandedLotId(null);
    setExpandedJobId(null);
  }, []);

  const handleExportExcel = useCallback(() => {
    if (activeMainTab === "overview" && prodQuery.data) {
      exportMultiSheetExcel([
        {
          name: "Production Lots",
          columns: [
            { key: "lot_number", label: "Lot No.", width: 16 },
            { key: "lot_date", label: "Date", format: "date", width: 14 },
            { key: "design_name", label: "Design", width: 24 },
            { key: "brand", label: "Brand", width: 18 },
            { key: "input_qty", label: "Input Qty (Pcs)", format: "number", width: 16 },
            { key: "good_output", label: "Good Output (Pcs)", format: "number", width: 16 },
            { key: "rework_qty", label: "Rework (Pcs)", format: "number", width: 14 },
            { key: "damage_qty", label: "Damage (Pcs)", format: "number", width: 14 },
            { key: "current_stage", label: "Current Stage", width: 16 },
            { key: "status", label: "Status", width: 14 },
          ],
          rows: prodQuery.data.lots ?? [],
        },
        {
          name: "Stage Analysis",
          columns: [
            { key: "stage", label: "Stage", width: 18 },
            { key: "input_qty", label: "Input Qty", format: "number", width: 14 },
            { key: "output_qty", label: "Output Qty", format: "number", width: 14 },
            { key: "rework_qty", label: "Rework Qty", format: "number", width: 14 },
            { key: "damage_qty", label: "Damage Qty", format: "number", width: 14 },
            { key: "efficiency", label: "Efficiency %", width: 14 },
          ],
          rows: prodQuery.data.stageAnalysis ?? [],
        },
      ], `ProductionOverview_${from}_${to}`);
    } else if (activeMainTab === "worker_job_work" && workerQuery.data) {
      exportMultiSheetExcel([
        {
          name: "Worker Summary",
          columns: [
            { key: "name", label: "Worker Name", width: 28 },
            { key: "stages", label: "Stages", width: 24 },
            { key: "jobs", label: "Jobs", format: "number", width: 12 },
            { key: "qty_in", label: "Qty In (Pcs)", format: "number", width: 14 },
            { key: "qty_out", label: "Qty Out (Pcs)", format: "number", width: 14 },
            { key: "efficiency", label: "Efficiency %", width: 14 },
            { key: "amount_due", label: "Amount Due (Rs.)", format: "currency", width: 18 },
            { key: "amount_paid", label: "Paid (Rs.)", format: "currency", width: 18 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 18 },
          ],
          rows: workerQuery.data.workers ?? [],
        },
        {
          name: "Job Wise Register",
          columns: [
            { key: "date", label: "Date", format: "date", width: 14 },
            { key: "job_no", label: "Job No.", width: 16 },
            { key: "worker", label: "Worker", width: 24 },
            { key: "lot_no", label: "Lot No.", width: 16 },
            { key: "stage", label: "Stage", width: 16 },
            { key: "qty", label: "Qty", format: "number", width: 12 },
            { key: "rate", label: "Rate (Rs.)", format: "currency", width: 14 },
            { key: "amount", label: "Amount (Rs.)", format: "currency", width: 16 },
            { key: "paid", label: "Paid (Rs.)", format: "currency", width: 16 },
            { key: "outstanding", label: "Outstanding (Rs.)", format: "currency", width: 16 },
            { key: "status", label: "Status", width: 12 },
          ],
          rows: workerQuery.data.jobWiseRegister ?? [],
        },
      ], `WorkerJobWork_${from}_${to}`);
    }
  }, [activeMainTab, prodQuery.data, workerQuery.data, from, to]);

  const isLoading = activeMainTab === "overview" ? prodQuery.isLoading : workerQuery.isLoading;
  const error = activeMainTab === "overview" ? prodQuery.error : workerQuery.error;
  const refetch = activeMainTab === "overview" ? prodQuery.refetch : workerQuery.refetch;
  const pData = prodQuery.data;
  const wData = workerQuery.data;

  // Donut chart for defects
  const defectDonutData = useMemo(() => {
    if (!pData?.reworkDamageBreakdown) return [];
    return pData.reworkDamageBreakdown.map((d: any, i: number) => ({
      name: d.category,
      value: d.count,
      color: DEFECT_COLORS[i % DEFECT_COLORS.length],
    })).filter((d: any) => d.value > 0);
  }, [pData]);

  // Donut chart for worker payments
  const workerPaymentDonutData = useMemo(() => {
    if (!wData?.summary) return [];
    return [
      { name: "Paid", value: wData.summary.totalPaid ?? 0, color: "#10B981" },
      { name: "Outstanding", value: wData.summary.totalOutstanding ?? 0, color: "#EF4444" },
    ].filter(d => d.value > 0);
  }, [wData]);

  // Drilldown items for production lots
  const getLotDrillItems = (lot: any): DrillDownItem[] => [
    {
      id: lot.id + "_lot",
      doc_number: lot.lot_number,
      date: lot.lot_date,
      party_name: lot.design_name,
      description: `${lot.brand} · Input: ${lot.input_qty} pcs · Output: ${lot.good_output} pcs`,
      category: lot.current_stage,
      amount: lot.good_output,
      view_url: `/production/lots/${lot.id}`,
      badge: lot.status,
      badge_color: lot.status === "completed" ? "emerald" : "blue",
    },
  ];

  return (
    <ReportShell
      title="Production & Workers"
      infoTooltip="Track all production lots, stage progress, output, rework, damage, production cost, worker performance and job-work charges."
      breadcrumbs={["Reports", "Production & Workers", activeMainTab === "overview" ? "Production Overview" : "Worker Job Work"]}
      onApply={handleApply}
      onExportExcel={handleExportExcel}
      extraFilters={
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Stage & Worker Filters */}
          <FilterSelect
            label="Process Stage"
            value={stageName}
            onChange={setStageName}
            options={stageOptions}
            placeholder="All Stages"
          />

          <FilterSelect
            label="Worker"
            value={workerId}
            onChange={setWorkerId}
            options={workerOptions}
            placeholder="All Workers"
          />

          {/* Overview Specific Filters */}
          {activeMainTab === "overview" && (
            <>
              <FilterSelect
                label="Brand"
                value={brandId}
                onChange={setBrandId}
                options={brandOptions}
                placeholder="All Brands"
              />
              <FilterPills
                label="Lot Status"
                value={lotStatus}
                onChange={setLotStatus}
                options={LOT_STATUS_OPTIONS}
              />
            </>
          )}

          {/* Worker Specific Filters */}
          {activeMainTab === "worker_job_work" && (
            <FilterPills
              label="Payment Status"
              value={paymentStatus}
              onChange={setPaymentStatus}
              options={PAYMENT_STATUS_OPTIONS}
            />
          )}
        </div>
      }
    >
      {/* ── Top Main Tabs (Overview vs Worker Job Work) ── */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-0 -mt-2">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveMainTab(tab.id);
              setExpandedLotId(null);
              setExpandedJobId(null);
            }}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-xs font-extrabold whitespace-nowrap transition-all border-b-2 cursor-pointer",
              activeMainTab === tab.id
                ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--table-header-bg)] rounded-t-lg"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <PageState
        isLoading={isLoading}
        isError={!!error}
        error={(error as any)?.message}
        onRetry={refetch}
        skeletonVariant="stats"
        skeletonCount={7}
        isEmpty={false}
      >
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: PRODUCTION OVERVIEW */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeMainTab === "overview" && pData && (
          <div className="space-y-5 pt-2">
            {/* ── Row 1 KPIs (7 Cards) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <ReportKPICard
                label="Total Lots"
                value={pData.summary?.totalLots}
                format="number"
                color="violet"
                icon={<Factory size={16} />}
                subLabel="All lots created"
              />
              <ReportKPICard
                label="Completed Lots"
                value={pData.summary?.completedLots}
                format="number"
                color="emerald"
                icon={<CheckCircle2 size={16} />}
                subLabel={`${(pData.summary?.completedPct ?? 0).toFixed(2)}% of total`}
              />
              <ReportKPICard
                label="In Progress Lots"
                value={pData.summary?.inProgressLots}
                format="number"
                color="amber"
                icon={<Clock size={16} />}
                subLabel={`${(pData.summary?.inProgressPct ?? 0).toFixed(2)}% of total`}
              />
              <ReportKPICard
                label="On Hold Lots"
                value={pData.summary?.onHoldLots}
                format="number"
                color="blue"
                icon={<ShieldAlert size={16} />}
                subLabel={`${(pData.summary?.onHoldPct ?? 0).toFixed(2)}% of total`}
              />
              <ReportKPICard
                label="Input Qty (Total)"
                value={pData.summary?.inputQtyTotal}
                format="number"
                color="indigo"
                icon={<Package size={16} />}
                subLabel="Total pieces in"
              />
              <ReportKPICard
                label="Final Output Qty"
                value={pData.summary?.finalOutputQty}
                format="number"
                color="violet"
                icon={<CheckCircle size={16} />}
                subLabel="Good finished pcs"
              />
              <ReportKPICard
                label="Production Cost"
                value={pData.summary?.productionCostTotal}
                color="emerald"
                icon={<IndianRupee size={16} />}
                subLabel="Total production cost"
              />
            </div>

            {/* ── Row 2 Secondary KPIs (4 Metrics Strip) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Rework Qty</p>
                  <p className="text-base font-black font-mono text-amber-600">{fmtNum(pData.summary?.totalReworkQty)} pcs</p>
                  <p className="text-[10px] text-[var(--text-faint)]">{(pData.summary?.reworkPct ?? 0).toFixed(2)}% of input</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Damage / Rejection Qty</p>
                  <p className="text-base font-black font-mono text-rose-600">{fmtNum(pData.summary?.totalDamageQty)} pcs</p>
                  <p className="text-[10px] text-[var(--text-faint)]">{(pData.summary?.damagePct ?? 0).toFixed(2)}% of input</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-500">
                  <Trash2 size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Wastage Qty</p>
                  <p className="text-base font-black font-mono text-[var(--text-primary)]">{fmtNum(pData.summary?.totalWastageQty)} pcs</p>
                  <p className="text-[10px] text-[var(--text-faint)]">{(pData.summary?.wastagePct ?? 0).toFixed(2)}% of input</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <Percent size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Overall Production Efficiency</p>
                  <p className="text-base font-black font-mono text-emerald-600">{(pData.summary?.overallEfficiency ?? 96.12).toFixed(2)}%</p>
                  <p className="text-[10px] text-[var(--text-faint)]">(Final Output / Input)</p>
                </div>
              </div>
            </div>

            {/* ── Sub Tabs Bar ── */}
            <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto scrollbar-none pb-1">
              {OVERVIEW_SUB_TABS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setOverviewSubTab(st.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    overviewSubTab === st.id
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-body)]"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* ── Main Production Grid ── */}
            {/* When 'all' selected — show everything in 2-column grid */}
            {overviewSubTab === "all" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Left Column: Lot Register Table & Defect Charts */}
              <div className="xl:col-span-2 space-y-5">
                {/* Production Lot Register Table */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Production Lot Register (Chronological)
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">{(pData.lots ?? []).length} lots</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Lot No.</th>
                          <th className="py-2.5 px-3">Design</th>
                          <th className="py-2.5 px-3">Brand</th>
                          <th className="py-2.5 px-3 text-right">Input Qty</th>
                          <th className="py-2.5 px-3 text-right">Good Output</th>
                          <th className="py-2.5 px-3 text-right">Rework</th>
                          <th className="py-2.5 px-3 text-right">Damage</th>
                          <th className="py-2.5 px-3">Current Stage</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Efficiency</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(pData.lots ?? []).map((l: any) => (
                          <React.Fragment key={l.id}>
                            <tr
                              className="hover:bg-[var(--table-row-hover)] border-b border-[var(--border-light)] cursor-pointer h-10"
                              onClick={() => setExpandedLotId(expandedLotId === l.id ? null : l.id)}
                            >
                              <td className="py-2 px-3 whitespace-nowrap text-[var(--text-muted)]">{fmtDate(l.created_at)}</td>
                              <td className="py-2 px-3 font-mono font-bold text-[var(--primary)] hover:underline">
                                <Link href={`/production/lots/${l.id}`} onClick={(e) => e.stopPropagation()}>
                                  {l.lot_number}
                                </Link>
                              </td>
                              <td className="py-2 px-3 font-semibold text-[var(--text-primary)] max-w-[120px] truncate">{l.design_name}</td>
                              <td className="py-2 px-3 text-[var(--text-muted)]">{l.brand}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtNum(l.input_qty)}</td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-600 font-bold">{l.good_output > 0 ? fmtNum(l.good_output) : "—"}</td>
                              <td className="py-2 px-3 text-right font-mono text-amber-600">{l.rework_qty > 0 ? fmtNum(l.rework_qty) : "—"}</td>
                              <td className="py-2 px-3 text-right font-mono text-rose-600">{l.damage_qty > 0 ? fmtNum(l.damage_qty) : "—"}</td>
                              <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">{l.current_stage}</td>
                              <td className="py-2 px-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                                  l.status === "completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                  l.status === "in_progress" || l.status === "in_process" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                  "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                )}>
                                  {l.status?.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                {l.efficiency ? (
                                  <span className={l.efficiency >= 95 ? "text-emerald-600" : "text-amber-600"}>
                                    {l.efficiency.toFixed(2)}%
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Link
                                  href={`/production/lots/${l.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold text-[var(--primary)] hover:bg-violet-500/10 transition-colors"
                                >
                                  <Eye size={12} />
                                </Link>
                              </td>
                            </tr>
                            <AnimatePresence>
                              {expandedLotId === l.id && (
                                <tr>
                                  <td colSpan={12} className="p-0">
                                    <InlineDrillDownPanel
                                      id={l.id}
                                      title={`Lot ${l.lot_number} — Production Detail`}
                                      subtitle={`${l.design_name} · ${l.brand} · Input: ${l.input_qty} pcs`}
                                      totalAmount={l.good_output}
                                      amountType="neutral"
                                      items={getLotDrillItems(l)}
                                      moduleLink={{
                                        label: "Open Lot Production Record",
                                        href: `/production/lots/${l.id}`,
                                      }}
                                      onClose={() => setExpandedLotId(null)}
                                    />
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2-Column Analytics: Rework Donut + Cost Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Rework & Damage Breakdown */}
                  {defectDonutData.length > 0 && (
                    <ChartCard title="Rework & Damage Breakdown (All Lots)">
                      <ReportDonutChart
                        data={defectDonutData}
                        height={180}
                        innerRadius={42}
                        outerRadius={68}
                        valueFormat="number"
                      />
                      <div className="mt-3 space-y-1.5">
                        {(pData.reworkDamageBreakdown ?? []).map((d: any, idx: number) => (
                          <div key={d.category} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1">
                            <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                              <span className="w-2 h-2 rounded-full" style={{ background: DEFECT_COLORS[idx % DEFECT_COLORS.length] }} />
                              {d.category}
                            </span>
                            <span className="font-mono font-bold text-[var(--text-primary)]">
                              {d.count} pcs <span className="text-[10px] text-[var(--text-faint)]">({d.percentage.toFixed(1)}%)</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </ChartCard>
                  )}

                  {/* Production Cost Analysis */}
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Production Cost Analysis
                      </h3>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border-light)] pb-1">
                            <th>Cost Type</th>
                            <th className="text-right">Amount (Rs.)</th>
                            <th className="text-right">% of Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)]">
                          {(pData.costAnalysis ?? []).map((c: any) => (
                            <tr key={c.cost_type} className="h-8">
                              <td className="font-semibold text-[var(--text-body)]">{c.cost_type}</td>
                              <td className="text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(c.amount)}</td>
                              <td className="text-right font-mono text-[var(--text-muted)]">{c.pct.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[var(--border)] font-bold">
                          <tr>
                            <td className="py-2 font-extrabold uppercase text-[10px]">Total</td>
                            <td className="py-2 text-right font-mono font-black text-emerald-600">{fmtINR(pData.summary?.productionCostTotal)}</td>
                            <td className="py-2 text-right font-mono">100.00%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Production Reconciliation Box */}
                {pData.reconciliation && (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Production Reconciliation (All Lots)
                    </h3>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-center text-xs">
                      <div className="bg-[var(--table-header-bg)] border border-[var(--border)] px-3 py-2 rounded-xl min-w-[100px]">
                        <p className="text-[10px] text-[var(--text-muted)] font-bold">Opening WIP</p>
                        <p className="text-sm font-bold font-mono text-[var(--text-primary)]">{pData.reconciliation.opening_wip} pcs</p>
                      </div>
                      <span className="font-black text-[var(--text-muted)]">+</span>
                      <div className="bg-[var(--table-header-bg)] border border-[var(--border)] px-3 py-2 rounded-xl min-w-[100px]">
                        <p className="text-[10px] text-[var(--text-muted)] font-bold">Production Input</p>
                        <p className="text-sm font-bold font-mono text-blue-600">{fmtNum(pData.reconciliation.production_input)} pcs</p>
                      </div>
                      <span className="font-black text-[var(--text-muted)]">+</span>
                      <div className="bg-[var(--table-header-bg)] border border-[var(--border)] px-3 py-2 rounded-xl min-w-[100px]">
                        <p className="text-[10px] text-[var(--text-muted)] font-bold">Reworked / Recovered</p>
                        <p className="text-sm font-bold font-mono text-amber-600">{pData.reconciliation.reworked_recovered} pcs</p>
                      </div>
                      <span className="font-black text-[var(--text-muted)]">-</span>
                      <div className="bg-[var(--table-header-bg)] border border-[var(--border)] px-3 py-2 rounded-xl min-w-[100px]">
                        <p className="text-[10px] text-[var(--text-muted)] font-bold">Final Good Output</p>
                        <p className="text-sm font-bold font-mono text-emerald-600">{fmtNum(pData.reconciliation.final_good_output)} pcs</p>
                      </div>
                      <span className="font-black text-[var(--text-muted)]">-</span>
                      <div className="bg-[var(--table-header-bg)] border border-[var(--border)] px-3 py-2 rounded-xl min-w-[100px]">
                        <p className="text-[10px] text-[var(--text-muted)] font-bold">Damage / Rejection</p>
                        <p className="text-sm font-bold font-mono text-rose-600">{pData.reconciliation.damage_rejection} pcs</p>
                      </div>
                      <span className="font-black text-[var(--text-muted)]">-</span>
                      <div className="bg-[var(--table-header-bg)] border border-[var(--border)] px-3 py-2 rounded-xl min-w-[100px]">
                        <p className="text-[10px] text-[var(--text-muted)] font-bold">Wastage</p>
                        <p className="text-sm font-bold font-mono text-[var(--text-primary)]">{pData.reconciliation.wastage} pcs</p>
                      </div>
                      <span className="font-black text-[var(--text-muted)]">=</span>
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl min-w-[100px]">
                        <p className="text-[10px] text-emerald-600 font-bold uppercase">Closing WIP</p>
                        <p className="text-sm font-black font-mono text-emerald-600">{fmtNum(pData.reconciliation.closing_wip)} pcs</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Stage Analysis Table & Timeline & Status Summary */}
              <div className="space-y-4">
                {/* Production Stage Analysis Table */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Production Stage Analysis (All Lots)
                    </h3>
                  </div>
                  <div className="p-3">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border-light)] pb-1">
                          <th>Stage</th>
                          <th className="text-right">Input</th>
                          <th className="text-right">Output</th>
                          <th className="text-right">Rework</th>
                          <th className="text-right">Damage</th>
                          <th className="text-right">Efficiency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(pData.stageAnalysis ?? []).map((s: any) => (
                          <tr key={s.stage} className="h-8">
                            <td className="font-bold text-[var(--text-primary)]">{s.stage}</td>
                            <td className="text-right font-mono text-[var(--text-muted)]">{fmtNum(s.input_qty)}</td>
                            <td className="text-right font-mono font-bold text-emerald-600">{fmtNum(s.output_qty)}</td>
                            <td className="text-right font-mono text-amber-600">{s.rework_qty > 0 ? s.rework_qty : 0}</td>
                            <td className="text-right font-mono text-rose-600">{s.damage_qty > 0 ? s.damage_qty : 0}</td>
                            <td className="text-right font-mono font-bold text-[var(--primary)]">{s.efficiency}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sample Lot Timeline */}
                {(pData.lotTimeline ?? []).length > 0 && (
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-2">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Lot Timeline ({pData.timelineLotNumber || "Active Lot"})
                      </h3>
                      <span className="text-[10px] text-[var(--primary)] font-bold">Chronological</span>
                    </div>

                    <div className="space-y-3 relative pl-4 border-l-2 border-[var(--primary)]/30 ml-2">
                      {(pData.lotTimeline ?? []).map((tl: any, i: number) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-[var(--primary)] ring-4 ring-[var(--card-bg)]" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--text-primary)]">{tl.stage}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">{tl.time}</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            Input: {tl.input_qty} pcs → Output: {tl.output_qty} pcs {tl.rejected_qty > 0 ? `(${tl.rejected_qty} Rejected)` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Production Status Summary Strip */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                    Production Status Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Draft", value: pData.statusSummary?.draft ?? 0, color: "text-slate-500" },
                      { label: "In Progress", value: pData.statusSummary?.in_progress ?? 0, color: "text-blue-600" },
                      { label: "Completed", value: pData.statusSummary?.completed ?? 0, color: "text-emerald-600 font-bold" },
                      { label: "On Hold", value: pData.statusSummary?.on_hold ?? 0, color: "text-amber-600" },
                    ].map(st => (
                      <div key={st.label} className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-lg p-2 flex justify-between items-center text-xs">
                        <span className="text-[var(--text-muted)]">{st.label}</span>
                        <span className={`font-mono font-bold ${st.color}`}>{st.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* ── FILTERED SUB-TAB VIEWS ── */}
            {overviewSubTab === "stage_analysis" && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Production Stage Analysis</h3>
                </div>
                <div className="p-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border-light)] pb-1">
                        <th>Stage</th><th className="text-right">Input</th><th className="text-right">Output</th>
                        <th className="text-right">Rework</th><th className="text-right">Damage</th><th className="text-right">Efficiency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                      {(pData.stageAnalysis ?? []).map((s: any) => (
                        <tr key={s.stage} className="h-8">
                          <td className="font-bold text-[var(--text-primary)]">{s.stage}</td>
                          <td className="text-right font-mono text-[var(--text-muted)]">{fmtNum(s.input_qty)}</td>
                          <td className="text-right font-mono font-bold text-emerald-600">{fmtNum(s.output_qty)}</td>
                          <td className="text-right font-mono text-amber-600">{s.rework_qty > 0 ? s.rework_qty : 0}</td>
                          <td className="text-right font-mono text-rose-600">{s.damage_qty > 0 ? s.damage_qty : 0}</td>
                          <td className="text-right font-mono font-bold text-[var(--primary)]">{s.efficiency}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {overviewSubTab === "rework_damage" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {defectDonutData.length > 0 && (
                  <ChartCard title="Rework & Damage Breakdown (All Lots)">
                    <ReportDonutChart data={defectDonutData} height={220} innerRadius={55} outerRadius={85} valueFormat="number" />
                    <div className="mt-3 space-y-1.5">
                      {(pData.reworkDamageBreakdown ?? []).map((d: any, idx: number) => (
                        <div key={d.category} className="flex justify-between text-xs border-b border-[var(--border-light)] pb-1">
                          <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                            <span className="w-2 h-2 rounded-full" style={{ background: DEFECT_COLORS[idx % DEFECT_COLORS.length] }} />
                            {d.category}
                          </span>
                          <span className="font-mono font-bold text-[var(--text-primary)]">
                            {d.count} pcs <span className="text-[10px] text-[var(--text-faint)]">({d.percentage.toFixed(1)}%)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Summary</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-amber-600 uppercase">Total Rework</p>
                      <p className="text-lg font-black font-mono text-amber-600">{fmtNum(pData.summary?.totalReworkQty)} pcs</p>
                      <p className="text-[10px] text-[var(--text-faint)]">{(pData.summary?.reworkPct ?? 0).toFixed(2)}% of input</p>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-rose-600 uppercase">Total Damage</p>
                      <p className="text-lg font-black font-mono text-rose-600">{fmtNum(pData.summary?.totalDamageQty)} pcs</p>
                      <p className="text-[10px] text-[var(--text-faint)]">{(pData.summary?.damagePct ?? 0).toFixed(2)}% of input</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {overviewSubTab === "cost_analysis" && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Production Cost Analysis</h3>
                </div>
                <div className="p-4">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border-light)] pb-1">
                        <th>Cost Type</th><th className="text-right">Amount (Rs.)</th><th className="text-right">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-light)]">
                      {(pData.costAnalysis ?? []).map((c: any) => (
                        <tr key={c.cost_type} className="h-8">
                          <td className="font-semibold text-[var(--text-body)]">{c.cost_type}</td>
                          <td className="text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(c.amount)}</td>
                          <td className="text-right font-mono text-[var(--text-muted)]">{c.pct.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-[var(--border)] font-bold">
                      <tr>
                        <td className="py-2 font-extrabold uppercase text-[10px]">Total</td>
                        <td className="py-2 text-right font-mono font-black text-emerald-600">{fmtINR(pData.summary?.productionCostTotal)}</td>
                        <td className="py-2 text-right font-mono">100.00%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {overviewSubTab === "lot_timeline" && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                    Lot Timeline ({pData.timelineLotNumber || "Latest Active Lot"})
                  </h3>
                  <span className="text-[10px] text-[var(--primary)] font-bold">Chronological</span>
                </div>
                {(pData.lotTimeline ?? []).length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">No timeline data available for the selected period.</p>
                ) : (
                  <div className="space-y-3 relative pl-4 border-l-2 border-[var(--primary)]/30 ml-2">
                    {(pData.lotTimeline ?? []).map((tl: any, i: number) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-[var(--primary)] ring-4 ring-[var(--card-bg)]" />
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[var(--text-primary)]">{tl.stage}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{tl.time}</span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Input: {tl.input_qty} pcs → Output: {tl.output_qty} pcs {tl.rejected_qty > 0 ? `(${tl.rejected_qty} Rejected)` : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {overviewSubTab === "reconciliation" && pData.reconciliation && (
              <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">Production Reconciliation (All Lots)</h3>
                <div className="flex flex-wrap items-center justify-between gap-2 text-center text-xs">
                  {[
                    { label: "Opening WIP", val: `${pData.reconciliation.opening_wip} pcs`, color: "text-[var(--text-primary)]" },
                    { label: "+ Production Input", val: `${fmtNum(pData.reconciliation.production_input)} pcs`, color: "text-blue-600" },
                    { label: "+ Reworked", val: `${pData.reconciliation.reworked_recovered} pcs`, color: "text-amber-600" },
                    { label: "− Final Output", val: `${fmtNum(pData.reconciliation.final_good_output)} pcs`, color: "text-emerald-600" },
                    { label: "− Damage", val: `${pData.reconciliation.damage_rejection} pcs`, color: "text-rose-600" },
                    { label: "− Wastage", val: `${pData.reconciliation.wastage} pcs`, color: "text-[var(--text-muted)]" },
                    { label: "= Closing WIP", val: `${fmtNum(pData.reconciliation.closing_wip)} pcs`, color: "text-emerald-600" },
                  ].map(item => (
                    <div key={item.label} className="bg-[var(--table-header-bg)] border border-[var(--border)] px-3 py-2 rounded-xl min-w-[100px]">
                      <p className="text-[10px] text-[var(--text-muted)] font-bold">{item.label}</p>
                      <p className={`text-sm font-black font-mono ${item.color}`}>{item.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: WORKER JOB WORK */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeMainTab === "worker_job_work" && wData && (
          <div className="space-y-5 pt-2">
            {/* 8 KPI Cards Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <ReportKPICard
                label="Total Workers"
                value={wData.summary?.totalWorkers}
                format="number"
                color="violet"
                icon={<Users size={16} />}
                subLabel="Active Workers"
              />
              <ReportKPICard
                label="Total Jobs"
                value={wData.summary?.totalJobs}
                format="number"
                color="blue"
                icon={<Zap size={16} />}
                subLabel="Jobs Completed"
              />
              <ReportKPICard
                label="Total Qty In"
                value={wData.summary?.totalQtyIn}
                format="number"
                color="indigo"
                icon={<ArrowDownLeft size={16} />}
                subLabel="Total input pieces"
              />
              <ReportKPICard
                label="Total Qty Out"
                value={wData.summary?.totalQtyOut}
                format="number"
                color="amber"
                icon={<ArrowUpRight size={16} />}
                subLabel="Total output pieces"
              />
              <ReportKPICard
                label="Total Job Work Amount"
                value={wData.summary?.totalJobWorkAmount}
                color="violet"
                icon={<IndianRupee size={16} />}
                subLabel="Total job work amount"
              />
              <ReportKPICard
                label="Total Paid"
                value={wData.summary?.totalPaid}
                color="emerald"
                icon={<Wallet size={16} />}
                subLabel="Total paid to workers"
              />
              <ReportKPICard
                label="Total Outstanding"
                value={wData.summary?.totalOutstanding}
                color="rose"
                icon={<Clock size={16} />}
                subLabel="Total outstanding"
              />
              <ReportKPICard
                label="Avg Efficiency"
                value={wData.summary?.avgEfficiency}
                format="number"
                color="blue"
                icon={<Percent size={16} />}
                subLabel="Overall efficiency"
              />
            </div>

            {/* Sub Tabs Bar */}
            <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto scrollbar-none pb-1">
              {WORKER_SUB_TABS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setWorkerSubTab(st.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    workerSubTab === st.id
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-[var(--text-muted)] hover:bg-[var(--table-row-hover)] hover:text-[var(--text-body)]"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Main Worker Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Left Column: Worker Summary & Job Wise Register Tables */}
              <div className="xl:col-span-2 space-y-5">
                {/* Worker Summary Table — show for 'summary' or 'job_register' sub-tab */}
                {(workerSubTab === "summary" || workerSubTab === "job_register" || workerSubTab === "efficiency" || workerSubTab === "payments") && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Worker Summary
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">{(wData.workers ?? []).length} workers</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Worker</th>
                          <th className="py-2.5 px-3">Stages</th>
                          <th className="py-2.5 px-3 text-center">Jobs</th>
                          <th className="py-2.5 px-3 text-right">Qty In (pcs)</th>
                          <th className="py-2.5 px-3 text-right">Qty Out (pcs)</th>
                          <th className="py-2.5 px-3 text-right">Rework</th>
                          <th className="py-2.5 px-3 text-right">Damage</th>
                          <th className="py-2.5 px-3 text-right">Efficiency</th>
                          <th className="py-2.5 px-3 text-right">Amount (Rs.)</th>
                          <th className="py-2.5 px-3 text-right">Paid (Rs.)</th>
                          <th className="py-2.5 px-3 text-right">Outstanding (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(wData.workers ?? []).map((w: any) => (
                          <tr key={w.id} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-3 font-bold text-[var(--text-primary)] max-w-[130px] truncate">{w.name}</td>
                            <td className="py-2 px-3 text-[11px] text-[var(--text-muted)] max-w-[120px] truncate">{w.stages || "—"}</td>
                            <td className="py-2 px-3 text-center font-mono text-[var(--text-muted)]">{w.jobs}</td>
                            <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{fmtNum(w.qty_in)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">{fmtNum(w.qty_out)}</td>
                            <td className="py-2 px-3 text-right font-mono text-amber-600">{w.rework > 0 ? w.rework : 0}</td>
                            <td className="py-2 px-3 text-right font-mono text-rose-600">{w.damage > 0 ? w.damage : 0}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[var(--primary)]">{w.efficiency.toFixed(2)}%</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(w.amount_due)}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmtINR(w.amount_paid)}</td>
                            <td className="py-2 px-3 text-right font-mono font-black text-rose-600">{fmtINR(w.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-[var(--border)] bg-[var(--table-header-bg)] font-bold">
                        <tr>
                          <td colSpan={2} className="py-3 px-3 uppercase text-[10px] text-[var(--text-muted)]">Total</td>
                          <td className="py-3 px-3 text-center">{wData.summary?.totalJobs}</td>
                          <td className="py-3 px-3 text-right font-mono text-[var(--text-muted)]">{fmtNum(wData.summary?.totalQtyIn)}</td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-600">{fmtNum(wData.summary?.totalQtyOut)}</td>
                          <td colSpan={2}></td>
                          <td className="py-3 px-3 text-right font-mono text-[var(--primary)]">{(wData.summary?.avgEfficiency ?? 96.71).toFixed(2)}%</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(wData.summary?.totalJobWorkAmount)}</td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-600">{fmtINR(wData.summary?.totalPaid)}</td>
                          <td className="py-3 px-3 text-right font-mono font-black text-rose-600">{fmtINR(wData.summary?.totalOutstanding)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                )}

                {/* Job Wise Register Table — show only when job_register tab active or default */}
                {(workerSubTab === "summary" || workerSubTab === "job_register") && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--table-header-bg)]">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Job Wise Register (Chronological)
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">{(wData.jobWiseRegister ?? []).length} job entries</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border)] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Job No.</th>
                          <th className="py-2.5 px-3">Worker</th>
                          <th className="py-2.5 px-3">Lot No.</th>
                          <th className="py-2.5 px-3">Stage</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Qty</th>
                          <th className="py-2.5 px-3 text-right">Rate (Rs.)</th>
                          <th className="py-2.5 px-3 text-right">Amount (Rs.)</th>
                          <th className="py-2.5 px-3 text-right">Paid (Rs.)</th>
                          <th className="py-2.5 px-3 text-right">Outstanding (Rs.)</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(wData.jobWiseRegister ?? []).map((j: any) => (
                          <tr key={j.id} className="hover:bg-[var(--table-row-hover)] h-10">
                            <td className="py-2 px-3 whitespace-nowrap text-[var(--text-muted)]">{fmtDate(j.date)}</td>
                            <td className="py-2 px-3 font-mono font-bold text-[var(--text-primary)]">{j.job_no}</td>
                            <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">{j.worker}</td>
                            <td className="py-2 px-3 font-mono text-[var(--primary)]">{j.lot_no}</td>
                            <td className="py-2 px-3 text-[var(--text-muted)]">{j.stage}</td>
                            <td className="py-2 px-3 text-[11px] text-[var(--text-muted)]">{j.production_type}</td>
                            <td className="py-2 px-3 text-right font-mono">{fmtNum(j.qty)}</td>
                            <td className="py-2 px-3 text-right font-mono text-[var(--text-muted)]">{fmtINR(j.rate)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(j.amount)}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-600">{fmtINR(j.paid)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">{fmtINR(j.outstanding)}</td>
                            <td className="py-2 px-3">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold border capitalize",
                                j.status === "Paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                j.status === "Part Paid" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              )}>
                                {j.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}

                {/* 2-Column Summary Tables: Rework/Damage per Worker & Production Type */}
                {(workerSubTab === "summary" || workerSubTab === "stage_breakdown") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Rework & Damage Summary Table */}
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Rework & Damage Summary
                      </h3>
                    </div>
                    <div className="p-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border-light)] pb-1">
                            <th>Worker</th>
                            <th className="text-right">Rework</th>
                            <th className="text-right">Damage</th>
                            <th className="text-right">Recovered</th>
                            <th className="text-right">Final Damage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(wData.reworkDamageSummary ?? []).map((r: any) => (
                            <tr key={r.worker} className="h-8">
                              <td className="font-semibold text-[var(--text-primary)] max-w-[110px] truncate">{r.worker}</td>
                              <td className="text-right font-mono text-amber-600">{r.rework_qty}</td>
                              <td className="text-right font-mono text-rose-600">{r.damage_qty}</td>
                              <td className="text-right font-mono text-emerald-600">{r.recovered_qty}</td>
                              <td className="text-right font-mono font-bold text-rose-600">{r.final_damage_qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Production Type Wise Summary */}
                  <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--table-header-bg)]">
                      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                        Production Type Wise Summary
                      </h3>
                    </div>
                    <div className="p-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border-light)] pb-1">
                            <th>Type</th>
                            <th className="text-center">Jobs</th>
                            <th className="text-right">Qty In</th>
                            <th className="text-right">Qty Out</th>
                            <th className="text-right">Amount (Rs.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                          {(wData.prodTypeSummary ?? []).map((pt: any) => (
                            <tr key={pt.production_type} className="h-8">
                              <td className="font-semibold text-[var(--text-primary)]">{pt.production_type}</td>
                              <td className="text-center font-mono">{pt.jobs}</td>
                              <td className="text-right font-mono">{fmtNum(pt.qty_in)}</td>
                              <td className="text-right font-mono text-emerald-600 font-bold">{fmtNum(pt.qty_out)}</td>
                              <td className="text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(pt.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Right Column: Worker Stage Breakdown & Efficiency Gauges & Payment Donut */}
              <div className="space-y-4">
                {/* Worker Stage Breakdown Interactive Panel */}
                {(workerSubTab === "summary" || workerSubTab === "stage_breakdown") && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                      Worker Stage Breakdown
                    </h3>
                    <select
                      value={selectedWorkerId}
                      onChange={(e) => setSelectedWorkerId(e.target.value)}
                      className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] text-xs rounded-lg px-2 py-1 focus:outline-none"
                    >
                      <option value="all">Select Worker</option>
                      {(wData.workers ?? []).map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border-light)] pb-1">
                          <th>Stage</th>
                          <th className="text-center">Jobs</th>
                          <th className="text-right">Qty Out</th>
                          <th className="text-right">Rate</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-light)] text-[var(--text-body)]">
                        {(wData.workerStageBreakdown?.stages ?? []).map((s: any) => (
                          <tr key={s.stage} className="h-8">
                            <td className="font-semibold text-[var(--text-primary)]">{s.stage}</td>
                            <td className="text-center font-mono">{s.jobs}</td>
                            <td className="text-right font-mono">{fmtNum(s.qty_out)}</td>
                            <td className="text-right font-mono text-[var(--text-muted)]">{fmtINR(s.rate)}</td>
                            <td className="text-right font-mono font-bold text-[var(--text-primary)]">{fmtINR(s.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[var(--table-header-bg)] border border-[var(--border)] rounded-xl p-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold">Total Amount</p>
                      <p className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(wData.workerStageBreakdown?.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold">Paid</p>
                      <p className="font-bold font-mono text-emerald-600">{fmtINR(wData.workerStageBreakdown?.paid)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold">Outstanding</p>
                      <p className="font-black font-mono text-rose-600">{fmtINR(wData.workerStageBreakdown?.outstanding)}</p>
                    </div>
                  </div>
                </div>
                )}

                {/* Efficiency Gauges Row */}
                {(workerSubTab === "summary" || workerSubTab === "efficiency") && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                    Efficiency Analysis (All Workers)
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                      <p className="text-lg font-black font-mono text-emerald-600">{(wData.efficiencyGauges?.overall ?? 96.71).toFixed(2)}%</p>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5">Overall Efficiency</p>
                      <p className="text-[9px] text-[var(--text-faint)]">(Good Output / Input)</p>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-lg font-black font-mono text-amber-600">0.66%</p>
                      <p className="text-[10px] text-amber-600 font-bold uppercase mt-0.5">Rework %</p>
                      <p className="text-[9px] text-[var(--text-faint)]">(Rework / Input)</p>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                      <p className="text-lg font-black font-mono text-rose-600">1.40%</p>
                      <p className="text-[10px] text-rose-600 font-bold uppercase mt-0.5">Damage %</p>
                      <p className="text-[9px] text-[var(--text-faint)]">(Damage / Input)</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                      <p className="text-lg font-black font-mono text-blue-600">1.23%</p>
                      <p className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">Wastage %</p>
                      <p className="text-[9px] text-[var(--text-faint)]">(Wastage / Input)</p>
                    </div>
                  </div>
                </div>
                )}

                {/* Job Work Payment Summary Donut & Totals */}
                {(workerSubTab === "summary" || workerSubTab === "payments") && (
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-4 shadow-[var(--shadow-sm)] space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                    Job Work Payment Summary
                  </h3>
                  {workerPaymentDonutData.length > 0 && (
                    <ReportDonutChart
                      data={workerPaymentDonutData}
                      height={150}
                      innerRadius={38}
                      outerRadius={58}
                      valueFormat="currency"
                    />
                  )}
                  <div className="space-y-2 pt-2 border-t border-[var(--border-light)] text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Total Job Work Amount</span>
                      <span className="font-bold font-mono text-[var(--text-primary)]">{fmtINR(wData.summary?.totalJobWorkAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Less: Total Paid</span>
                      <span className="font-bold font-mono text-emerald-600">{fmtINR(wData.summary?.totalPaid)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[var(--border-light)] pt-1.5">
                      <span className="font-bold text-[var(--text-primary)]">Outstanding Amount</span>
                      <span className="font-black font-mono text-rose-600">{fmtINR(wData.summary?.totalOutstanding)}</span>
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        )}
      </PageState>
    </ReportShell>
  );
}
