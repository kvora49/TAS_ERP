const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBanks() {
  const { data: banks, error } = await supabase.from("bank_accounts").select("*");
  console.log("Bank Accounts Error:", error);
  console.log("Bank Accounts Count:", banks ? banks.length : 0);
  console.log("Bank Accounts Data:", banks);
}

checkBanks();
