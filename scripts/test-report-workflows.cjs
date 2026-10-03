const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const cache = new Map();
function load(relative) {
  const filename = path.resolve('src', relative + '.ts');
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(process.cwd());
  cache.set(filename, m);
  m.require = name => name === '@/lib/supabase/admin' ? {createAdminClient: () => {throw new Error('Tests must supply client');}} : name.startsWith('@/') ? load(name.slice(2)) : Module.prototype.require.call(m, name);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, filename);
  return m.exports;
}
const {subscriptionSchema,scheduledReportRPC,reportSnapshotSheets}=load('lib/report-snapshot');
assert.equal(subscriptionSchema.safeParse({cadence:'daily',enabled:true,report_key:'ledger'}).success,false);
for(const key of ['analysis','payments','pl','balance','stock'])assert.ok(scheduledReportRPC(key,'company','2026-09-01','2026-09-30').name.startsWith('fn_'));
assert.throws(()=>scheduledReportRPC('unexpected','company','2026-09-01','2026-09-30'));
const completeSheets=reportSnapshotSheets({total:12,rows:[{a:1},{b:2}],drill:{nested:[{source:{id:'record'}}]}});
assert.equal(completeSheets[1].columns.length,2);assert.equal(completeSheets[2].rows[0].source,'{"id":"record"}');
console.log('PASS scheduled report scopes and complete variable-column/nested snapshot export');
const {UpdatePurchaseBillSchema}=load('lib/schemas/purchases');
assert.equal(UpdatePurchaseBillSchema.parse({bill_type:'pakka'}).paid_amount,undefined,'Source correction must not reset invoice paid amount');
console.log('PASS purchase source correction preserves existing settlements');
const {sourceDate, recordedTaxFields, manualNoteSchema} = load('lib/report-source-fields');
assert.equal(sourceDate.safeParse('2026-02-30').success, false);
assert.equal(sourceDate.safeParse('2028-02-29').success, true);
assert.deepEqual(recordedTaxFields({cgst:0}), {taxable_amount:null,cgst:0,sgst:null,igst:null});
const note = {party_id:'60000000-0000-4000-8000-000000000001',cn_date:'2026-10-03',amount:118,taxable_amount:100,cgst:9,sgst:9,igst:0};
assert.equal(manualNoteSchema.safeParse(note).success,true);
assert.equal(manualNoteSchema.safeParse({...note,cgst:99}).success,false);
assert.equal(manualNoteSchema.safeParse({...note,cgst:-1}).success,false);
const {openingTotals,openingDraftSchema,openingActionSchema}=load('lib/report-opening-balances');
assert.equal(openingDraftSchema.safeParse({as_of:'2026-10-03',title:'Trial balance',notes:'',lines:[{kind:'cash',label:'Cash',debit:1,credit:1,reference:'Count'}]}).success,false);
assert.equal(openingTotals([{debit:0.1,credit:0.3},{debit:0.2,credit:0}]).difference,0);
assert.equal(openingActionSchema.safeParse({id:'60000000-0000-4000-8000-000000000001',version:2,action:'approve',review_note:'Sources verified'}).success,false);
console.log('PASS opening source validation, rounded trial balance and explicit completeness confirmation');
console.log('PASS recorded tax validation preserves unknown versus zero and rejects inconsistent amounts');

function chain(result, operations = []) {
  const query = new Proxy({}, {get:(_, key) => key === 'then' ? (ok, fail) => Promise.resolve(result).then(ok, fail) : (...args) => {operations.push([key,...args]); return query;}});
  return query;
}
(async () => {
  const {readLaterAllocations} = load('lib/report-later-allocations');
  const operations=[];
  const duplicated={id:'same',bill_id:'bill',bill_type:'sale_bill',allocated_amount:10};
  let index=0;
  const later = await readLaterAllocations({from:table => table === "write_offs" ? chain({data:[],error:null},operations) : chain({data:index++ === 0 ? [duplicated] : [duplicated,{id:'backdated',allocated_amount:20}],error:null},operations)},'company','2026-09-30');
  assert.equal(later.length,2);
  assert.ok(operations.some(op=>op[0]==='gt'&&op[1]==='payment.payment_date'));
  assert.ok(operations.some(op=>op[0]==='gte'&&op[1]==='created_at'&&op[2]==='2026-10-01T00:00:00.000Z'));
  console.log('PASS later allocations include backdated entries and deduplicate overlapping pages');

  const {runReportSubscriptionsJob} = load('lib/cron/report-subscriptions');
  const writes=[],queries=[];
  const job={id:'subscription',user_id:'user',business_id:'company',lease_id:'lease',cadence:'daily',next_run_at:'2026-10-03T03:30:00Z'};
  const client={
    rpc:async name=>name==='claim_report_subscriptions'?{data:[job],error:null}:{data:null,error:{message:'PRIVATE SQL ERROR'}},
    from:table=>{
      if(table==='users')return chain({data:{id:'user',business_id:'company',role:'owner'},error:null});
      const operations=[];queries.push({table,operations});
      const q=chain({data:table==='report_subscription_runs'?[{id:'expired'}]:[],error:null},operations);
      return new Proxy(q,{get:(target,key)=>key==='upsert'?payload=>{writes.push(payload);return chain({error:null});}:target[key]});
    },
  };
  const result=await runReportSubscriptionsJob(client,new Date('2026-10-03T04:00:00Z'));
  assert.deepEqual(result,{ready:0,failed:1,expiredRemoved:1});
  assert.equal(writes[0].error,'Report generation failed');assert.equal(writes[0].payload,null);
  const cleanup=queries.find(q=>q.operations.some(op=>op[0]==='delete'));
  assert.ok(cleanup.operations.some(op=>op[0]==='lte'&&op[1]==='expires_at'));
  assert.ok(queries.some(q=>q.operations.some(op=>op[0]==='limit'&&op[1]===100)));
  console.log('PASS scheduler bounded retention, failed snapshot privacy and schedule advancement');
})().catch(error=>{console.error(error);process.exitCode=1;});
