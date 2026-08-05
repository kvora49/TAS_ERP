const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("No POSTGRES_URL or DATABASE_URL found in environment.");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database.");

    const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20260805000700_fix_payment_allocations_column.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log("Applying migration 20260805000200_fix_payment_rpc_advance_flag.sql...");
    await client.query(sql);
    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
