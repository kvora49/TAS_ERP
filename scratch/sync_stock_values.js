const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncStockValues() {
  console.log("=== RE-CALCULATING FINISHED STOCK VALUES ===");

  const { data: rows } = await supabase.from("finished_stock").select("*").is("deleted_at", null);
  for (const r of rows || []) {
    const qty = Number(r.total_quantity || 0);
    const costPerPiece = Number(r.cost_per_piece || 0);
    let newValue = qty * costPerPiece;

    if (costPerPiece === 0 && Number(r.total_value || 0) > 0 && qty > 0) {
      // If cost_per_piece wasn't set, derive it from previous valuation
      const derivedCost = Number(r.total_value) / qty;
      newValue = qty * derivedCost;
    }

    await supabase
      .from("finished_stock")
      .update({
        total_value: newValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);

    console.log(`Row ${r.id}: Total Qty = ${qty}, Cost/Piece = ${costPerPiece}, Updated Total Value = ₹${newValue}`);
  }

  console.log("=== FINISHED STOCK VALUE RE-CALCULATION COMPLETE ===");
}

syncStockValues();
