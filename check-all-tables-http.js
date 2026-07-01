const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = val;
    }
  });
} catch (e) {
  console.error("Failed to read .env.local:", e.message);
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tablesToCheck = [
  // Phase 2 / Settings
  'tenant_settings',
  
  // Phase 3: Raw Materials & Parties
  'parties',
  'raw_materials',
  'raw_material_purchases',
  
  // Phase 4: Production
  'lots',
  'stage_entries',
  
  // Phase 5: Finished Stock
  'finished_stock',
  'stock_adjustments',
  'stock_transfers',
  'challans'
];

async function checkTables() {
  console.log("Checking database tables existence via HTTP REST API...");
  
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
        
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01' || error.message.includes('not found')) {
          console.log(`❌ Table '${table}': MISSING (does not exist in schema)`);
        } else {
          console.log(`✅ Table '${table}': EXISTS (returned query error: ${error.message})`);
        }
      } else {
        console.log(`✅ Table '${table}': EXISTS`);
      }
    } catch (err) {
      console.log(`❌ Table '${table}': ERROR checking - ${err.message}`);
    }
  }
}

checkTables();
