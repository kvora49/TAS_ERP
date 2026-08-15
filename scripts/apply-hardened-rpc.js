const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });
  }
}

loadEnv();

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("No database connection string found in .env.local");
  process.exit(1);
}

async function run() {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260815010000_harden_payment_rpcs_multi_tenant.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log("Applying hardened payment RPC migration...");

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log("SUCCESS: 20260815010000_harden_payment_rpcs_multi_tenant.sql applied successfully!");
  } catch (err) {
    console.error("Migration error:", err.message);
  } finally {
    await client.end();
  }
}

run();
