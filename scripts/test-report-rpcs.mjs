import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const business = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const customer = '20000000-0000-4000-8000-000000000001';
const supplier = '20000000-0000-4000-8000-000000000002';
const bank = '30000000-0000-4000-8000-000000000001';
const bill = '40000000-0000-4000-8000-000000000001';
const purchase = '40000000-0000-4000-8000-000000000002';
const received = '50000000-0000-4000-8000-000000000001';
const paid = '50000000-0000-4000-8000-000000000002';

// Minimal pre-phase schema, absent from the committed phase migrations.
const tables = new Map(Object.entries({
  parties: 'id uuid,business_id uuid,name text,type text[],phone text,address text,created_at timestamptz,deleted_at timestamptz',
  bank_accounts: 'id uuid,business_id uuid,name text,type text,sub_label text,account_number text,current_balance numeric,opening_balance numeric,is_active boolean,deleted_at timestamptz',
  design_colours: 'id uuid,business_id uuid,design_id uuid,colour_name text',
  designs: 'id uuid,business_id uuid,name text,design_number text,sale_price numeric,brand_id uuid',
  raw_material_types: 'id uuid,business_id uuid,name text,unit text,category text',
  godowns: 'id uuid,business_id uuid,name text',
  brands: 'id uuid,business_id uuid,name text',
  production_stages: 'id uuid,business_id uuid,name text',
  expense_types: 'id uuid,business_id uuid,name text',
}).map(([name, fields]) => [name, new Map(fields.split(',').map(x => { const [col, type] = x.split(' '); return [col, type]; }))]));

const files = fs.readdirSync('supabase/migrations').filter(n => n.endsWith('.sql') && n < '20260928').sort();
const validType = /^(\w+)\s+(UUID|TEXT\[\]|TEXT|NUMERIC(?:\([^)]*\))?|INTEGER|INT|BIGINT|BOOLEAN|DATE|TIMESTAMPTZ|TIMESTAMP(?:\s+WITH\s+TIME\s+ZONE)?|JSONB|JSON|DECIMAL(?:\([^)]*\))?|VARCHAR(?:\([^)]*\))?|REAL|DOUBLE PRECISION)\b/i;
function addColumn(name, declaration) {
  const m = declaration.trim().match(validType);
  if (!m) return;
  if (!tables.has(name)) tables.set(name, new Map());
  tables.get(name).set(m[1], m[2]);
}
for (const file of files) {
  const sql = fs.readFileSync('supabase/migrations/' + file, 'utf8');
  for (const m of sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    for (const declaration of m[2].split('\n')) addColumn(m[1], declaration);
  }
  for (const m of sql.matchAll(/ALTER TABLE\s+(?:public\.)?(\w+)\s+([\s\S]*?);/gi)) {
    for (const c of m[2].matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([^,;\n]+(?:\([^)]*\))?)/gi)) addColumn(m[1], c[1]);
  }
}
// TEXT[] is not matched by a word boundary after the closing bracket.
tables.get('parties').set('type', 'text[]');
for (const [name, cols] of tables) {
  if (cols.size) await db.exec(`CREATE TABLE public.${name} (${[...cols].map(([c,t]) => `${c} ${t}`).join(',')});`);
}

