const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
  const tables = ['bank_accounts', 'payments', 'cheques', 'expenses', 'misc_income', 'salary_entries'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (data && data.length > 0) {
      console.log(`\nTable ${t} columns:`, Object.keys(data[0]));
    } else {
      console.log(`\nTable ${t} error/empty:`, error ? error.message : 'no records');
    }
  }
}

checkAllTables();
