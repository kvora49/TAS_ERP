const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  for (const envPath of envPaths) {
    const fullPath = path.resolve(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
      break;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runMigration() {
  const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260805000000_bank_balance_and_cheque_wiring.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log("Applying migration 20260805000000_bank_balance_and_cheque_wiring.sql...");

  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

  try {
    // Execute SQL via postgres query API or RPC if available
    const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    console.log("RPC exec_sql status:", res.status);
    const text = await res.text();
    console.log("RPC exec_sql response:", text);

    if (!res.ok) {
      console.log("Attempting direct postgres execution via pg/supabase...");
      // Let's test checking if column current_balance exists
      const { data, error } = await supabase.from('bank_accounts').select('id, name, opening_balance, current_balance').limit(5);
      console.log("Direct query check:", { data, error });
    }
  } catch (err) {
    console.error("Migration error:", err.message);
  }
}

runMigration();
