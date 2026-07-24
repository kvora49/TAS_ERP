const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRpcSql() {
  // Query pg_proc using raw RPC or view
  const { data, error } = await supabase.rpc('get_function_src', { fn_name: 'record_payment' }).catch(() => ({}));
  console.log("RPC src:", data, error);
}

findRpcSql();
