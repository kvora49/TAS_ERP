const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data: bank, error } = await supabase.from("bank_accounts").select("*").limit(1);
  if (bank && bank.length > 0) {
    console.log("Keys in bank_accounts:", Object.keys(bank[0]));
    console.log("Sample record:", bank[0]);
  } else {
    console.log("Error or no records:", error);
  }
}

checkColumns();
