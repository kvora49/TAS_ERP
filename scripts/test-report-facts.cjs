const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
function load(name) {
  const file = `${process.cwd()}/src/lib/${name}.ts`;
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = new Module(file, moduleParent);
  module.filename = file; module.paths = Module._nodeModulePaths(process.cwd()); module._compile(output, file);
  return module.exports;
}
const moduleParent = module;
const { cashflowReportFacts } = load('cashflow-report-facts');
const account = [{ id: 'bank', type: 'bank', current_balance: 750 }];
const payments = [{ id: 'receipt', payment_date: '2026-09-01', direction: 'received', bank_account_id: 'bank', amount: 1000, payment_mode: 'bank_transfer' }, { id: 'supplier', payment_date: '2026-09-02', direction: 'paid', bank_account_id: 'bank', amount: 100, payment_mode: 'bank_transfer' }, { id: 'later', payment_date: '2026-10-01', direction: 'received', bank_account_id: 'bank', amount: 100, payment_mode: 'bank_transfer' }];
const jobs = [{ id: 'job', payment_date: '2026-09-03', bank_account_id: 'bank', paid_amount: 50, payment_mode: 'bank_transfer' }];
const expenses = [{ id: 'expense', expense_date: '2026-09-04', paid_from_account_id: 'bank', amount: 100, gst_amount: 20 }];
const salaries = [{ id: 'salary', payment_date: '2026-09-05', bank_account_id: 'bank', net_salary: 80, payment_mode: 'bank_transfer' }];
let flow = cashflowReportFacts('2026-09-01', '2026-09-30', account, payments, jobs, [], expenses, salaries);
assert.equal(flow.opening_balance, 0); assert.equal(flow.closing_balance, 650); assert.equal(flow.outflows.total, 350);
assert.equal(flow.outflows.by_mode.bank_transfer, 230, 'job work must add to supplier mode rather than overwrite');
assert.equal(flow.reconciled, true); assert.equal(flow.cash_in_hand, 0); assert.equal(flow.bank_balance, 650);
flow = cashflowReportFacts('2026-09-01', '2026-09-30', account, payments, [{ ...jobs[0], bank_account_id: null }], [], expenses, salaries);
assert.equal(flow.reconciled, false); assert.equal(flow.metadata.unassigned_movements, 1);
console.log('PASS cash flow includes expenses/salary, merges modes, rolls back later cash and exposes unassigned movements');

const { gstReportFacts } = load('gst-report-facts');
const tax = { taxable_amount: 100, cgst: 9, sgst: 9, igst: 0, grand_total: 118 };
let gst = gstReportFacts([{ ...tax, id: 'sale', bill_date: '2026-09-01', bill_number: 'INV-1' }], [], [], [{ ...tax, id: 'finished', bill_type: 'pakka', invoice_date: '2026-09-02' }], [{ ...tax, id: 'return', bill: { bill_type: 'pakka' }, return_date: '2026-09-03' }], [], [{ ...tax, id: 'linked', return_id: 'return', cn_date: '2026-09-03' }], []);
assert.equal(gst.output_gst.totals.total, 0, 'linked credit note must not duplicate the return');
assert.equal(gst.input_gst.totals.total, 18, 'finished goods tax source must be included');
gst = gstReportFacts([], [{ id: 'raw', total_gst_amount: 18, total_taxable_value: 100 }], [{ id: 'expense', amount: 100, gst_amount: 18 }], [], [], [], [], []);
assert.equal(gst.input_gst.totals.cgst, 0, 'missing tax split must not be invented');
assert.equal(gst.metadata.missing_components, 2); assert.equal(gst.input_gst.totals.total, 36); assert.equal(gst.metadata.unclassified_input_tax, 36);
console.log('PASS GST source coverage, linked adjustment deduplication and unavailable component exceptions');

const { paidAtCutoff, dueDateAging } = load('report-balances');
const bills = paidAtCutoff([{ id: 'bill', grand_total: 1000, paid_amount: 600, due_date: '2026-09-15', bill_date: '2026-09-01' }], [{ bill_id: 'bill', bill_type: 'sale_bill', allocated_amount: 200 }], 'sale_bill');
assert.equal(bills[0].paid_amount, 400); assert.equal(bills[0].payment_status, 'partial');
const aging = dueDateAging(bills, '2026-09-30', 'bill_date');
assert.equal(aging.d30, 600);
console.log('PASS historical residual and due-date aging');

const { workerReportFacts } = load('worker-report-facts');
const worker = workerReportFacts([{ id: 'entry', worker_id: 'worker', qty_in: 10, qty_out: 8, job_work_rate: 5, total_job_work_amount: 40, paid_amount: 30, lot_stage: { stage_name: 'Stitch', lot_id: 'lot', lot: { lot_number: 'L-1' } } }], [{ id: 'worker', name: 'Worker' }], [], [{ id: 'defect', responsible_worker_id: 'worker', status: 'sent_for_rework', quantity: 2 }], [{ defect_id: 'defect', qty_recovered: 1, qty_scrapped: 1 }], [{ stage_entry_id: 'entry', amount_applied: 10 }], 'worker');
assert.equal(worker.summary.totalPaid, 20); assert.equal(worker.summary.totalOutstanding, 20); assert.equal(worker.workerStageBreakdown.stages[0].rate, 5); assert.equal(worker.reworkDamageSummary[0].recovered_qty, 1);
console.log('PASS worker weighted rates, later allocation rollback and actual recovery');

const { productionReportFacts } = load('production-report-facts');
const production = productionReportFacts([], [], [], [], [], undefined);
assert.equal(production.summary.overallEfficiency, null); assert.equal(production.reconciliation.opening_wip, null); assert.equal(production.lotTimeline.length, 0); assert.equal(production.stageAnalysis.length, 0);
console.log('PASS empty production has no synthetic stages, efficiency, WIP or timeline');
const { reportSubscriptionPeriod } = load('report-subscription-period');
const monthly = reportSubscriptionPeriod('monthly',new Date('2026-10-03T03:30:00Z'));
assert.equal(monthly.from,'2026-09-01'); assert.equal(monthly.to,'2026-09-30'); assert.equal(monthly.next,'2026-11-01T03:30:00.000Z');
const weekly = reportSubscriptionPeriod('weekly',new Date('2026-10-03T03:30:00Z'));
assert.equal(weekly.from,'2026-09-26'); assert.equal(weekly.to,'2026-10-02');
console.log('PASS scheduled export periods use complete days/months in India time');
