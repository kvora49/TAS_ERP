const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  for (const envPath of envPaths) {
    const fullPath = path.resolve(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
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

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function viewLogs() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT id, business_id, run_at, scope, discrepancies_found, discrepancies_fixed, discrepancies_unresolved, details, created_at
      FROM public.stock_integrity_logs
      ORDER BY run_at DESC
      LIMIT 5;
    `);

    console.log(`Total rows in stock_integrity_logs: ${res.rows.length}`);
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

viewLogs().catch(console.error);
