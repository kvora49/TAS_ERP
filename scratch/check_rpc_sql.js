const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRpc() {
  const { data, error } = await supabase.rpc('get_service_role_status', {}).catch(() => ({}));
  
  // We can query pg_proc using postgrest if allowed or inspect function definition
  const { data: proc, error: procErr } = await supabase
    .from('pg_proc')
    .select('proname, prosrc')
    .eq('proname', 'record_payment')
    .maybeSingle();

  console.log("Proc Data:", proc || procErr);
}

inspectRpc();
