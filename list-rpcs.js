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

async function listRPCs() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey
      }
    });
    const spec = await response.json();
    const rpcs = Object.keys(spec.paths || {}).filter(p => p.startsWith('/rpc/'));
    console.log("Available RPCs:", rpcs);
  } catch (err) {
    console.log("Exception:", err.message);
  }
}

listRPCs();
