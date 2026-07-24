const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllocTable() {
  const { data: allocs, error } = await supabase.from("payment_allocations").select("*").limit(5);
  console.log("Allocations Error:", error);
  console.log("Existing Allocations:", allocs);
}

checkAllocTable();
