const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("=== LOT 1 & LOT 2 DETAILS ===");
  const { data: lots } = await supabase
    .from('production_lots')
    .select('*')
    .in('id', ['97601e88-c065-4e27-b558-492018f08939', 'b463d939-16c8-413f-b979-0510018bdc4c']);
  console.log(JSON.stringify(lots, null, 2));

  if (lots && lots.length > 0) {
    const lotIds = lots.map(l => l.id);
    
    console.log("\n=== LOT ROLLS ===");
    const { data: lotRolls } = await supabase
      .from('lot_rolls')
      .select('*, purchase_roll:purchase_rolls(roll_number, remaining_meters)')
      .in('lot_id', lotIds);
    console.log(JSON.stringify(lotRolls, null, 2));

    console.log("\n=== LOT ACCESSORIES ===");
    const { data: lotAccs } = await supabase
      .from('production_lot_accessories')
      .select('*')
      .in('lot_id', lotIds);
    console.log(JSON.stringify(lotAccs, null, 2));

    console.log("\n=== STAGE ENTRIES ===");
    const { data: stageEntries } = await supabase
      .from('stage_entries')
      .select('id, entry_number, lot_id, qty_in, qty_out, wastage_qty')
      .in('lot_id', lotIds);
    console.log(JSON.stringify(stageEntries, null, 2));
  }

  console.log("\n=== RECENT STOCK LEDGER ENTRIES ===");
  const { data: ledger } = await supabase
    .from('stock_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log(JSON.stringify(ledger, null, 2));

  console.log("\n=== CURRENT RAW MATERIAL STOCK ===");
  const { data: stock } = await supabase
    .from('raw_material_current_stock')
    .select('*, material_type:raw_material_types(name)');
  console.log(JSON.stringify(stock, null, 2));

  console.log("\n=== PURCHASE ROLLS ===");
  const { data: rolls } = await supabase
    .from('purchase_rolls')
    .select('*');
  console.log(JSON.stringify(rolls, null, 2));
}

inspect().catch(console.error);
