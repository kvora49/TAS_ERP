const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
function load(name) {
  const file = path.resolve(`src/lib/${name}.ts`);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const child = new Module(file, module); child.filename = file; child.paths = Module._nodeModulePaths(process.cwd());
  child.require = name => name === '@/lib/delivery-challan' ? model : require(name);
  child._compile(code, file); return child.exports;
}
const model = load('delivery-challan');
const bill = { id: 'bill', bill_number: 'INV-2026-1001', bill_date: '2026-10-01', party: { name: 'Amit Shah', company_name: 'Customer Apparel Pvt Ltd', billing_address_line1: 'Billing office, Mumbai', shipping_address_line1: 'Warehouse 4, Industrial Estate', shipping_city: 'Pune', shipping_pincode: '411001' } };
const company = { name: 'Sample Apparel Pvt Ltd', address: '12 Textile Road, Mumbai, Maharashtra 400001', gstin: '27AAAAA0000A1Z5', phone: '9000000000', email: 'dispatch@example.com' };
const items = [{ id: 'fabric', item_type: 'fabric', item_name: 'Premium denim fabric', quantity: 125.5 }, { id: 'jeans', item_type: 'finished_goods', design: { name: 'Classic fit jeans', design_number: 'JN-104' }, colour: { colour_name: 'Indigo' }, quantity: 24, size_quantities: { 28: 4, 30: 8, 32: 8, 34: 4 } }];
const rolls = [{ id: 'r1', sale_item_id: 'fabric', roll_number: 'R-001', meters: 60, width: 58, shade: 'Dark indigo' }, { id: 'r2', sale_item_id: 'fabric', roll_number: 'R-002', meters: 65.5, width: 58, shade: 'Dark indigo' }];
const draft = model.buildDeliveryDocument(bill, company, items, rolls);
assert.equal(draft.rows.length, 6);
assert.equal(draft.rows[0].serial, 'R-001');
assert.equal(draft.rows[0].weight, null, 'do not invent shipment weight from roll meters');
assert.equal(draft.shippingAddress, 'Warehouse 4, Industrial Estate, Pune, 411001');
assert.equal(model.deliveryTotals(draft.rows), '125.5 m / 24 pcs');
const input = { sourceUpdatedAt: null, date: '2026-10-03', shippingName: 'Dispatch Warehouse', shippingAddress: 'Separate destination, Pune 411002', transporter: 'Sample Transport', vehicle: 'MH12AB1234', lrNumber: 'LR-555', notes: 'Deliver to receiving desk. Handle rolls carefully.', details: draft.rows.map(row => ({ key: row.key, serial: row.serial, weight: row.kind === 'roll' ? 22.5 : null, width: row.width, quality: row.kind === 'roll' ? 'A grade / 12 oz' : 'First quality' })) };
const result = model.finalizeDeliveryDocument(draft, model.deliveryChallanInput.parse(input));
assert.equal(result.customer.address, 'Billing office, Mumbai');
assert.equal(result.shippingAddress, input.shippingAddress);
assert.equal(result.rows[0].weight, 22.5);
assert.equal(result.rows[0].quantity, 60);
assert.equal(model.buildDeliveryDocument({ ...bill, party: { name: 'Customer', billing_address_line1: 'Billing only' } }, company, items, rolls).shippingAddress, '');
assert.throws(() => model.finalizeDeliveryDocument(draft, { ...input, details: input.details.slice(1) }), /changed/);
assert.throws(() => model.finalizeDeliveryDocument(draft, { ...input, date: '2026-09-30' }), /before/);
assert.throws(() => model.buildDeliveryDocument(bill, company, items, [{ ...rolls[0], meters: 1 }, rolls[1]]), /Roll meters/);
assert.throws(() => model.buildDeliveryDocument(bill, company, [{ ...items[1], quantity: 10 }], []), /Size quantities/);
assert.equal(model.deliveryChallanInput.safeParse({ ...input, details: [{ ...input.details[0], quantity: 999 }] }).success, false);
assert.equal(model.deliveryChallanInput.safeParse({ ...input, date: '2026-02-30' }).success, false);
console.log('PASS roll meters, garment sizes, separate shipping, unit totals, unknown weight and tampered/stale inputs');
const { buildDeliveryChallanPdf } = load('pdf/delivery-challan');
const compact = buildDeliveryChallanPdf(result);
assert.equal(compact.getNumberOfPages(), 1);
const long = buildDeliveryChallanPdf({ ...result, rows: Array.from({ length: 90 }, (_, i) => ({ ...result.rows[i % result.rows.length], key: `row-${i}`, name: 'Extended item description for multi-page pagination and wrapping checks' })) });
assert.ok(long.getNumberOfPages() > 1);
assert.match(compact.output(), /Customer signature/);
if (process.argv.includes('--render-fixtures')) {
  fs.mkdirSync('scratch/challan-qa', { recursive: true });
  fs.writeFileSync('scratch/challan-qa/compact.pdf', Buffer.from(compact.output('arraybuffer')));
  fs.writeFileSync('scratch/challan-qa/multipage.pdf', Buffer.from(long.output('arraybuffer')));
}
console.log(`PASS compact A4 PDF (1 page), long PDF (${long.getNumberOfPages()} pages), signature and shipping output`);
