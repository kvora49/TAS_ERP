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

console.log("Available DB env keys:", Object.keys(process.env).filter(k => k.includes('DB') || k.includes('POSTGRES') || k.includes('SUPABASE')));

async function testPg() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.log("No explicit connectionString found in env.");
    return;
  }
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("Connected to PG via connectionString!");
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260805000000_bank_balance_and_cheque_wiring.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log("SUCCESS! Migration 20260805000000_bank_balance_and_cheque_wiring.sql applied successfully via pg!");
    await client.end();
  } catch (err) {
    console.error("PG Connection error:", err.message);
  }
}

testPg();
