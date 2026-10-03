"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/store";
import ReportTable from "./ReportTable";
import { fmtINR, fmtDate } from "@/lib/report-export";

/** A user-entered scenario never updates invoice/payment records or claims a commitment. */
export default function PaymentPlanner({ rows, direction, cutoff, balance }: { rows: any[]; direction: "received" | "paid"; cutoff: string; balance: number }) {
  const company = useAppStore(s => s.selectedBusinessId || s.user?.businessId), user = useAppStore(s => s.user?.id);
  const key = `report-plan:${company}:${user}:${direction}`;
  const [expanded, setExpanded] = useState(false), [plan, setPlan] = useState<Record<string, { date: string; percentage: number }>>({});
  useEffect(() => { setPlan({}); try { const value = JSON.parse(localStorage.getItem(key) || "{}"); if (value && typeof value === "object" && !Array.isArray(value)) setPlan(value); } catch { /* Invalid scenario preferences do not affect report records. */ } }, [key]);
  const update = (id: string, date: string, percentage: number) => { const next = { ...plan, [id]: { date, percentage: Math.min(100, Math.max(0, percentage || 0)) } }; setPlan(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Scenario remains usable without storage. */ } };
  const scheduled = rows.filter(r => plan[r.id]?.date && /^\d{4}-\d{2}-\d{2}$/.test(plan[r.id].date));
  const total = scheduled.reduce((sum, r) => sum + Number(r.outstanding || 0) * Math.min(100, Math.max(0, Number(plan[r.id].percentage) || 0)) / 100, 0);
  return <section className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-3 min-w-0">
    <button type="button" className="min-h-11 text-sm font-semibold text-[var(--text-primary)]" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{direction === "received" ? "Collection" : "Payment"} planner · Scenario {expanded ? "−" : "+"}</button>
    {expanded && <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">Invoice residuals at {fmtDate(cutoff)}. Enter an expected date and percentage for a private scenario on this device. These are assumptions, not recorded commitments; advances and other cash movements are excluded.</p>
      <div className="flex flex-wrap gap-3 text-xs"><span>Planned amount: <strong>{fmtINR(total)}</strong></span><span>Cash/bank after this scenario: <strong>{fmtINR(Number(balance || 0) + (direction === "received" ? total : -total))}</strong></span></div>
      <ReportTable className="payment-planner-register w-full text-xs"><thead><tr>{["Invoice", "Party", "Due Date", "Outstanding", "Expected Date", "Expected %", "Scenario Amount"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.number}</td><td>{r.party}</td><td>{fmtDate(r.due_date)}</td><td>{fmtINR(r.outstanding)}</td><td><input type="date" aria-label={`Expected date for ${r.number}`} value={plan[r.id]?.date || ""} onChange={e => update(r.id, e.target.value, plan[r.id]?.percentage ?? 100)} className="min-h-11 max-w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg p-2" /></td><td><input type="number" min={0} max={100} aria-label={`Expected percentage for ${r.number}`} value={plan[r.id]?.percentage ?? 100} onChange={e => update(r.id, plan[r.id]?.date || "", Number(e.target.value))} className="min-h-11 w-20 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg p-2" /></td><td>{plan[r.id]?.date ? fmtINR(Number(r.outstanding || 0) * Math.min(100, Math.max(0, Number(plan[r.id]?.percentage) || 0)) / 100) : "Unscheduled"}</td></tr>)}</tbody></ReportTable>
    </div>}
  </section>;
}
