type Row = Record<string, any>;
export function paidAtCutoff(rows: Row[], future: Row[], billType: string) {
  const later = new Map<string, number>();
  for (const entry of future) if (entry.bill_type === billType) later.set(entry.bill_id, (later.get(entry.bill_id) || 0) + Number(entry.allocated_amount || 0));
  return rows.map((row): Row => {
    const paid = Math.max(0, Number(row.paid_amount || 0) - (later.get(row.id) || 0));
    return { ...row, paid_amount: paid, payment_status: paid >= Number(row.grand_total) ? "paid" : paid > 0 ? "partial" : "unpaid" };
  });
}

export function dueDateAging(rows: Row[], cutoff: string, dateField: string) {
  const result = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
  for (const row of rows) {
    const amount = Math.max(0, Number(row.grand_total) - Number(row.paid_amount || 0));
    const days = Math.floor((Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${row.due_date || row[dateField]}T00:00:00Z`)) / 86400000);
    result[days <= 0 ? "current" : days <= 30 ? "d30" : days <= 60 ? "d60" : days <= 90 ? "d90" : "over90"] += amount;
  }
  return result;
}
