const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
  const { data: rows } = await supabase.from("finished_stock").select("*, design:designs(design_number, name), godown:godowns(name)").is("deleted_at", null);
  console.log("=== FINISHED_STOCK ROWS ===");
  rows.forEach(r => {
    console.log(`ID: ${r.id} | Design: ${r.design?.design_number} (${r.design?.name}) | Godown: ${r.godown?.name} | EntryType: ${r.entry_type} | TotalQty: ${r.total_quantity} | Sizes:`, r.size_quantities);
  });
}

inspectTable();
