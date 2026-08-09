const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runReconciliation(businessId) {
  console.log(`\nReconciling finished stock for business: ${businessId}...`);

  // 1. Fetch godowns
  const { data: godowns } = await supabase
    .from("godowns")
    .select("id, name")
    .eq("business_id", businessId)
    .is("deleted_at", null);
  const defaultGodownId = godowns && godowns.length > 0 ? godowns[0].id : null;

  // 2. Fetch completed production lots
  const { data: productionLots } = await supabase
    .from("production_lots")
    .select("id, design_id, colour_id, status, accessory_cost, other_cost, lot_size_quantities(*)")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .eq("status", "completed");

  // 3. Fetch finished goods purchases
  const { data: fgPurchases } = await supabase
    .from("raw_material_purchase_items")
    .select("id, purchase_id, design_id, colour_id, size_quantities, quantity, rate, amount, taxable_value, item_type, purchase:raw_material_purchases(godown_id, status)")
    .eq("business_id", businessId)
    .eq("item_type", "finished_goods");

  // 4. Fetch finished goods purchase returns
  const { data: fgReturns } = await supabase
    .from("purchase_return_items")
    .select("id, return_id, design_id, colour_id, size_quantities, returned_qty, rate, taxable_value, item_type, purchase_return:purchase_returns(godown_id, purchase_id, status)")
    .eq("business_id", businessId)
    .eq("item_type", "finished_goods");

  // 5. Fetch active sale bill items
  const { data: salesBills } = await supabase
    .from("sale_bill_items")
    .select("id, bill_id, design_id, colour_id, size, quantity, rate, amount, bill:sale_bills(status, deleted_at, is_temporary)")
    .eq("business_id", businessId);

  // 6. Fetch active sale return items
  const { data: salesReturns } = await supabase
    .from("sales_return_items")
    .select("id, return_id, design_id, colour_id, size, size_quantities, returned_qty, quantity, unit_rate, rate, amount, sales_return:sales_returns(status)")
    .eq("business_id", businessId);

  // 7. Fetch stock adjustments
  const { data: adjustments } = await supabase
    .from("stock_adjustments")
    .select("*")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  // 8. Fetch stock transfers
  const { data: stockTransfers } = await supabase
    .from("stock_transfer_items")
    .select("id, transfer_id, design_id, colour_id, size, quantity, unit_cost, total_value, transfer:stock_transfers(from_godown_id, to_godown_id, status)")
    .eq("business_id", businessId);

  // 9. Fetch challans
  const { data: challanItems } = await supabase
    .from("challan_items")
    .select("id, challan_id, design_id, colour_id, size, quantity, unit_cost, total_value, challan:challans(from_godown_id, status)")
    .eq("business_id", businessId);

  const stockMap = new Map();
  const getKey = (gId, dId, cId) => `${gId}:${dId}:${cId || "null"}`;

  const getOrCreate = (gId, dId, cId, rate = 0) => {
    const key = getKey(gId, dId, cId);
    const found = stockMap.get(key);
    if (found) return found;
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

  // A. Completed Lots
  (productionLots || []).forEach((lot) => {
    const gId = defaultGodownId;
    const dId = lot.design_id;
    if (!gId || !dId) return;

    const sizeRows = lot.lot_size_quantities || [];
    if (sizeRows.length === 0) return;

    const colMap = new Map();
    sizeRows.forEach((sr) => {
      const cId = sr.colour_id || lot.colour_id || null;
      if (!colMap.has(cId)) colMap.set(cId, []);
      colMap.get(cId).push(sr);
    });

    colMap.forEach((sizes, cId) => {
      const existing = getOrCreate(gId, dId, cId);
      sizes.forEach((sr) => {
        const sz = sr.size;
        const q = Number(sr.quantity || 0);
        if (q > 0) {
          existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + q;
          existing.totalQuantity += q;
        }
      });
    });
  });

  // B. FG Purchases
  (fgPurchases || []).forEach((item) => {
    if (item.purchase?.status === "cancelled") return;
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
  (adjustments || []).forEach((adj) => {
    const gId = adj.godown_id || defaultGodownId;
    const dId = adj.design_id;
    const cId = adj.colour_id || null;
    if (!gId || !dId) return;

    const existing = getOrCreate(gId, dId, cId, Number(adj.unit_cost || 0));
    const sz = adj.size;
    const change = Number(adj.quantity_change || 0);

    if (sz && sz !== "all" && sz !== "—") {
      existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) + change);
    }
    existing.totalQuantity = Math.max(0, existing.totalQuantity + change);
    existing.totalValue = Math.max(0, existing.totalValue + Number(adj.value_impact || 0));
  });

  // D. FG Returns
  (fgReturns || []).forEach((item) => {
    if (item.purchase_return?.status === "cancelled") return;
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

  // E. Sales Bills (-)
  (salesBills || []).forEach((item) => {
    if (item.bill?.status === "cancelled" || item.bill?.deleted_at || item.bill?.is_temporary) return;
    const gId = defaultGodownId;
    const dId = item.design_id;
    const cId = item.colour_id || null;
    if (!gId || !dId) return;

    const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
    const qty = Math.abs(Number(item.quantity || 0));

    const sz = item.size;
    if (sz && sz !== "all" && sz !== "—") {
      existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - qty);
    } else if (item.size_quantities && typeof item.size_quantities === "object") {
      Object.entries(item.size_quantities).forEach(([sKey, q]) => {
        const numQ = Math.abs(Number(q || 0));
        existing.sizeQuantities[sKey] = Math.max(0, (existing.sizeQuantities[sKey] || 0) - numQ);
      });
    }
    existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
  });

  // F. Sales Returns (+)
  (salesReturns || []).forEach((item) => {
    if (item.sales_return?.status === "cancelled" || item.sales_return?.status === "rejected") return;
    const gId = defaultGodownId;
    const dId = item.design_id;
    const cId = item.colour_id || null;
    if (!gId || !dId) return;

    const existing = getOrCreate(gId, dId, cId, Number(item.unit_rate || item.rate || 0));
    const qty = Math.abs(Number(item.returned_qty || item.quantity || 0));

    const sz = item.size;
    if (sz && sz !== "all" && sz !== "—") {
      existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + qty;
    } else if (item.size_quantities && typeof item.size_quantities === "object") {
      Object.entries(item.size_quantities).forEach(([sKey, q]) => {
        const numQ = Math.abs(Number(q || 0));
        existing.sizeQuantities[sKey] = (existing.sizeQuantities[sKey] || 0) + numQ;
      });
    }
    existing.totalQuantity += qty;
  });

  // G. Stock Transfers
  (stockTransfers || []).forEach((item) => {
    if (item.transfer?.status === "cancelled") return;
    const fromGId = item.transfer?.from_godown_id;
    const toGId = item.transfer?.to_godown_id;
    const dId = item.design_id;
    const cId = item.colour_id || null;
    if (!dId) return;

    const qty = Math.abs(Number(item.quantity || 0));
    const sz = item.size;

    if (fromGId) {
      const sourceEst = getOrCreate(fromGId, dId, cId, Number(item.unit_cost || 0));
      if (sz && sz !== "all" && sz !== "—") {
        sourceEst.sizeQuantities[sz] = Math.max(0, (sourceEst.sizeQuantities[sz] || 0) - qty);
      }
      sourceEst.totalQuantity = Math.max(0, sourceEst.totalQuantity - qty);
    }
    if (toGId) {
      const targetEst = getOrCreate(toGId, dId, cId, Number(item.unit_cost || 0));
      if (sz && sz !== "all" && sz !== "—") {
        targetEst.sizeQuantities[sz] = (targetEst.sizeQuantities[sz] || 0) + qty;
      }
      targetEst.totalQuantity += qty;
    }
  });

  // H. Challans
  (challanItems || []).forEach((item) => {
    if (item.challan?.status === "cancelled") return;
    const fromGId = item.challan?.from_godown_id || defaultGodownId;
    const dId = item.design_id;
    const cId = item.colour_id || null;
    if (!fromGId || !dId) return;

    const existing = getOrCreate(fromGId, dId, cId, Number(item.unit_cost || 0));
    const qty = Math.abs(Number(item.quantity || 0));
    const sz = item.size;

    if (sz && sz !== "all" && sz !== "—") {
      existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - qty);
    }
    existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
  });

  // Delete current finished_stock
  await supabase.from("finished_stock").delete().eq("business_id", businessId);

  // Fetch prices
  const { data: designPrices } = await supabase.from("designs").select("id, sale_price").eq("business_id", businessId);
  const { data: designCostings } = await supabase.from("design_costings").select("design_id, total_cost_per_piece").eq("business_id", businessId).eq("is_active", true);

  const priceMap = new Map();
  (designPrices || []).forEach(d => { if (d.sale_price) priceMap.set(d.id, Number(d.sale_price)); });
  const bomCostMap = new Map();
  (designCostings || []).forEach(c => { if (c.total_cost_per_piece) bomCostMap.set(c.design_id, Number(c.total_cost_per_piece)); });

  let insertedCount = 0;
  for (const [_, stockData] of stockMap.entries()) {
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

    const computedValue = stockData.totalValue > 0
      ? Math.max(0, Number(stockData.totalValue.toFixed(2)))
      : Math.max(0, Number((stockData.totalQuantity * unitCost).toFixed(2)));

    await supabase.from("finished_stock").insert({
      business_id: businessId,
      design_id: stockData.designId,
      colour_id: stockData.colourId,
      godown_id: stockData.godownId,
      entry_type: "manual",
      size_quantities: stockData.sizeQuantities,
      total_quantity: Math.max(0, Math.round(stockData.totalQuantity)),
      cost_per_piece: Number(unitCost.toFixed(2)),
      total_value: computedValue,
    });
    insertedCount++;
  }

  console.log(`Successfully reconciled finished stock! ${insertedCount} ground-truth rows inserted.`);

  // Print new stock summary
  const { data: newFs } = await supabase
    .from("finished_stock")
    .select("id, total_quantity, total_value, design:designs(design_number, name), godown:godowns(name), size_quantities")
    .eq("business_id", businessId);

  console.log(`\n--- NEW RECONCILED FINISHED STOCK SUMMARY ---`);
  let totalQty = 0;
  let totalVal = 0;
  (newFs || []).forEach(row => {
    totalQty += Number(row.total_quantity || 0);
    totalVal += Number(row.total_value || 0);
    const dName = row.design?.design_number || row.design?.name || row.design_id;
    console.log(`• Design '${dName}' @ ${row.godown?.name}: ${row.total_quantity} Pcs (Valuation: ₹${row.total_value})`);
    console.log(`  Size breakdown:`, row.size_quantities);
  });
  console.log(`\nRECONCILED TOTAL STOCK: ${totalQty} Pcs | TOTAL VALUATION: ₹${totalVal.toFixed(2)}`);
}

async function run() {
  const { data: fs } = await supabase.from('finished_stock').select('business_id');
  const bIds = Array.from(new Set((fs || []).map(r => r.business_id).filter(Boolean)));

  for (const bId of bIds) {
    await runReconciliation(bId);
  }
}

run().catch(console.error);
