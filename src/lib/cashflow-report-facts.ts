type Row = Record<string, any>;
const n = (v: unknown) => Number(v || 0);
const round = (v: number) => Math.round(v * 100) / 100;
const one = (v: any): Row | undefined => Array.isArray(v) ? v[0] : v;

export function cashflowReportFacts(from: string, to: string, accounts: Row[], payments: Row[], jobs: Row[], incomes: Row[], expenses: Row[], salaries: Row[]) {
  const rows: Row[] = [];
  const add = (r: Row, date: string, amount: number, direction: string, account: string | null, category: string, doc: string, name: string, description: string, mode: string, url: string) => rows.push({ id: r.id, date, amount, direction, account_id: account, category, doc_number: doc || r.id, party_name: name, description, badge: mode || "Unassigned", payment_mode: mode || "unassigned", badge_color: direction === "received" ? "emerald" : "rose", view_url: url });
  for (const p of payments) {
    if (!["received", "paid"].includes(p.direction)) continue;
    const party = one(p.party);
    add(p, p.payment_date, n(p.amount), p.direction, p.bank_account_id, p.direction === "received" ? "Customer Receipt" : "Supplier Payment", p.payment_number, party?.company_name || party?.name || "Party", "Posted payment voucher", p.payment_mode, party?.id ? `/parties/${party.id}/ledger` : "/banking");
  }
  for (const j of jobs) add(j, j.payment_date, n(j.paid_amount), "paid", j.bank_account_id, "Job Work Payment", j.payment_number, one(j.worker)?.name || "Worker", j.remarks || "Recorded job work payment", j.payment_mode, "/production");
  for (const m of incomes) add(m, m.income_date, n(m.amount), "received", m.received_in_account_id, "Other Receipts", m.income_number, m.income_type, m.notes || "Recorded other income", "unassigned", "/banking");
  for (const e of expenses) add(e, e.expense_date, n(e.amount) + n(e.gst_amount), "paid", e.paid_from_account_id, "Expense Payment", e.expense_number, e.vendor_name || "Expense", e.notes || "Recorded expense", "unassigned", "/expenses");
  for (const s of salaries) add(s, s.payment_date, n(s.net_salary), "paid", s.bank_account_id, "Salary Payment", s.id, one(s.worker)?.company_name || one(s.worker)?.name || "Employee", "Net salary paid", s.payment_mode, "/payments/salary");
  const ids = new Set(accounts.map(a => a.id));
  const signed = (r: Row) => r.direction === "received" ? r.amount : -r.amount;
  const period = rows.filter(r => r.date >= from && r.date <= to).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const inflows = period.filter(r => r.direction === "received"), outflows = period.filter(r => r.direction === "paid");
  const sum = (list: Row[]) => round(list.reduce((s, r) => s + r.amount, 0));
  const category = (list: Row[], name: string) => sum(list.filter(r => r.category === name));
  const modes = (list: Row[]) => list.reduce((m, r) => { m[r.payment_mode] = round((m[r.payment_mode] || 0) + r.amount); return m; }, {} as Record<string, number>);
  const balances: Row[] = accounts.map(a => ({ ...a, opening: n(a.current_balance) - rows.filter(r => r.account_id === a.id && r.date >= from).reduce((s, r) => s + signed(r), 0), closing: n(a.current_balance) - rows.filter(r => r.account_id === a.id && r.date > to).reduce((s, r) => s + signed(r), 0) }));
  const balance = (field: string, cash?: boolean) => round(balances.filter(a => cash === undefined || (a.type === "cash") === cash).reduce((s, a) => s + a[field], 0));
  const unassigned = period.filter(r => !ids.has(r.account_id));
  const opening = balance("opening"), closing = balance("closing"), net = round(sum(inflows) - sum(outflows));
  return {
    opening_balance: opening, closing_balance: closing, cash_in_hand: balance("closing", true), bank_balance: balance("closing", false),
    inflows: { customer_receipts: category(inflows, "Customer Receipt"), misc_income: category(inflows, "Other Receipts"), total: sum(inflows), by_mode: modes(inflows), rows: inflows },
    outflows: { supplier_payments: category(outflows, "Supplier Payment"), job_work_payments: category(outflows, "Job Work Payment"), expenses: category(outflows, "Expense Payment"), salaries: category(outflows, "Salary Payment"), total: sum(outflows), by_mode: modes(outflows), rows: outflows },
    net_cash_flow: net, reconciled: unassigned.length === 0 && Math.abs(closing - opening - net) < 0.01,
    note: "Cash/bank balances roll back recorded account movements to the selected cutoff. Expenses and salaries are included. Unassigned movements require reconciliation; this is not independent bank-statement reconciliation.",
    metadata: { unassigned_movements: unassigned.length, unassigned_net: round(unassigned.reduce((s, r) => s + signed(r), 0)), account_movement_difference: round(closing - opening - net), accounts: balances.map(a => ({ id: a.id, name: a.name, opening: round(a.opening), closing: round(a.closing) })) },
  };
}
