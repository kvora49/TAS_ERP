const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanZeroVal() {
  console.log("Cleaning up 0-value finished_stock and stock_ledger entries from auto-push...");

  // Find 0 value entries in finished_stock
  const { data: zeroFs, error: fsErr } = await supabase
    .from("finished_stock")
    .select("id, lot_id")
    .eq("total_value", 0)
    .eq("entry_type", "production");

  if (zeroFs && zeroFs.length > 0) {
    const fsIds = zeroFs.map((f) => f.id);
    const lotIds = zeroFs.map((f) => f.lot_id).filter(Boolean);

    // Delete matching stock_ledger entries
    if (lotIds.length > 0) {
      await supabase
        .from("stock_ledger")
        .delete()
        .eq("transaction_type", "production_lot_finished_good_push")
        .eq("value_delta", 0)
        .in("reference_id", lotIds);
    }

    // Delete finished_stock entries
    await supabase.from("finished_stock").delete().in("id", fsIds);
    console.log(`Successfully removed ${zeroFs.length} zero-value auto-pushed finished_stock entries.`);
  } else {
    console.log("No zero-value auto-pushed entries found.");
  }
}

cleanZeroVal();
