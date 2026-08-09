const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: fs, error } = await supabase.from('finished_stock').select('id, business_id, total_quantity, total_value, design_id, godown_id, size_quantities, created_at');
  if (error) {
    console.error("Error querying finished_stock:", error);
    return;
  }

  console.log(`Total finished_stock records in DB: ${fs ? fs.length : 0}`);
  if (fs && fs.length > 0) {
    let grandQty = 0;
    let grandVal = 0;
    fs.forEach(row => {
      grandQty += Number(row.total_quantity || 0);
      grandVal += Number(row.total_value || 0);
      console.log(`• ID: ${row.id} | Design: ${row.design_id} | Qty: ${row.total_quantity} | Value: ₹${row.total_value} | Sizes:`, row.size_quantities);
    });
    console.log(`\n========================================`);
    console.log(`GRAND TOTAL FINISHED STOCK: ${grandQty} Pcs`);
    console.log(`GRAND TOTAL STOCK VALUATION: ₹${grandVal.toFixed(2)}`);
    console.log(`========================================`);
  }
}

run().catch(console.error);
