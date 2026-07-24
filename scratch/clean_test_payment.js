const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanTestPayment() {
  await supabase.from("payments").delete().eq("id", "6be02b36-5b74-4b04-aa11-b3d186e6c7fa");
  console.log("Cleaned test payment entry.");
}

cleanTestPayment();
