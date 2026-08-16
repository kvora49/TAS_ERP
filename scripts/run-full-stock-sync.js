const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  for (const envPath of envPaths) {
    const fullPath = path.resolve(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
      break;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local / .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=================================================");
  console.log("🚀 STARTING FULL STOCK INTEGRITY SYNC & AUDIT");
  console.log("=================================================\n");

  // 1. Get all businesses
  const { data: businesses, error: bErr } = await supabase
    .from('businesses')
    .select('id, name');

  if (bErr || !businesses || businesses.length === 0) {
    console.error("No businesses found or error:", bErr);
    return;
  }

  console.log(`Found ${businesses.length} active business(es):`);
  businesses.forEach(b => console.log(` • [${b.id}] ${b.name}`));

  for (const b of businesses) {
    console.log(`\n-------------------------------------------------`);
    console.log(`🏢 Processing Business: "${b.name}" (${b.id})`);
    console.log(`-------------------------------------------------`);

    // A. Run Finished Stock Reconciliation
    console.log(`\n1️⃣  Running Ground-Truth Finished Stock Reconciliation...`);
    
    // We import directly or implement using the updated logic
    // Let's dynamically require the compiled or source logic, or run the TS module via dynamic execution
    try {
      // 1. Fetch godowns
      const { data: godowns } = await supabase
        .from("godowns")
        .select("id, name")
        .eq("business_id", b.id)
        .is("deleted_at", null);
      const defaultGodownId = godowns && godowns.length > 0 ? godowns[0].id : null;
      console.log(`   - Found ${godowns ? godowns.length : 0} godowns. Default godown: ${defaultGodownId}`);

      // 2. Production Lots
      const { data: productionLots } = await supabase
        .from("production_lots")
        .select("id, design_id, colour_id, status, godown_id, accessory_cost, other_cost, lot_size_quantities(*)")
        .eq("business_id", b.id)
        .is("deleted_at", null)
        .eq("status", "completed");
      console.log(`   - Completed Production Lots: ${productionLots ? productionLots.length : 0}`);

      // 3. FG Purchases
      const { data: fgPurchases } = await supabase
        .from("raw_material_purchase_items")
        .select("id, purchase_id, design_id, colour_id, size_quantities, quantity, rate, amount, taxable_value, item_type, purchase:raw_material_purchases(godown_id, status)")
        .eq("business_id", b.id)
        .eq("item_type", "finished_goods");
      console.log(`   - FG Purchase Items: ${fgPurchases ? fgPurchases.length : 0}`);

      // 4. FG Purchase Returns
      const { data: fgReturns } = await supabase
        .from("purchase_return_items")
        .select("id, return_id, design_id, colour_id, size_quantities, returned_qty, rate, taxable_value, item_type, purchase_return:purchase_returns(godown_id, purchase_id, status)")
        .eq("business_id", b.id)
        .eq("item_type", "finished_goods");
      console.log(`   - FG Purchase Return Items: ${fgReturns ? fgReturns.length : 0}`);

      // 5. Sales Bills Items
      const { data: salesBills } = await supabase
        .from("sale_bill_items")
        .select("id, bill_id, design_id, colour_id, size, quantity, rate, amount, bill:sale_bills(status, deleted_at, is_temporary, godown_id)")
        .eq("business_id", b.id);
      console.log(`   - Sale Bill Items: ${salesBills ? salesBills.length : 0}`);

      // 6. Sales Returns Items
      const { data: salesReturns } = await supabase
        .from("sales_return_items")
        .select("id, return_id, design_id, colour_id, size, size_quantities, returned_qty, unit_rate, amount, sales_return:sales_returns(status, godown_id)")
        .eq("business_id", b.id);
      console.log(`   - Sales Return Items: ${salesReturns ? salesReturns.length : 0}`);

      // 7. Adjustments
      const { data: adjustments } = await supabase
        .from("stock_adjustments")
        .select("*")
        .eq("business_id", b.id)
        .is("deleted_at", null);
      console.log(`   - Stock Adjustments: ${adjustments ? adjustments.length : 0}`);

      // 8. Transfers
      const { data: stockTransfers } = await supabase
        .from("stock_transfer_items")
        .select("id, transfer_id, design_id, colour_id, size, quantity, unit_cost, total_value, transfer:stock_transfers(from_godown_id, to_godown_id, status)")
        .eq("business_id", b.id);
      console.log(`   - Stock Transfers: ${stockTransfers ? stockTransfers.length : 0}`);

      // 9. Challans
      const { data: challanItems } = await supabase
        .from("challan_items")
        .select("id, challan_id, design_id, colour_id, size, quantity, unit_cost, total_value, challan:challans(from_godown_id, status)")
        .eq("business_id", b.id);
      console.log(`   - Outward Challans: ${challanItems ? challanItems.length : 0}`);

      // Build stockMap
      const stockMap = new Map();
      const getKey = (gId, dId, cId) => `${gId}:${dId}:${cId || 'null'}`;
      const getOrCreate = (gId, dId, cId, rate = 0) => {
        const key = getKey(gId, dId, cId);
        if (stockMap.has(key)) return stockMap.get(key);
        const created = {
          godownId: gId,
          designId: dId,
          colourId: cId,
          sizeQuantities: {},
          totalQuantity: 0,
          totalValue: 0,
          costPerPiece: rate,
        };
        stockMap.set(key, created);
        return created;
      };

      // A. Production Lots
      (productionLots || []).forEach(lot => {
        if (lot.status === 'cancelled') return;
        const gId = lot.godown_id || defaultGodownId;
        const dId = lot.design_id;
        if (!gId || !dId) return;
        const sizeRows = lot.lot_size_quantities || [];
        const colMap = new Map();
        sizeRows.forEach(sr => {
          const cId = sr.colour_id || lot.colour_id || null;
          if (!colMap.has(cId)) colMap.set(cId, []);
          colMap.get(cId).push(sr);
        });
        colMap.forEach((sizes, cId) => {
          const existing = getOrCreate(gId, dId, cId);
          sizes.forEach(sr => {
            const sz = sr.size;
            const q = Number(sr.quantity || 0);
            if (q > 0) {
              existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + q;
              existing.totalQuantity += q;
            }
          });
        });
      });

      // B. Purchases
      (fgPurchases || []).forEach(item => {
        if (item.purchase?.status === 'cancelled') return;
        const gId = item.purchase?.godown_id || defaultGodownId;
        const dId = item.design_id;
        const cId = item.colour_id || null;
        if (!gId || !dId) return;
        const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
        const sq = item.size_quantities || {};
        Object.entries(sq).forEach(([sz, q]) => {
          const numQ = Number(q || 0);
          existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + numQ;
        });
        const qty = Number(item.quantity || 0);
        const val = Number(item.taxable_value || (qty * Number(item.rate || 0)));
        existing.totalQuantity += qty;
        existing.totalValue += val;
      });

      // C. Adjustments
      (adjustments || []).forEach(adj => {
        const gId = adj.godown_id || defaultGodownId;
        const dId = adj.design_id;
        const cId = adj.colour_id || null;
        if (!gId || !dId) return;
        const existing = getOrCreate(gId, dId, cId, Number(adj.unit_cost || 0));
        const sz = adj.size;
        const change = Number(adj.quantity_change || 0);
        if (sz && sz !== 'all' && sz !== '—') {
          existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) + change);
        }
        existing.totalQuantity = Math.max(0, existing.totalQuantity + change);
        existing.totalValue = Math.max(0, existing.totalValue + Number(adj.value_impact || 0));
      });

      // D. Purchase Returns
      (fgReturns || []).forEach(item => {
        if (item.purchase_return?.status === 'cancelled') return;
        const gId = item.purchase_return?.godown_id || defaultGodownId;
        const dId = item.design_id;
        const cId = item.colour_id || null;
        if (!gId || !dId) return;
        const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
        const sq = item.size_quantities || {};
        Object.entries(sq).forEach(([sz, q]) => {
          const numQ = Math.abs(Number(q || 0));
          existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - numQ);
        });
        const qty = Math.abs(Number(item.returned_qty || 0));
        existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
      });

      // E. Sales Bills (using bill.godown_id!)
      (salesBills || []).forEach(item => {
        if (item.bill?.status === 'cancelled' || item.bill?.deleted_at || item.bill?.is_temporary) return;
        const gId = item.bill?.godown_id || defaultGodownId;
        const dId = item.design_id;
        const cId = item.colour_id || null;
        if (!gId || !dId) return;
        const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
        const qty = Math.abs(Number(item.quantity || 0));
        const sz = item.size;
        if (sz && sz !== 'all' && sz !== '—') {
          existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - qty);
        } else if (item.size_quantities && typeof item.size_quantities === 'object') {
          Object.entries(item.size_quantities).forEach(([sKey, q]) => {
            const numQ = Math.abs(Number(q || 0));
            existing.sizeQuantities[sKey] = Math.max(0, (existing.sizeQuantities[sKey] || 0) - numQ);
          });
        }
        existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
      });

      // F. Sales Returns (using return.godown_id!)
      (salesReturns || []).forEach(item => {
        if (item.sales_return?.status === 'cancelled' || item.sales_return?.status === 'rejected') return;
        const gId = item.sales_return?.godown_id || defaultGodownId;
        const dId = item.design_id;
        const cId = item.colour_id || null;
        if (!gId || !dId) return;
        const existing = getOrCreate(gId, dId, cId, Number(item.unit_rate || item.rate || 0));
        const qty = Math.abs(Number(item.returned_qty || item.quantity || 0));
        const sz = item.size;
        if (sz && sz !== 'all' && sz !== '—') {
          existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + qty;
        } else if (item.size_quantities && typeof item.size_quantities === 'object') {
          Object.entries(item.size_quantities).forEach(([sKey, q]) => {
            const numQ = Math.abs(Number(q || 0));
            existing.sizeQuantities[sKey] = (existing.sizeQuantities[sKey] || 0) + numQ;
          });
        }
        existing.totalQuantity += qty;
      });

      // G. Transfers
      (stockTransfers || []).forEach(item => {
        if (item.transfer?.status === 'cancelled') return;
        const fromGId = item.transfer?.from_godown_id;
        const toGId = item.transfer?.to_godown_id;
        const dId = item.design_id;
        const cId = item.colour_id || null;
        if (!dId) return;
        const qty = Math.abs(Number(item.quantity || 0));
        const sz = item.size;
        if (fromGId) {
          const sourceEst = getOrCreate(fromGId, dId, cId, Number(item.unit_cost || 0));
          if (sz && sz !== 'all' && sz !== '—') {
            sourceEst.sizeQuantities[sz] = Math.max(0, (sourceEst.sizeQuantities[sz] || 0) - qty);
          }
          sourceEst.totalQuantity = Math.max(0, sourceEst.totalQuantity - qty);
        }
        if (toGId && item.transfer?.status === 'completed') {
          const targetEst = getOrCreate(toGId, dId, cId, Number(item.unit_cost || 0));
          if (sz && sz !== 'all' && sz !== '—') {
            targetEst.sizeQuantities[sz] = (targetEst.sizeQuantities[sz] || 0) + qty;
          }
          targetEst.totalQuantity += qty;
        }
      });

      // H. Challans
      (challanItems || []).forEach(item => {
        if (item.challan?.status === 'cancelled') return;
        const fromGId = item.challan?.from_godown_id || defaultGodownId;
        const dId = item.design_id;
        const cId = item.colour_id || null;
        if (!fromGId || !dId) return;
        const existing = getOrCreate(fromGId, dId, cId, Number(item.unit_cost || 0));
        const qty = Math.abs(Number(item.quantity || 0));
        const sz = item.size;
        if (sz && sz !== 'all' && sz !== '—') {
          existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - qty);
        }
        existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
      });

      // Clear & Insert
      await supabase.from('finished_stock').delete().eq('business_id', b.id);

      // Costing maps
      const { data: designPrices } = await supabase
        .from("designs")
        .select("id, sale_price")
        .eq("business_id", b.id);
      const { data: designCostings } = await supabase
        .from("design_costings")
        .select("design_id, total_cost_per_piece")
        .eq("business_id", b.id)
        .eq("is_active", true);

      const priceMap = new Map((designPrices || []).map(d => [d.id, Number(d.sale_price || 0)]));
      const bomCostMap = new Map((designCostings || []).map(c => [c.design_id, Number(c.total_cost_per_piece || 0)]));

      let totalInserted = 0;
      let totalPcs = 0;
      let totalVal = 0;

      for (const [key, stockData] of stockMap.entries()) {
        if (stockData.totalQuantity <= 0 && stockData.totalValue <= 0) continue;

        let unitCost = stockData.costPerPiece;
        if (unitCost <= 0 && stockData.totalQuantity > 0 && stockData.totalValue > 0) {
          unitCost = Number((stockData.totalValue / stockData.totalQuantity).toFixed(2));
        }
        if (unitCost <= 0) {
          const bomCost = bomCostMap.get(stockData.designId) || 0;
          if (bomCost > 0) {
            unitCost = bomCost;
          } else {
            const salePrice = priceMap.get(stockData.designId) || 0;
            unitCost = salePrice > 0 ? Math.round(salePrice * 0.6) : 150;
          }
        }

        const computedVal = stockData.totalValue > 0
          ? Math.max(0, Number(stockData.totalValue.toFixed(2)))
          : Math.max(0, Number((stockData.totalQuantity * unitCost).toFixed(2)));

        await supabase.from('finished_stock').insert({
          business_id: b.id,
          design_id: stockData.designId,
          colour_id: stockData.colourId,
          godown_id: stockData.godownId,
          entry_type: 'manual',
          size_quantities: stockData.sizeQuantities,
          total_quantity: Math.max(0, Math.round(stockData.totalQuantity)),
          cost_per_piece: Number(unitCost.toFixed(2)),
          total_value: computedVal,
        });

        totalInserted++;
        totalPcs += Math.max(0, Math.round(stockData.totalQuantity));
        totalVal += computedVal;
      }

      console.log(`   ✅ Finished Stock Reconciled: ${totalInserted} rows generated (${totalPcs} total pcs, ₹${totalVal.toFixed(2)} valuation).`);

      // B. Run Watchdog Audit
      console.log(`\n2️⃣  Running Stock Integrity Watchdog Audit...`);

      // Read current stock
      const { data: fsRows } = await supabase
        .from('finished_stock')
        .select('design_id, colour_id, godown_id, total_quantity')
        .eq('business_id', b.id);

      const fsMapByDesignGodown = new Map();
      for (const row of fsRows || []) {
        const key = `${row.design_id}:${row.godown_id}`;
        fsMapByDesignGodown.set(key, (fsMapByDesignGodown.get(key) || 0) + Number(row.total_quantity || 0));
      }

      // Read ledger
      const { data: ledgerRows } = await supabase
        .from('stock_ledger')
        .select('item_id, godown_id, quantity_delta, transaction_type')
        .eq('business_id', b.id)
        .eq('item_type', 'finished_good');

      const ledgerMap = new Map();
      for (const row of ledgerRows || []) {
        const key = `${row.item_id}:${row.godown_id}`;
        ledgerMap.set(key, (ledgerMap.get(key) || 0) + Number(row.quantity_delta || 0));
      }

      const discrepancies = [];
      const allKeys = new Set([...fsMapByDesignGodown.keys(), ...ledgerMap.keys()]);

      for (const key of allKeys) {
        const [designId, godownId] = key.split(':');
        const fsQty = Math.round(fsMapByDesignGodown.get(key) || 0);
        const ledgerQty = Math.max(0, Math.round(ledgerMap.get(key) || 0));
        const diff = fsQty - ledgerQty;

        if (Math.abs(diff) > 1) {
          discrepancies.push({
            design_id: designId,
            godown_id: godownId,
            finished_stock_qty: fsQty,
            ledger_net_qty: ledgerQty,
            difference: diff,
            hint: diff > 0 ? "finished_stock higher than ledger" : "finished_stock lower than ledger"
          });
        }
      }

      if (discrepancies.length === 0) {
        console.log(`   ✅ WATCHDOG RESULT: Perfect Stock Integrity! 0 discrepancies found.`);
      } else {
        console.log(`   ⚠️  WATCHDOG RESULT: Found ${discrepancies.length} discrepancy(s):`);
        discrepancies.forEach((d, idx) => {
          console.log(`     ${idx + 1}. Design [${d.design_id}] | Godown [${d.godown_id}]: Stock=${d.finished_stock_qty} pcs, Ledger=${d.ledger_net_qty} pcs, Diff=${d.difference > 0 ? '+' : ''}${d.difference} pcs (${d.hint})`);
        });
      }

      // Log into stock_integrity_logs
      await supabase.from('stock_integrity_logs').insert({
        business_id: b.id,
        scope: 'full',
        discrepancies_found: discrepancies.length,
        discrepancies_fixed: 0,
        discrepancies_unresolved: discrepancies.length,
        details: discrepancies,
      });

    } catch (err) {
      console.error(`Error processing business ${b.name}:`, err);
    }
  }

  console.log(`\n=================================================`);
  console.log(`✅ FULL STOCK SYNC & AUDIT COMPLETE`);
  console.log(`=================================================`);
}

run().catch(console.error);
