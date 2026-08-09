const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: fs } = await supabase.from('finished_stock').select('business_id');
  const bIds = Array.from(new Set((fs || []).map(r => r.business_id).filter(Boolean)));

  console.log("Found business IDs:", bIds);

  for (const bId of bIds) {
    console.log(`\n========================================`);
    console.log(`Business ID: ${bId}`);

    // Fetch godowns
    const { data: godowns } = await supabase
      .from("godowns")
      .select("id, name")
      .eq("business_id", bId)
      .is("deleted_at", null);
    const defaultGodownId = godowns && godowns.length > 0 ? godowns[0].id : null;

    // Production Lots (completed)
    const { data: productionLots } = await supabase
      .from("production_lots")
      .select("id, design_id, colour_id, status, accessory_cost, other_cost, lot_size_quantities(*)")
      .eq("business_id", bId)
      .is("deleted_at", null)
      .eq("status", "completed");

    // FG Purchases
    const { data: fgPurchases } = await supabase
      .from("raw_material_purchase_items")
      .select("id, purchase_id, design_id, colour_id, size_quantities, quantity, rate, amount, taxable_value, item_type, purchase:raw_material_purchases(godown_id, status)")
      .eq("business_id", bId)
      .eq("item_type", "finished_goods");

    // FG Returns
    const { data: fgReturns } = await supabase
      .from("purchase_return_items")
      .select("id, return_id, design_id, colour_id, size_quantities, returned_qty, rate, taxable_value, item_type, purchase_return:purchase_returns(godown_id, purchase_id, status)")
      .eq("business_id", bId)
      .eq("item_type", "finished_goods");

    // Sales Bills
    const { data: salesBills } = await supabase
      .from("sale_bill_items")
      .select("id, bill_id, design_id, colour_id, size, quantity, rate, amount, bill:sale_bills(status, deleted_at, is_temporary)")
      .eq("business_id", bId);

    // Sales Returns
    const { data: salesReturns } = await supabase
      .from("sales_return_items")
      .select("id, return_id, design_id, colour_id, size, size_quantities, returned_qty, quantity, unit_rate, rate, amount, sales_return:sales_returns(status)")
      .eq("business_id", bId);

    // Adjustments
    const { data: adjustments } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("business_id", bId)
      .is("deleted_at", null);

    // Transfers
    const { data: stockTransfers } = await supabase
      .from("stock_transfer_items")
      .select("id, transfer_id, design_id, colour_id, size, quantity, unit_cost, total_value, transfer:stock_transfers(from_godown_id, to_godown_id, status)")
      .eq("business_id", bId);

    // Challans
    const { data: challanItems } = await supabase
      .from("challan_items")
      .select("id, challan_id, design_id, colour_id, size, quantity, unit_cost, total_value, challan:challans(from_godown_id, status)")
      .eq("business_id", bId);

    console.log("Summary of ground-truth inputs:");
    console.log(`• Completed Lots: ${productionLots ? productionLots.length : 0}`);
    console.log(`• FG Purchases: ${fgPurchases ? fgPurchases.length : 0}`);
    console.log(`• FG Returns: ${fgReturns ? fgReturns.length : 0}`);
    console.log(`• Sale Bills Items: ${salesBills ? salesBills.length : 0}`);
    console.log(`• Sale Returns Items: ${salesReturns ? salesReturns.length : 0}`);
    console.log(`• Adjustments: ${adjustments ? adjustments.length : 0}`);
    console.log(`• Transfers: ${stockTransfers ? stockTransfers.length : 0}`);
    console.log(`• Challans: ${challanItems ? challanItems.length : 0}`);

    if (salesBills) {
      salesBills.forEach(sb => {
        console.log(`  - Sale Bill Item ${sb.id}: design=${sb.design_id}, qty=${sb.quantity}, bill_status=${sb.bill?.status}, deleted=${sb.bill?.deleted_at}, is_temp=${sb.bill?.is_temporary}`);
      });
    }
  }
}

run().catch(console.error);
