const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createCustomBillLayoutsTable() {
  console.log("Checking / Creating custom_bill_layouts table...");
  try {
    const { error: testErr } = await supabase.from("custom_bill_layouts").select("id").limit(1);
    if (testErr) {
      console.log("Table custom_bill_layouts not found or error:", testErr.message);
    } else {
      console.log("custom_bill_layouts table exists and accessible!");
    }
  } catch (err) {
    console.error("Error checking custom_bill_layouts table:", err);
  }
}

createCustomBillLayoutsTable();
