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

async function inspectTable(tableName) {
  try {
    // Select one row or fetch columns if possible
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
      console.log(`Table ${tableName}: Error fetching - ${error.message}`);
      return;
    }
    if (data && data.length > 0) {
      console.log(`Table ${tableName} columns:`, Object.keys(data[0]));
    } else {
      console.log(`Table ${tableName}: EXISTS but is empty`);
      // Let's query information_schema if possible
      const { data: cols, error: colErr } = await supabase.rpc('get_columns_of_table', { table_name: tableName });
      if (colErr) {
        console.log(`Could not query columns: ${colErr.message}`);
      } else {
        console.log(`Columns from RPC:`, cols);
      }
    }
  } catch (err) {
    console.log(`Table ${tableName}: Exception - ${err.message}`);
  }
}

async function main() {
  await inspectTable('businesses');
  await inspectTable('users');
}

main();
