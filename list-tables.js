const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = val;
    }
  }
} catch (err) {
  console.error("Could not read .env.local:", err.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  try {
    const { data, error } = await supabase.rpc('get_tables');
    if (error) {
      // RPC doesn't exist, try querying a metadata table or common tables
      console.log("RPC get_tables failed. Trying query on information_schema...");
      // Let's do a direct select on pg_tables if possible? No, REST API doesn't expose it directly.
      // But we can check if standard tables exist.
      const tablesToCheck = ['businesses', 'users', 'brands', 'godowns', 'raw_materials', 'audit_logs', 'audit_log', 'activity_logs', 'activity_log'];
      for (const t of tablesToCheck) {
        const { error: err } = await supabase.from(t).select('id').limit(1);
        if (!err || err.code !== 'PGRST205') {
          console.log(`Table ${t}: EXISTS or ACCESSIBLE (code: ${err ? err.code : 'OK'})`);
        } else {
          console.log(`Table ${t}: DOES NOT EXIST`);
        }
      }
      return;
    }
    console.log("Tables list:", data);
  } catch (err) {
    console.log("Exception:", err.message);
  }
}

listTables();
