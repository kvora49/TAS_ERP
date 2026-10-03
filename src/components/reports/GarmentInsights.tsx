"use client";
import { useState } from "react";
import Link from "next/link";
import ReportTable from "./ReportTable";
import ReportTabs from "./ReportTabs";
import { fmtINR, fmtNum, fmtDate } from "@/lib/report-export";

export default function GarmentInsights({ data, from, to, billType }: { data: any; from: string; to: string; billType: string }) {
  const scope = new URLSearchParams({ from, to, bill_type: billType }).toString();
  const [tab, setTab] = useState("designs");
  const tabs = [{ id: "designs", label: "Design contribution" }, { id: "variants", label: "Size / colour demand" }, { id: "lots", label: "Lot aging & labour" }, { id: "suppliers", label: "Supplier performance" }];
  return <section className="border border-[var(--border)] rounded-xl bg-[var(--card-bg)] min-w-0">
    <h2 className="p-4 text-sm font-semibold text-[var(--text-primary)]">Garment insights</h2>
    <ReportTabs tabs={tabs} activeTab={tab} onChange={setTab} />
    <p className="p-3 text-xs text-[var(--text-muted)]">{data.basis?.[tab]}</p>
    {tab === "designs" && <ReportTable className="w-full text-xs"><thead><tr>{["Design", "Quantity", "Item Revenue", "Recorded Cost", "Contribution", "Missing Cost Lines", "Source"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{(data.designs || []).map((d: any) => <tr key={d.design_id}><td>{d.design_number} · {d.design_name}</td><td>{fmtNum(d.quantity)}</td><td>{fmtINR(d.revenue)}</td><td>{fmtINR(d.recorded_cost)}</td><td>{d.contribution == null ? "Not available" : fmtINR(d.contribution)}</td><td>{d.missing_cost_lines}</td><td><Link className="text-[var(--primary)]" href={`/reports/sales?${scope}&tab=${billType}&design_id=${d.design_id}`}>Sales sources</Link></td></tr>)}</tbody></ReportTable>}
    {tab === "variants" && <ReportTable className="w-full text-xs"><thead><tr>{["Design", "Colour", "Size", "Period Sales Qty", "Current Stock Qty", "Assumed Cover Days"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{(data.variants || []).map((d: any, i: number) => <tr key={i}><td>{d.design_number} · {d.design}</td><td>{d.colour}</td><td>{d.size}</td><td>{fmtNum(d.sold_quantity)}</td><td>{fmtNum(d.stock_quantity)}</td><td>{d.cover_days == null ? "No observed demand" : fmtNum(d.cover_days)}</td></tr>)}</tbody></ReportTable>}
    {tab === "lots" && <ReportTable className="w-full text-xs"><thead><tr>{["Lot", "Current Status", "Last Activity", "Waiting Days", "Days Past Target", "Recorded Labour", "Source"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{(data.lots || []).map((l: any) => <tr key={l.id}><td>{l.lot_number}</td><td>{l.status}</td><td>{l.last_activity ? fmtDate(l.last_activity) : "No stage entry"}</td><td>{l.waiting_days}</td><td>{l.days_past_target == null ? "No target" : Math.max(0,l.days_past_target)}</td><td>{fmtINR(l.recorded_labour)}</td><td><Link className="text-[var(--primary)]" href={`/production/lots/${l.id}`}>Open lot</Link></td></tr>)}</tbody></ReportTable>}
    {tab === "suppliers" && <ReportTable className="w-full text-xs"><thead><tr>{["Supplier", "Invoices", "Purchases", "Returns", "Avg Recorded Delivery Days", "Source"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{(data.suppliers || []).map((s: any) => <tr key={s.supplier_id}><td>{s.name}</td><td>{s.invoice_count}</td><td>{fmtINR(s.purchases)}</td><td>{fmtINR(s.returns)}</td><td>{s.recorded_delivery_days == null ? "Not recorded" : fmtNum(s.recorded_delivery_days)}</td><td><Link className="text-[var(--primary)]" href={`/reports/purchases?${scope}&tab=raw&party_id=${s.supplier_id}`}>Purchase sources</Link></td></tr>)}</tbody></ReportTable>}
  </section>;
}
