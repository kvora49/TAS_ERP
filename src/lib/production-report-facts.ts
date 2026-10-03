type Row = Record<string, any>;
const n = (v: unknown) => Number(v || 0);
const one = (v: any): any => Array.isArray(v) ? v[0] : v;

/** Every quantity/cost below comes from a recorded event, never a benchmark percentage. */
export function productionReportFacts(lots: Row[], entries: Row[], defects: Row[], resolutions: Row[], stages: Row[], selectedLot?: string | null) {
  const stageMap = new Map<string, { input_qty: number; output_qty: number; rework_qty: number; damage_qty: number; cost: number }>();
  const names = new Map(stages.map(s => [s.id, s.name]));
  const lotStageNames = new Map(entries.map(e => [e.lot_production_stage_id, one(e.lot_stage)?.stage_name]));
  const byLot = new Map<string, Row>();
  for (const entry of entries) {
    const stage = one(entry.lot_stage), name = stage?.stage_name || "Unassigned stage";
    const value = stageMap.get(name) || { input_qty: 0, output_qty: 0, rework_qty: 0, damage_qty: 0, cost: 0 };
    value.input_qty += n(entry.qty_in); value.output_qty += n(entry.qty_out); value.cost += n(entry.total_job_work_amount ?? entry.total_labor_cost);
    stageMap.set(name, value);
    if (stage?.lot_id) {
      const previous = byLot.get(stage.lot_id);
      if (!previous || String(entry.entry_date) > String(previous.entry_date)) byLot.set(stage.lot_id, entry);
    }
  }
  const lotDefects = new Map<string, { rework: number; damage: number }>();
  for (const defect of defects) {
    const rework = ["sent_for_rework", "reworked_fixed"].includes(defect.status);
    const current = lotDefects.get(defect.lot_id) || { rework: 0, damage: 0 };
    current[rework ? "rework" : "damage"] += n(defect.quantity); lotDefects.set(defect.lot_id, current);
    const name = lotStageNames.get(defect.responsible_stage_id) || names.get(defect.responsible_stage_id) || "Unassigned stage";
    const value = stageMap.get(name) || { input_qty: 0, output_qty: 0, rework_qty: 0, damage_qty: 0, cost: 0 };
    value[rework ? "rework_qty" : "damage_qty"] += n(defect.quantity); stageMap.set(name, value);
  }
  const lotRows = lots.map(l => {
    const input = n(l.total_quantity), output = n(l.completed_quantity), defect = lotDefects.get(l.id);
    return { id: l.id, lot_number: l.lot_number, lot_date: l.lot_date, design_name: one(l.design)?.name || "—", design_number: one(l.design)?.design_number || "—", brand: one(l.brand)?.name || "—", brand_id: one(l.brand)?.id, status: l.status, input_qty: input, good_output: output, rework_qty: defect?.rework ?? n(l.reworked_quantity), damage_qty: defect?.damage ?? n(l.scrapped_quantity) + n(l.b_grade_quantity), current_stage: one(byLot.get(l.id)?.lot_stage)?.stage_name || "Not recorded", efficiency: input > 0 ? output / input * 100 : null, created_at: l.created_at };
  });
  const count = (status: string[]) => lotRows.filter(l => status.includes(l.status)).length;
  const sum = (rows: Row[], field: string) => rows.reduce((s, r) => s + n(r[field]), 0);
  const input = sum(lotRows, "input_qty"), output = sum(lotRows.filter(l => l.status === "completed"), "good_output"), rework = sum(lotRows, "rework_qty"), damage = sum(lotRows, "damage_qty");
  const labour = entries.reduce((s, e) => s + n(e.total_job_work_amount ?? e.total_labor_cost), 0), repair = sum(resolutions, "rework_cost"), cost = labour + repair;
  const categoryMap = new Map<string, number>();
  for (const d of defects) { const category = d.defect_category || "Unspecified reason"; categoryMap.set(category, (categoryMap.get(category) || 0) + n(d.quantity)); }
  const defectTotal = Array.from(categoryMap.values()).reduce((s, v) => s + v, 0);
  const timelineId = selectedLot && selectedLot !== "all" ? selectedLot : lotRows[0]?.id;
  return {
    summary: { totalLots: lotRows.length, completedLots: count(["completed"]), completedPct: lotRows.length ? count(["completed"]) / lotRows.length * 100 : 0, inProgressLots: count(["in_process", "in_progress"]), inProgressPct: lotRows.length ? count(["in_process", "in_progress"]) / lotRows.length * 100 : 0, onHoldLots: count(["on_hold"]), onHoldPct: lotRows.length ? count(["on_hold"]) / lotRows.length * 100 : 0, draftLots: count(["draft"]), cancelledLots: count(["cancelled"]), inputQtyTotal: input, finalOutputQty: output, totalReworkQty: rework, reworkPct: input ? rework / input * 100 : 0, totalDamageQty: damage, damagePct: input ? damage / input * 100 : 0, totalWastageQty: sum(entries, "wastage_qty"), wastagePct: input ? sum(entries, "wastage_qty") / input * 100 : 0, productionCostTotal: cost, overallEfficiency: input ? output / input * 100 : null },
    lots: lotRows,
    stageAnalysis: Array.from(stageMap).map(([stage, v]) => ({ stage, ...v, efficiency: v.input_qty ? (v.output_qty / v.input_qty * 100).toFixed(2) : null })),
    reworkDamageBreakdown: Array.from(categoryMap).map(([category, count]) => ({ category, count, percentage: defectTotal ? count / defectTotal * 100 : 0 })),
    costAnalysis: Array.from(stageMap).map(([cost_type, v]) => ({ cost_type, amount: v.cost, pct: cost ? v.cost / cost * 100 : 0 })).concat([{ cost_type: "Rework / Repair Cost", amount: repair, pct: cost ? repair / cost * 100 : 0 }]),
    reconciliation: { opening_wip: null, production_input: input, reworked_recovered: sum(resolutions, "qty_recovered"), final_good_output: output, damage_rejection: sum(resolutions, "qty_scrapped") + sum(resolutions, "qty_b_grade"), wastage: sum(entries, "wastage_qty"), closing_wip: null },
    lotTimeline: entries.filter(e => one(e.lot_stage)?.lot_id === timelineId).sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)) || String(a.id).localeCompare(String(b.id))).map(e => ({ id: e.id, entry_id: e.id, lot_id: timelineId, date: e.entry_date, time: "Date recorded; time unavailable", stage: one(e.lot_stage)?.stage_name || "Unassigned stage", status: "Recorded", input_qty: n(e.qty_in), output_qty: n(e.qty_out), rejected_qty: n(e.wastage_qty), rework_qty: null, view_url: "/production/stage-entries" })),
    metadata: { basis: "Lots started in period; stage activity and resolutions recorded in period", openingWipAvailable: false, note: "Opening/closing WIP require a reconciled snapshot. Stage quantities are throughput and must not be added as final lot output. Only recorded labour and rework costs are included." },
  };
}
