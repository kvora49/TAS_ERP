const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFinishedStock() {
  // 1. Query finished_stock table rows
  const { data: fsRows } = await supabase
    .from("finished_stock")
    .select("*, design:designs(design_number, name)")
    .is("deleted_at", null);

  console.log("=== FINISHED_STOCK TABLE ROWS ===");
  console.log(JSON.stringify(fsRows, null, 2));

  // 2. Call RPC get_finished_stock_stats
  const { data: rpcStats } = await supabase.rpc("get_finished_stock_stats", {
    p_business_id: '70f74d68-ade1-4b03-a88a-2b90947dedb0'
  });
  console.log("=== RPC STATS ===");
  console.log(JSON.stringify(rpcStats, null, 2));

  // 3. Query stock_ledger entries for finished goods
  const { data: ledger } = await supabase
    .from("stock_ledger")
    .select("*")
    .eq("item_type", "finished_good");
  console.log("=== STOCK_LEDGER ENTRIES ===");
  console.log(JSON.stringify(ledger, null, 2));
}

checkFinishedStock();
