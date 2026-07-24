const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAllStock() {
  console.log("=== CURRENT FINISHED_STOCK IN DATABASE ===");
  const { data: rows } = await supabase
    .from("finished_stock")
    .select("id, design_id, colour_id, godown_id, total_quantity, total_value, cost_per_piece, size_quantities, design:designs(design_number, name), colour:design_colours(colour_name), godown:godowns(name)")
    .is("deleted_at", null);

  for (const r of rows || []) {
    console.log(`Design: ${r.design?.design_number} (${r.design?.name}) | Colour: ${r.colour?.colour_name || r.colour_id} | Godown: ${r.godown?.name} | Total Qty: ${r.total_quantity} Pcs | Total Val: ₹${r.total_value} | Sizes:`, r.size_quantities);
  }
}

inspectAllStock();