const migrations = fs.readdirSync('supabase/migrations').filter(n => /^202610030000(?:0[0-9]|1[013])_/.test(n)).sort();
for (const file of migrations) { try { await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8')); } catch (error) { throw new Error(`${file}: ${error.message}`); } }
async function call(name, args) {
  const placeholders = args.map((_, i) => `$${i+1}`).join(',');
  try { return (await db.query(`SELECT public.${name}(${placeholders}) AS data`, args)).rows[0].data; }
  catch (error) { throw Object.assign(new Error(`${name}: ${error.message}\n${error.where ?? ''}`), {code:error.code}); }
}

const names = ['fn_report_payments','fn_report_analysis','fn_report_financial_pl','fn_report_financial_balance','fn_party_ledger','fn_report_stock_valuation'];
for (const route of ['reports/payments','reports/analysis','reports/financial/pl','reports/financial/balance','parties/[id]/ledger','reports/stock-valuation']) {
  const source = fs.readFileSync(`src/app/api/${route}/route.ts`, 'utf8');
  assert.equal((source.match(/supabase\.rpc\(/g) || []).length, 1, `${route} must use one RPC`);
  assert.equal(/supabase\.from\(|\.reduce\(|reconcileFinishedStock/.test(source), false, `${route} must not fetch/reduce or mutate stock`);
}
for (const name of names) {
  const { rows } = await db.query('SELECT provolatile, prosecdef FROM pg_proc WHERE proname = $1', [name]);
  assert.ok(rows.length > 0, name);
  for (const row of rows) { assert.equal(row.provolatile, 's', `${name} must be STABLE`); assert.equal(row.prosecdef, false, `${name} must preserve RLS`); }
}
// Execute every branch, including empty datasets. This catches SQL type/column errors.
for (const tab of ['receivables','payables','receipts','payments','accounts','cheques','advances','transfers','all_transactions']) {
  await call('fn_report_payments', [business, tab, '2026-09-01', '2026-09-30']);
  console.log(`PASS payments/${tab} empty contract`);
}
await call('fn_report_analysis', [business, '2026-09-01', '2026-09-30']);
console.log('PASS analysis empty contract');
await call('fn_report_financial_pl', [business, '2026-09-01', '2026-09-30']);
console.log('PASS P&L empty contract');
await call('fn_report_financial_balance', [business, '2026-09-30']);
console.log('PASS balance empty contract');
await call('fn_report_stock_valuation', [business]);
console.log('PASS stock valuation empty contract');

await db.query(`INSERT INTO parties(id,business_id,name,type,opening_balance,created_at) VALUES ($1,$3,'Customer',ARRAY['customer'],0,'2026-04-01'),($2,$3,'Supplier',ARRAY['supplier'],0,'2026-04-01')`, [customer,supplier,business]);
await db.query(`INSERT INTO bank_accounts(id,business_id,name,type,account_category,current_balance,opening_balance,is_active) VALUES ($1,$2,'Bank','bank','pakka',100,0,true)`,[bank,business]);
await db.query(`INSERT INTO sale_bills(id,business_id,party_id,bill_number,bill_date,due_date,bill_type,grand_total,paid_amount,payment_status,status) VALUES ($1,$2,$3,'INV-1','2026-09-02','2026-09-15','pakka',1000,400,'partial','active')`,[bill,business,customer]);
await db.query(`INSERT INTO sale_bill_items(id,bill_id,amount,quantity,rate) VALUES (gen_random_uuid(),$1,600,1,600),(gen_random_uuid(),$1,400,1,400)`,[bill]);
await db.query(`INSERT INTO raw_material_purchases(id,business_id,supplier_id,purchase_number,invoice_date,due_date,grand_total,paid_amount,payment_status,status,gst_type) VALUES ($1,$2,$3,'PUR-1','2026-09-02','2026-09-15',1000,300,'partial','active','with_gst')`,[purchase,business,supplier]);
await db.query(`INSERT INTO raw_material_purchase_items(id,purchase_id,item_type,amount,quantity,rate) VALUES (gen_random_uuid(),$1,'fabric',600,1,600),(gen_random_uuid(),$1,'accessory',400,1,400)`,[purchase]);
await db.query(`INSERT INTO payments(id,business_id,party_id,payment_number,payment_date,direction,payment_mode,amount,status,bank_account_id) VALUES ($1,$3,$4,'REC-1','2026-09-10','received','bank_transfer',400,'completed',$6),($2,$3,$5,'PAY-1','2026-09-10','paid','bank_transfer',300,'completed',$6)`,[received,paid,business,customer,supplier,bank]);
await db.query(`INSERT INTO payment_allocations(id,business_id,payment_id,bill_id,bill_type,allocated_amount) VALUES (gen_random_uuid(),$1,$2,$3,'sale_bill',400)`,[business,received,bill]);

const fixturePayments = [{direction:'received',amount:400}, {direction:'paid',amount:300}];
const totals = fixturePayments.reduce((a,p) => ({ ...a, [p.direction]: a[p.direction]+p.amount }), {received:0,paid:0});
const all = await call('fn_report_payments',[business,'all_transactions','2026-09-01','2026-09-30']);
assert.equal(all.rows.length,2); assert.equal(all.summary.totalReceipts,totals.received); assert.equal(all.summary.totalPayments,totals.paid); assert.equal(all.summary.netCashFlow,100);
console.log('PASS payments fixture vs JavaScript aggregation');
const receivables = await call('fn_report_payments',[business,'receivables','2026-09-01','2026-09-30']);
assert.equal(receivables.summary.totalOutstanding,600); assert.equal(receivables.summary.overdueAmount,600);
const payables = await call('fn_report_payments',[business,'payables','2026-09-01','2026-09-30']);
assert.equal(payables.summary.totalOutstanding,700);
console.log('PASS receivables/payables residual and overdue totals');
const pl = await call('fn_report_financial_pl',[business,'2026-09-01','2026-09-30']);
assert.equal(pl.revenue.gross_revenue,1000,'multi-line invoices must be counted once'); assert.equal(pl.revenue.total,1000);
assert.equal(pl.cogs.purchases_in_period.fabric,600); assert.equal(pl.cogs.purchases_in_period.accessories,400);
console.log('PASS P&L multiple items preserve invoice totals and categories');
const ledger = await call('fn_party_ledger',[business,customer]);
const receipt = ledger.ledger.find(x => x.voucherNo === 'REC-1');
assert.equal(receipt.credit,400); assert.equal(receipt.voucherType,'Receipt'); assert.equal(receipt.balance,600); assert.equal(receipt.allocations[0].amount,400);
const supplierLedger = await call('fn_party_ledger',[business,supplier]);
assert.equal(supplierLedger.ledger.find(x=>x.voucherNo==='PAY-1').debit,300);
assert.equal(supplierLedger.ledger.at(-1).balance,700);
console.log('PASS party ledger receipt/payment voucher numbers, signs and allocations');
const analysis = await call('fn_report_analysis',[business,'2026-09-01','2026-09-30',null,null,'none']);
assert.equal(analysis.sales.netSales,1000); assert.equal(analysis.financial.grossProfit,pl.gross_profit); assert.equal(analysis.sales.growth,null);
assert.equal(analysis.inventory.health.fastMoving,null);
console.log('PASS analysis reconciles to P&L and unavailable estimates stay null');
const balance = await call('fn_report_financial_balance',[business,'2026-09-30']);
assert.equal(balance.assets.current.trade_receivables,600); assert.equal(balance.liabilities.current.rm_payables,700);
console.log('PASS balance receivable/payable fixtures');
await db.query(`INSERT INTO designs(id,business_id,name,sale_price) VALUES ($1,$2,'Design',500)`,[bill,business]);
await db.query(`INSERT INTO finished_stock(id,business_id,design_id,total_quantity,cost_per_piece,total_value) VALUES ($1,$2,$3,5,0,0)`,[purchase,business,bill]);
const stock = await call('fn_report_stock_valuation',[business]);
assert.equal(stock.totalFGValue,0,'sale price must not invent inventory cost');
await db.query('UPDATE finished_stock SET cost_per_piece=20 WHERE id=$1',[purchase]);
assert.equal((await call('fn_report_stock_valuation',[business])).totalFGValue,100);
console.log('PASS stock valuation uses recorded cost and JS quantity × cost parity');
await db.query("UPDATE sale_bill_items SET business_id=$1,design_id=$2,cost_per_piece=200,size='M' WHERE bill_id=$3",[business,bill,bill]);
await db.query(`UPDATE finished_stock SET size_quantities='{"M":5}'::jsonb WHERE id=$1`,[purchase]);
await db.query("UPDATE raw_material_purchases SET delivery_date='2026-09-04' WHERE id=$1",[purchase]);
const insights = (await call('fn_report_analysis',[business,'2026-09-01','2026-09-30'])).garmentInsights;
assert.equal(insights.designs[0].revenue,1000); assert.equal(insights.designs[0].recorded_cost,400); assert.equal(insights.designs[0].contribution,600);
assert.equal(insights.variants[0].sold_quantity,2); assert.equal(insights.variants[0].stock_quantity,5); assert.equal(insights.variants[0].cover_days,75);
assert.equal(insights.suppliers[0].recorded_delivery_days,2);
await db.query("UPDATE sale_bill_items SET cost_per_piece=NULL WHERE bill_id=$1",[bill]);
assert.equal((await call('fn_report_analysis',[business,'2026-09-01','2026-09-30'])).garmentInsights.designs[0].contribution,null);
console.log('PASS garment contribution, missing costs, size demand/stock and recorded supplier delivery');
const legacyPurchase='40000000-0000-4000-8000-000000000003';
await db.query(`INSERT INTO purchase_bills(id,business_id,supplier_id,bill_number,invoice_date,grand_total,paid_amount,status,bill_type) VALUES ($1,$2,$3,'LEGACY-FG','2026-09-05',200,0,'active','pakka')`,[legacyPurchase,business,supplier]);
const legacyPL=await call('fn_report_financial_pl',[business,'2026-09-01','2026-09-30']);
assert.equal(legacyPL.cogs.purchases_in_period.finished_goods,200);
assert.equal(legacyPL.cogs.purchases_drill_records.filter(r=>r.doc_number==='LEGACY-FG').reduce((s,r)=>s+r.amount,0),200);
assert.equal(legacyPL.revenue.drill_records.reduce((s,r)=>s+r.amount,0),legacyPL.revenue.gross_revenue);
assert.equal(legacyPL.cogs.purchases_drill_records.reduce((s,r)=>s+r.amount,0),1200);
const compared=await call('fn_report_analysis',[business,'2026-09-01','2026-09-30']);
assert.equal(compared.comparison.sales,0); assert.equal(compared.sales.growth,null); assert.equal(compared.outstanding.receivables,600); assert.equal(compared.outstanding.payables,900);
console.log('PASS legacy finished purchases, drill totals, previous values and zero-base growth');
assert.equal((await call('fn_report_payments',[other,'all_transactions','2026-09-01','2026-09-30'])).rows.length,0);
assert.equal((await call('fn_party_ledger',[other,customer])).error,'Party/Worker not found');
console.log('PASS tenant filter isolation');
// A payment posted after the report cut-off must not erase historical debt/cash.
await db.query(`INSERT INTO payments(id,business_id,party_id,payment_number,payment_date,direction,payment_mode,amount,status,bank_account_id) VALUES (gen_random_uuid(),$1,$2,'REC-LATER','2026-10-02','received','bank_transfer',200,'completed',$3)`,[business,customer,bank]);
await db.query(`INSERT INTO payment_allocations(id,business_id,payment_id,bill_id,bill_type,allocated_amount,created_at) SELECT gen_random_uuid(),$1,id,$2,'sale_bill',200,'2026-10-02' FROM payments WHERE payment_number='REC-LATER'`,[business,bill]);
await db.query(`UPDATE sale_bills SET paid_amount=600 WHERE id=$1`,[bill]);
await db.query(`UPDATE bank_accounts SET current_balance=300 WHERE id=$1`,[bank]);
assert.equal((await call('fn_report_payments',[business,'receivables','2026-09-01','2026-09-30'])).summary.totalOutstanding,600);
assert.equal((await call('fn_report_financial_balance',[business,'2026-09-30'])).assets.current.trade_receivables,600);
const historicalAnalysis=await call('fn_report_analysis',[business,'2026-09-01','2026-09-30']);
assert.equal(historicalAnalysis.outstanding.receivables,600); assert.equal(historicalAnalysis.cashFlow.closingBalance,100);
console.log('PASS historical outstanding/cash rolls back later allocations across reports');
await db.query(`INSERT INTO payments(id,business_id,party_id,payment_number,payment_date,direction,amount,status) VALUES (gen_random_uuid(),$1,$2,'DRAFT','2026-09-12','received',900,'draft'),(gen_random_uuid(),$1,$2,'CANCELLED','2026-09-12','received',900,'cancelled')`,[business,customer]);
assert.equal((await call('fn_report_payments',[business,'all_transactions','2026-09-01','2026-09-30'])).summary.totalReceipts,400);
assert.equal((await call('fn_party_ledger',[business,customer])).ledger.some(x=>['DRAFT','CANCELLED'].includes(x.voucherNo)),false);
console.log('PASS unposted vouchers excluded from reports and ledger');
// Execute under an unprivileged role with tenant RLS, not only SQL WHERE filters.
await db.exec(`CREATE ROLE report_reader; GRANT USAGE ON SCHEMA public TO report_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO report_reader;`);
for (const [name, columns] of tables) {
  if (columns.has('business_id')) await db.exec(`ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_reports ON public.${name} USING (business_id = current_setting('test.business_id')::uuid);`);
}
await db.exec(`SET test.business_id = '${other}'; SET ROLE report_reader;`);
assert.equal((await call('fn_report_payments',[business,'all_transactions','2026-09-01','2026-09-30'])).rows.length,0);
assert.equal((await call('fn_party_ledger',[business,customer])).error,'Party/Worker not found');
await db.exec('RESET ROLE');
console.log('PASS invoker RPCs enforce tenant RLS for a forged business parameter');
await db.exec(`CREATE SCHEMA auth; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE IF NOT EXISTS businesses(id uuid PRIMARY KEY); CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY,business_id uuid,role text);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS id uuid; CREATE UNIQUE INDEX fixture_business_id ON businesses(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS id uuid; ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id uuid; ALTER TABLE users ADD COLUMN IF NOT EXISTS role text; CREATE UNIQUE INDEX fixture_user_id ON users(id);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.user_id',true),'')::uuid $$;
CREATE FUNCTION public.auth_business_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.business_id',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO authenticated;`);
await db.exec(fs.readFileSync('supabase/migrations/20261003000012_report_preferences.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261003000014_report_subscriptions.sql','utf8'));
const owner='60000000-0000-4000-8000-000000000001', anotherOwner='60000000-0000-4000-8000-000000000002';
await db.query('INSERT INTO businesses(id) VALUES ($1),($2)',[business,other]);
await db.query("INSERT INTO users(id,business_id,role) VALUES ($1,$3,'owner'),($2,$3,'staff')",[owner,anotherOwner,business]);
await db.exec(`ALTER TABLE users DISABLE ROW LEVEL SECURITY; GRANT SELECT ON users TO authenticated;`);
await db.exec(`SET test.business_id='${business}'; SET test.user_id='${owner}'; SET ROLE authenticated;`);
await db.query('INSERT INTO report_preferences(business_id,user_id) VALUES ($1,$2)',[business,owner]);
await assert.rejects(db.query('INSERT INTO report_preferences(business_id,user_id) VALUES ($1,$2)',[business,anotherOwner]),error=>error.code==='42501');
await assert.rejects(db.query('INSERT INTO report_preferences(business_id,user_id) VALUES ($1,$2)',[other,owner]),error=>error.code==='42501');
await db.query("INSERT INTO report_subscriptions(business_id,user_id,cadence,next_run_at) VALUES ($1,$2,'daily',now()-interval '1 day')",[business,owner]);
await assert.rejects(db.query('SELECT * FROM claim_report_subscriptions()'),error=>error.code==='42501');
await db.exec(`SET test.user_id='${anotherOwner}';`);
assert.equal((await db.query('SELECT * FROM report_preferences')).rows.length,0);
assert.equal((await db.query('SELECT * FROM report_subscriptions')).rows.length,0);
await assert.rejects(db.query("INSERT INTO report_subscriptions(business_id,user_id,cadence,next_run_at) VALUES ($1,$2,'daily',now())",[business,anotherOwner]),error=>error.code==='42501');
await db.exec('RESET ROLE');
console.log('PASS saved views enforce company and private user RLS');
await db.exec('SET ROLE service_role');
const claimed=(await db.query('SELECT * FROM claim_report_subscriptions()')).rows;
assert.equal(claimed.length,1); assert.ok(claimed[0].lease_id);
assert.equal((await db.query('SELECT * FROM claim_report_subscriptions()')).rows.length,0,'an active lease must prevent concurrent execution');
await db.exec('RESET ROLE');
await db.query("INSERT INTO report_subscription_runs(subscription_id,business_id,user_id,scheduled_for,status,payload) VALUES ($1,$2,$3,now(),'ready','{}'::jsonb)",[claimed[0].id,business,owner]);
await db.exec(`SET test.user_id='${owner}'; SET ROLE authenticated;`);
assert.equal((await db.query('SELECT * FROM report_subscription_runs')).rows.length,1);
await db.exec('RESET ROLE');
await db.query("UPDATE users SET role='staff' WHERE id=$1",[owner]);
await db.exec('SET ROLE authenticated');
assert.equal((await db.query('SELECT * FROM report_subscription_runs')).rows.length,0,'a downgraded recipient must lose snapshot access');
await db.exec('RESET ROLE');
console.log('PASS subscriptions restrict recipients, service-only claims, exclusive leases and revoked-access snapshots');
await db.exec(fs.readFileSync('supabase/migrations/20261003000015_report_exceptions.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261003000016_historical_settlements.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261003000017_balance_settlement_cutoffs.sql','utf8'));
const exceptions=await call('fn_report_exceptions',[business,'2026-09-01','2026-09-30']);
assert.ok(exceptions.counts.missing_sale_cost>=1);
assert.ok(exceptions.counts.overdue_receivable>=1);
assert.equal(exceptions.rows.length,exceptions.total);
await db.query("INSERT INTO sale_bill_items(id,business_id,bill_id,quantity,amount) SELECT gen_random_uuid(),$1,$2,1,10 FROM generate_series(1,120)",[business,bill]);
const manyExceptions=await call('fn_report_exceptions',[business,'2026-09-01','2026-09-30']);
assert.equal(manyExceptions.rows.length,100);assert.equal(manyExceptions.truncated,true);assert.ok(manyExceptions.total>100);
await db.exec('GRANT EXECUTE ON FUNCTION fn_report_exceptions(uuid,date,date) TO report_reader');
await db.exec(`SET test.business_id='${other}'; SET ROLE report_reader;`);
assert.equal((await call('fn_report_exceptions',[business,'2026-09-01','2026-09-30'])).total,0);
await db.exec('RESET ROLE');
console.log('PASS exception centre full counts, bounded drill rows and tenant RLS');
assert.match(fs.readFileSync('src/app/(dashboard)/reports/analysis/page.tsx','utf8'),/<GarmentInsights /);
assert.match(fs.readFileSync('worker.ts','utf8'),/runReportSubscriptionsJob\(\)/);
console.log('PASS garment insights rendering and Worker scheduled report wiring');
await db.query("INSERT INTO write_offs(id,business_id,bill_id,bill_type,amount,written_off_at) VALUES (gen_random_uuid(),$1,$2,'sale_bill',100,'2026-10-02')",[business,bill]);
assert.equal((await db.query("SELECT report_paid_at($1,$2,'sale_bill',500,'2026-09-30') amount",[business,bill])).rows[0].amount*1,200);
await db.query("UPDATE write_offs SET written_off_at='2026-09-02',reversed_at='2026-10-03' WHERE business_id=$1 AND bill_id=$2",[business,bill]);
assert.equal((await db.query("SELECT report_paid_at($1,$2,'sale_bill',400,'2026-09-30') amount",[business,bill])).rows[0].amount*1,300);
console.log('PASS historical write-off posting and later reversal rollback');
await db.exec(fs.readFileSync('supabase/migrations/20261003000018_reviewed_opening_balances.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261003000019_reviewed_balance_position.sql','utf8'));
await db.query("UPDATE users SET role='owner' WHERE id=$1",[owner]);
await db.query("UPDATE users SET role='accountant' WHERE id=$1",[anotherOwner]);
await db.exec(`SET test.business_id='${business}'; SET test.user_id='${owner}'; SET ROLE authenticated;`);
const openingDraft={as_of:'2026-09-30',title:'Verified opening position',notes:'Verified inventory count and depreciation schedule',lines:[
 {kind:'cash',label:'Cash counted',debit:100,credit:0,reference:'Cash count 30/09'},
 {kind:'fixed_assets',label:'Machine original cost',debit:200,credit:0,reference:'Asset register'},
 {kind:'fixed_assets',label:'Accumulated depreciation',debit:0,credit:50,reference:'Depreciation schedule'},
 {kind:'wip',label:'Lot physical count',debit:50,credit:0,quantity:10,unit:'pcs',reference:'Lot count sheet'},
 {kind:'equity',label:'Opening capital',debit:0,credit:300,reference:'Opening trial balance'}]};
const saved=await call('write_report_opening_balance',[business,null,0,'save',JSON.stringify(openingDraft),null]);
assert.equal(saved.status,'draft');assert.equal(saved.version,1);
await assert.rejects(call('write_report_opening_balance',[other,null,0,'save',JSON.stringify(openingDraft),null]),error=>error.code==='42501');
await assert.rejects(call('write_report_opening_balance',[business,saved.id,0,'save',JSON.stringify(openingDraft),null]),error=>error.code==='40001');
const submitted=await call('write_report_opening_balance',[business,saved.id,1,'submit',null,null]);
assert.equal(submitted.status,'submitted');
await assert.rejects(call('write_report_opening_balance',[business,saved.id,2,'approve',null,'Source records verified']),error=>error.code==='42501');
await db.exec(`SET test.user_id='${anotherOwner}';`);
const approved=await call('write_report_opening_balance',[business,saved.id,2,'approve',JSON.stringify({complete_position:true}),'Source records and physical count verified']);
assert.equal(approved.status,'approved');assert.equal(approved.reviewed_by,anotherOwner);
await db.exec(`SET test.user_id='${owner}';`);
await assert.rejects(call('write_report_opening_balance',[business,saved.id,3,'save',JSON.stringify(openingDraft),null]),error=>error.code==='42501');
await assert.rejects(db.query("UPDATE report_opening_balances SET status='draft' WHERE id=$1",[saved.id]),error=>error.code==='42501');
assert.equal((await db.query('SELECT * FROM report_opening_balance_audit WHERE entry_id=$1',[saved.id])).rows.length,3);
await db.exec('RESET ROLE');
const approvedPosition=await call('fn_report_financial_balance',[business,'2026-09-30']);
assert.equal(approvedPosition.assets.total,300);assert.equal(approvedPosition.assets.current.wip,50);assert.equal(approvedPosition.assets.non_current.total,150);assert.equal(approvedPosition.equity,300);assert.equal(approvedPosition.is_balanced,true);
assert.equal(approvedPosition.drill_records.approved_opening.length,5);
assert.equal((await call('fn_report_financial_balance',[business,'2026-10-01'])).metadata.reviewedPositionAvailable,false,'Do not carry WIP forward to another date');
await db.exec(`SET test.business_id='${other}'; SET ROLE authenticated;`);
assert.equal((await db.query('SELECT * FROM report_opening_balances')).rows.length,0);
await db.exec('RESET ROLE');
console.log('PASS reviewed opening workflow, different reviewer, immutable approval, version conflict, audit, exact-date WIP/equity and tenant isolation');
await db.exec(fs.readFileSync('supabase/migrations/20261003000020_reviewed_wip_positions.sql','utf8'));
const wipPositions=await call('fn_report_wip_positions',[business,'2026-10-01','2026-10-31']);
assert.equal(wipPositions.opening_wip,10);assert.equal(wipPositions.opening_value,50);assert.equal(wipPositions.closing_wip,null);
console.log('PASS reviewed WIP exact opening cutoff and unavailable closing position');
await db.exec(fs.readFileSync('supabase/migrations/20261003000021_multiple_report_subscriptions.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261003000022_reviewed_pl_inventory.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261003000023_reviewed_opening_corrections.sql','utf8'));
await db.query("DELETE FROM company_members WHERE user_id IN ($1,$2) AND company_id=$3",[owner,anotherOwner,business]);
await db.query("INSERT INTO company_members(user_id,company_id,role,status) VALUES ($1,$3,'owner','active'),($2,$3,'accountant','active')",[owner,anotherOwner,business]);
await db.exec(fs.readFileSync('supabase/migrations/20261003000024_opening_balances_membership_access.sql','utf8'));
await db.exec(`SET test.business_id='${business}'; SET test.user_id='${owner}'; SET ROLE authenticated;`);
const closingDraft={...openingDraft,as_of:'2026-10-31',title:'Verified closing position',lines:openingDraft.lines.map(line=>line.kind==='wip'?{...line,debit:30,quantity:6}:line.kind==='equity'?{...line,credit:280}:line)};
const closing=await call('write_report_opening_balance',[business,null,0,'save',JSON.stringify(closingDraft),null]);
const closingId=closing?.id || (await db.query("SELECT id FROM report_opening_balances WHERE business_id=$1 AND as_of='2026-10-31' ORDER BY created_at DESC LIMIT 1",[business])).rows[0].id;
await call('write_report_opening_balance',[business,closingId,1,'submit',null,null]);
await db.exec(`SET test.user_id='${anotherOwner}';`);
await call('write_report_opening_balance',[business,closingId,2,'approve',JSON.stringify({complete_position:true}),'Source records and inventory valuation verified']);
await db.exec('RESET ROLE');
const projectedPL=await call('report_financial_pl_projection',[business,'2026-10-01','2026-10-31']);
const reviewedPL=await call('fn_report_financial_pl',[business,'2026-10-01','2026-10-31']);
assert.equal(reviewedPL.metadata.reviewedInventoryApplied,true);assert.equal(reviewedPL.cogs.wip_change,20);
assert.equal(reviewedPL.cogs.total-projectedPL.cogs.total,20);assert.equal(reviewedPL.net_profit-projectedPL.net_profit,-20);
assert.equal((await call('fn_report_financial_pl',[business,'2026-10-01','2026-10-31','pakka'])).metadata.reviewedInventoryApplied,false);
assert.equal((await call('fn_report_analysis',[business,'2026-10-01','2026-10-31'])).financial.netProfit,reviewedPL.net_profit);
await db.exec(`SET test.business_id='${business}'; SET test.user_id='${owner}'; SET ROLE authenticated;`);
const correctionResult=await call('revise_report_opening_balance',[business,approved.id,approved.version]);
const correction=correctionResult?.id ? correctionResult : (await db.query("SELECT * FROM report_opening_balances WHERE supersedes_id=$1 ORDER BY created_at DESC LIMIT 1",[approved.id])).rows[0];
assert.equal(correction.status,'draft');assert.equal(correction.supersedes_id,approved.id);assert.equal(correction.as_of instanceof Date ? correction.as_of.toISOString().slice(0,10) : correction.as_of,approved.as_of);
await assert.rejects(call('revise_report_opening_balance',[business,approved.id,approved.version]),error=>error.code==='23505');
const correctedDraft={...openingDraft,title:'Corrected verified opening position',lines:openingDraft.lines.map(line=>line.kind==='cash'?{...line,debit:110}:line.kind==='equity'?{...line,credit:310}:line)};
const correctedSaved=await call('write_report_opening_balance',[business,correction.id,correction.version,'save',JSON.stringify(correctedDraft),null]);
const correctedVersion=correctedSaved?.version || (await db.query('SELECT version FROM report_opening_balances WHERE id=$1',[correction.id])).rows[0].version;
await call('write_report_opening_balance',[business,correction.id,correctedVersion,'submit',null,null]);
await db.exec(`SET test.user_id='${anotherOwner}';`);
const correctedApproved=await call('write_report_opening_balance',[business,correction.id,correctedVersion+1,'approve',JSON.stringify({complete_position:true}),'Corrected source records independently verified']);
assert.equal(correctedApproved?.status || (await db.query('SELECT status FROM report_opening_balances WHERE id=$1',[correction.id])).rows[0].status,'approved');
await db.exec('RESET ROLE');
const replaced=(await db.query('SELECT status,superseded_by_id FROM report_opening_balances WHERE id=$1',[approved.id])).rows[0];
assert.equal(replaced.status,'superseded');assert.equal(replaced.superseded_by_id,correction.id);
assert.equal((await call('fn_report_financial_balance',[business,'2026-09-30'])).assets.current.cash_in_hand,110);
console.log('PASS approved position controlled correction, independent re-review and immutable supersession');
for(const name of names){const rows=(await db.query('SELECT provolatile,prosecdef FROM pg_proc WHERE proname=$1',[name])).rows;assert.ok(rows.every(row=>row.provolatile==='s'&&!row.prosecdef));}
console.log('PASS approved boundary WIP valuation, P&L/Analysis consistency, bill-type scope and six STABLE/invoker report functions');
await db.close();
