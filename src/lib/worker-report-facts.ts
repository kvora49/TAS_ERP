type Row = Record<string, any>;
const n = (v: unknown) => Number(v || 0);
const one = (v: any): any => Array.isArray(v) ? v[0] : v;

export function workerReportFacts(entries: Row[], workers: Row[], parties: Row[], defects: Row[], resolutions: Row[], futureAllocations: Row[], selectedWorker?: string | null) {
  const names = new Map<string, Row>([...parties.map(p => [p.id, { name: p.company_name || p.name, code: p.code || "—" }] as [string, Row]), ...workers.map(w => [w.id, { name: w.name, code: w.worker_id || "—" }] as [string, Row])]);
  const rollback = new Map<string, number>();
  for (const a of futureAllocations) { const id = a.stage_entry_id || a.bill_id; rollback.set(id, (rollback.get(id) || 0) + n(a.amount_applied ?? a.allocated_amount)); }
  const defectsByWorker = new Map<string, { rework: number; damage: number; recovered: number; final_damage: number }>();
  const defectWorkers = new Map(defects.map(d => [d.id, d.responsible_worker_id || "unknown"]));
  for (const d of defects) {
    const id = d.responsible_worker_id || "unknown", value = defectsByWorker.get(id) || { rework: 0, damage: 0, recovered: 0, final_damage: 0 };
    value[["sent_for_rework", "reworked_fixed"].includes(d.status) ? "rework" : "damage"] += n(d.quantity); defectsByWorker.set(id, value);
  }
  for (const r of resolutions) {
    const id = defectWorkers.get(r.defect_id); if (!id) continue;
    const value = defectsByWorker.get(id)!; value.recovered += n(r.qty_recovered); value.final_damage += n(r.qty_scrapped) + n(r.qty_b_grade);
  }
  const map = new Map<string, Row>();
  const register = entries.map(e => {
    const id = e.worker_id || "unknown", name = names.get(id), stage = one(e.lot_stage), quantity = n(e.qty_out), input = n(e.qty_in), rate = n(e.job_work_rate), amount = n(e.total_job_work_amount ?? e.total_labor_cost), paid = Math.max(0, n(e.paid_amount) - (rollback.get(e.id) || 0));
    const value = map.get(id) || { id, name: name?.name || "Unassigned worker", code: name?.code || "—", jobs: 0, qty_in: 0, qty_out: 0, amount_due: 0, amount_paid: 0, stageDetails: {}, ...(defectsByWorker.get(id) || { rework: 0, damage: 0, recovered: 0, final_damage: 0 }) };
    value.jobs++; value.qty_in += input; value.qty_out += quantity; value.amount_due += amount; value.amount_paid += paid;
    const stageName = stage?.stage_name || "Unassigned stage";
    const detail = value.stageDetails[stageName] || { jobs: 0, qty_in: 0, qty_out: 0, amount: 0 };
    detail.jobs++; detail.qty_in += input; detail.qty_out += quantity; detail.amount += amount; value.stageDetails[stageName] = detail; map.set(id, value);
    return { id: e.id, date: e.entry_date, job_no: e.entry_number || e.id, worker: value.name, worker_id: e.worker_id, lot_no: one(stage?.lot)?.lot_number || "Not recorded", lot_id: stage?.lot_id, stage: stageName, production_type: "Recorded stage job", qty: quantity, rate, amount, paid, outstanding: Math.max(0, amount - paid), status: paid >= amount && amount > 0 ? "Paid" : paid > 0 ? "Part Paid" : "Unpaid", view_url: "/production/stage-entries" };
  });
  const resultWorkers = Array.from(map.values()).map((w): Row => ({ ...w, stages: Object.keys(w.stageDetails).join(", "), outstanding: Math.max(0, w.amount_due - w.amount_paid), efficiency: w.qty_in ? w.qty_out / w.qty_in * 100 : null })).sort((a, b) => b.amount_due - a.amount_due);
  const sum = (field: string) => resultWorkers.reduce((s, w) => s + n(w[field]), 0);
  const input = sum("qty_in"), output = sum("qty_out"), amount = sum("amount_due"), paid = sum("amount_paid"), active = selectedWorker && selectedWorker !== "all" ? map.get(selectedWorker) : resultWorkers[0];
  const breakdown = active ? Object.entries(active.stageDetails).map(([stage, raw]) => { const d = raw as Row; return { stage, ...d, rate: d.qty_out ? d.amount / d.qty_out : null, efficiency: d.qty_in ? (d.qty_out / d.qty_in * 100).toFixed(2) : null }; }) : [];
  return {
    summary: { totalWorkers: resultWorkers.length, totalJobs: entries.length, totalQtyIn: input, totalQtyOut: output, totalJobWorkAmount: amount, totalPaid: paid, totalOutstanding: sum("outstanding"), avgEfficiency: input ? output / input * 100 : null, paidPct: amount ? paid / amount * 100 : 0, outstandingPct: amount ? sum("outstanding") / amount * 100 : 0 },
    workers: resultWorkers, jobWiseRegister: register,
    workerStageBreakdown: { worker_name: active?.name || "No worker selected", worker_id: active?.id, stages: breakdown, total_amount: active?.amount_due || 0, paid: active?.amount_paid || 0, outstanding: Math.max(0, (active?.amount_due || 0) - (active?.amount_paid || 0)) },
    reworkDamageSummary: resultWorkers.map(w => ({ worker: w.name, rework_qty: w.rework, damage_qty: w.damage, recovered_qty: w.recovered, final_damage_qty: w.final_damage })),
    prodTypeSummary: [{ production_type: "Recorded stage jobs (outside classification unavailable)", jobs: entries.length, qty_in: input, qty_out: output, amount }],
    efficiencyGauges: { overall: input ? output / input * 100 : null, rework_pct: input ? sum("rework") / input * 100 : null, damage_pct: input ? sum("damage") / input * 100 : null, wastage_pct: input ? entries.reduce((s, e) => s + n(e.wastage_qty), 0) / input * 100 : null },
    metadata: { note: "Paid totals are allocations against selected stage jobs as of cutoff. Do not add payment vouchers again. Recovery uses recorded resolution outcomes; throughput is not final garment output." },
  };
}
