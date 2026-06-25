const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('not found') || error.message.includes('does not exist')) {
        console.log(`Table ${tableName}: NOT FOUND`);
        return false;
      }
      console.log(`Table ${tableName}: ERROR - ${error.message} (code: ${error.code})`);
      return false;
    }
    console.log(`Table ${tableName}: EXISTS`);
    return true;
  } catch (err) {
    console.log(`Table ${tableName}: ERROR - ${err.message}`);
    return false;
  }
}

async function main() {
  await checkTable('business_settings');
  await checkTable('notification_rules');
  await checkTable('role_permissions');
  await checkTable('backup_history');
}

main();
