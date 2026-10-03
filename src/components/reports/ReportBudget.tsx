"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store";
import ReportTable from "./ReportTable";
import { fmtINR } from "@/lib/report-export";

export default function ReportBudget({ data, from, to }: { data: any; from: string; to: string }) {
  const company = useAppStore(s => s.selectedBusinessId || s.user?.businessId), user = useAppStore(s => s.user?.id);
  const key = `report-budget:${company}:${user}:${from}:${to}`;
  const [expanded, setExpanded] = useState(false), [targets, setTargets] = useState<Record<string, number>>({}), [salesChange, setSalesChange] = useState(0), [costChange, setCostChange] = useState(0);
  useEffect(() => { setTargets({}); setSalesChange(0); setCostChange(0); try { const value = JSON.parse(localStorage.getItem(key) || "{}"); if (value && typeof value === "object" && !Array.isArray(value)) setTargets(Object.fromEntries(Object.entries(value).filter(([,v]) => typeof v === "number" && Number.isFinite(v))) as Record<string, number>); } catch { /* Budgets are optional private assumptions. */ } }, [key]);
  const metrics = [{ key: "revenue", label: "Net revenue", actual: Number(data.revenue?.total || 0) }, { key: "cogs", label: "Cost of goods sold", actual: Number(data.cogs?.total || 0) }, { key: "operating", label: "Operating expenses", actual: Number(data.operating_expenses?.total || 0) }, { key: "profit", label: "Net profit", actual: Number(data.net_profit || 0) }];
  const update = (metric: string, value: string) => { const next = { ...targets }; if (!value.trim()) delete next[metric]; else { const amount = Number(value); if (!Number.isFinite(amount)) return; next[metric] = amount; } setTargets(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Still usable without storage. */ } };
  const projectedProfit = Number(data.net_profit || 0) + metrics[0].actual * salesChange / 100 - metrics[1].actual * costChange / 100;
  return <section className="border border-[var(--border)] rounded-xl bg-[var(--card-bg)] p-3 min-w-0">
    <button type="button" className="min-h-11 text-sm font-semibold text-[var(--text-primary)]" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>Budget vs actual & profit scenario {expanded ? "−" : "+"}</button>
    {expanded && <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">Private targets on this device for {from} to {to}. Actuals follow this preliminary P&amp;L. Scenarios hold all other costs constant and do not represent forecasts or posted budgets.</p>
      <ReportTable className="w-full text-xs"><thead><tr><th>Metric</th><th>Actual</th><th>Target</th><th>Actual − Target</th><th>Variance %</th></tr></thead><tbody>{metrics.map(m => <tr key={m.key}><td>{m.label}</td><td>{fmtINR(m.actual)}</td><td><input type="number" step="0.01" aria-label={`${m.label} target`} value={targets[m.key] ?? ""} onChange={e => update(m.key, e.target.value)} className="w-32 min-h-11 max-w-full px-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-lg" /></td><td>{targets[m.key] == null ? "No target" : fmtINR(m.actual - targets[m.key])}</td><td>{targets[m.key] ? `${((m.actual - targets[m.key]) / Math.abs(targets[m.key]) * 100).toFixed(1)}%` : "Not available"}</td></tr>)}</tbody></ReportTable>
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-body)]"><label>Assumed revenue change % <input type="number" min={-100} max={1000} value={salesChange} onChange={e => setSalesChange(Math.min(1000,Math.max(-100,Number(e.target.value)||0)))} className="w-20 min-h-11 px-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-lg" /></label><label>Assumed COGS change % <input type="number" min={-100} max={1000} value={costChange} onChange={e => setCostChange(Math.min(1000,Math.max(-100,Number(e.target.value)||0)))} className="w-20 min-h-11 px-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-lg" /></label><strong>Scenario net profit: {fmtINR(projectedProfit)}</strong></div>
    </div>}
  </section>;
}
