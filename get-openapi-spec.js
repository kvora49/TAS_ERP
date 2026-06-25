const fs = require('fs');
const path = require('path');
const https = require('https');

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

const url = new URL(supabaseUrl);
const options = {
  hostname: url.hostname,
  port: 443,
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    try {
      const spec = JSON.parse(body);
      if (spec.definitions && spec.definitions.audit_log) {
        console.log("audit_log schema definition:", spec.definitions.audit_log.properties);
      } else {
        console.log("Could not find audit_log definition. Available definitions:", Object.keys(spec.definitions || {}));
      }
    } catch (e) {
      console.error("Error parsing response:", e.message);
      console.log("Raw body:", body.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();
