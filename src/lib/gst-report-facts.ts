type Row = Record<string, any>;
const n = (v: unknown) => Number(v || 0);
const round = (v: number) => Math.round(v * 100) / 100;
const one = (v: any): Row | undefined => Array.isArray(v) ? v[0] : v;

/** Recorded components only: missing component attribution is an exception, never an invented intra-state split. */
export function gstReportFacts(sales: Row[], raw: Row[], expenses: Row[], finished: Row[], saleReturns: Row[], purchaseReturns: Row[], credits: Row[], debits: Row[]) {
  const exceptions: Row[] = [], output: Row[] = [], input: Row[] = [], expenseRows: Row[] = [], rcm: Row[] = [];
  const row = (r: Row, date: string, doc: string, type: string, taxable: unknown, total: unknown, sign = 1): Row => {
    const party = one(r.party), missing = [r.cgst, r.sgst, r.igst, taxable].some(v => v == null);
    const cgst = sign * n(r.cgst), sgst = sign * n(r.sgst), igst = sign * n(r.igst);
    const recordedTax = r.total_gst_amount ?? r.gst_amount;
    const result = { id: r.id, date, doc_number: doc, party_name: party?.company_name || party?.name || r.vendor_name || "Not recorded", gstin: party?.gstin || "Not recorded", taxable_value: round(sign * n(taxable)), cgst: round(cgst), sgst: round(sgst), igst: round(igst), total_gst: round(recordedTax != null ? sign * n(recordedTax) : cgst + sgst + igst), total: round(sign * n(total)), type, gst_type: r.gst_type, tax_components_missing: missing, recorded_total_tax: r.total_gst_amount ?? r.gst_amount ?? null, view_url: type === "output" ? `/sales/bills/${r.id}` : "/reports/purchases" };
    if (missing) exceptions.push({ id: r.id, doc_number: doc, date, source: type, reason: "Recorded tax components or taxable value are missing", recorded_total_tax: result.recorded_total_tax, view_url: result.view_url });
    return result;
  };
  for (const b of sales) output.push(row(b, b.bill_date, b.bill_number, "output", b.taxable_amount, b.grand_total));
  for (const b of raw) (b.gst_type === "reverse_charge" ? rcm : input).push(row(b, b.invoice_date, b.purchase_number, b.gst_type === "reverse_charge" ? "rcm" : "input", b.taxable_after_discount ?? b.total_taxable_value, b.grand_total));
  for (const b of finished) {
    if (b.bill_type === "pakka") input.push(row(b, b.invoice_date, b.bill_number, "input_finished_goods", b.taxable_amount, b.grand_total));
    else if (b.bill_type == null) exceptions.push({ id: b.id, date: b.invoice_date, doc_number: b.bill_number, source: "finished_goods", reason: "Bill type is unclassified; tax inclusion cannot be determined", view_url: "/reports/purchases" });
  }
  for (const e of expenses) expenseRows.push({ ...row(e, e.expense_date, e.expense_number, "input_expense", e.amount, n(e.amount) + n(e.gst_amount)), expense_type: one(e.expense_type)?.name || "Expense" });
  for (const r of saleReturns) {
    if (one(r.bill)?.bill_type === "pakka") output.push(row(r, r.return_date, r.return_number, "sales_return", r.taxable_amount, r.grand_total, -1));
    else if (!one(r.bill)?.bill_type) exceptions.push({ id: r.id, date: r.return_date, doc_number: r.return_number, source: "sales_return", reason: "Original invoice tax classification unavailable", view_url: "/sales/returns" });
  }
  for (const r of purchaseReturns) {
    const gst = one(r.purchase)?.gst_type;
    if (gst && gst !== "without_gst") (gst === "reverse_charge" ? rcm : input).push(row(r, r.return_date, r.return_number, "purchase_return", r.taxable_after_discount ?? r.taxable_amount ?? r.taxable_value ?? r.total_taxable_value, r.grand_total, -1));
  }
  // A note issued for an already-posted return represents the same adjustment, even when issued in another period.
  for (const c of credits) if (!c.return_id) output.push(row(c, c.cn_date, c.cn_number, "credit_note", c.taxable_amount, c.amount, -1));
  for (const d of debits) if (!d.related_purchase_return_id) input.push(row(d, d.dn_date, d.dn_number, "debit_note", d.taxable_amount, d.amount, -1));
  const totals = (list: Row[]) => ({ taxable_value: round(list.reduce((s, r) => s + r.taxable_value, 0)), cgst: round(list.reduce((s, r) => s + r.cgst, 0)), sgst: round(list.reduce((s, r) => s + r.sgst, 0)), igst: round(list.reduce((s, r) => s + r.igst, 0)), total: round(list.reduce((s, r) => s + r.total_gst, 0)) });
  const out = totals(output), inp = totals([...input, ...expenseRows]), reverse = totals(rcm);
  const net = { cgst: round(out.cgst - inp.cgst), sgst: round(out.sgst - inp.sgst), igst: round(out.igst - inp.igst), total: round(out.total - inp.total), direction: out.total >= inp.total ? "payable" : "credit" };
  const note = "Recorded tax components only. Known total tax is retained; missing components are listed as exceptions and excluded from component splits. Eligibility, RCM payment/credit lifecycle and statutory set-off are not inferred; this is a provisional source summary.";
  return {
    output_gst: { rows: output, totals: out, note: "Pakka sales less recorded return/credit adjustments. " + note },
    input_gst: { rows: input, expense_rows: expenseRows, totals: { ...inp, purchases_taxable: totals(input).taxable_value, expenses_taxable: totals(expenseRows).taxable_value }, note },
    rcm: { rows: rcm, totals: reverse, note: "Recorded reverse-charge source values, shown separately from arithmetic output less input. Payment and eligibility need source evidence." },
    summary: { output_gst: out, input_gst: inp, rcm_gst: reverse, net_payable: net },
    metadata: { preliminary: true, unclassified_input_tax: round(inp.total - inp.cgst - inp.sgst - inp.igst), exceptions, missing_components: exceptions.length, note, input_breakdown: { raw_materials: totals(input.filter(r => r.type === "input")).total, finished_goods: totals(input.filter(r => r.type === "input_finished_goods")).total, expenses: totals(expenseRows).total, adjustments: totals(input.filter(r => ["purchase_return", "debit_note"].includes(r.type))).total } },
  };
}
