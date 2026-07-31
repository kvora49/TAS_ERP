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

async function executeSql() {
  const sql = `
    ALTER TABLE sale_bills 
      ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS temp_bill_number TEXT;

    CREATE INDEX IF NOT EXISTS idx_sale_bills_is_temporary ON sale_bills(is_temporary);
    CREATE INDEX IF NOT EXISTS idx_sale_bills_temp_bill_number ON sale_bills(temp_bill_number);
  `;

  console.log("Attempting SQL execution via Supabase SQL API...");
  
  // Try Supabase admin SQL endpoint (v1/query or pg_net or db query)
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  
  try {
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
    console.log("Response:", text);
  } catch (err) {
    console.error("Error executing via RPC:", err.message);
  }
}

executeSql();
