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

async function inspectAuditLog() {
  try {
    const { data, error } = await supabase.from('audit_log').select('*').limit(1);
    if (error) {
      console.log(`Error fetching audit_log: ${error.message}`);
      return;
    }
    if (data && data.length > 0) {
      console.log(`audit_log columns:`, Object.keys(data[0]));
    } else {
      console.log(`audit_log exists but is empty.`);
    }
  } catch (err) {
    console.log(`Exception: ${err.message}`);
  }
}

inspectAuditLog();
