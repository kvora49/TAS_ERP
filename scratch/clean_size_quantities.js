const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanSizeQuantities() {
  console.log("=== CLEANING SIZE QUANTITIES IN FINISHED_STOCK ===");

  const { data: rows } = await supabase
    .from("finished_stock")
    .select("*, design:designs(design_number, name), colour:design_colours(colour_name), godown:godowns(name)")
    .is("deleted_at", null);

  for (const r of rows || []) {
    // If total_quantity is 100 and sizes have 10 each, let's fix size distribution
    if (r.design?.design_number === 'NIG_0001' && r.colour?.colour_name === 'Dark Brown') {
      const fixedSizes = { S: 20, M: 20, L: 20, XL: 20, XXL: 20 };
      await supabase
        .from("finished_stock")
        .update({
          size_quantities: fixedSizes,
          total_quantity: 100,
          total_value: 100 * Number(r.cost_per_piece || 126),
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      console.log("Updated NIG_0001 Dark Brown size quantities to 20 Pcs per size (100 Pcs total).");
    }

    if (r.design?.design_number === 'NIG_0001' && r.colour?.colour_name === 'Black') {
      const fixedSizes = { S: 10, M: 10, L: 10, XL: 10, XXL: 10 };
      await supabase
        .from("finished_stock")
        .update({
          size_quantities: fixedSizes,
          total_quantity: 50,
          total_value: 50 * Number(r.cost_per_piece || 126),
          updated_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      console.log("Updated NIG_0001 Black size quantities to 10 Pcs per size (50 Pcs total after 50 Pcs sold).");
    }
  }

  console.log("=== CLEANUP COMPLETE ===");
}

cleanSizeQuantities();
