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

const dbUrl = process.env.DATABASE_URL;

async function runPgMigration() {
  console.log("=== APPLYING MINIMUM BALANCE ENFORCEMENT MIGRATION ===");
  if (!dbUrl) {
    console.error("DATABASE_URL environment variable is missing!");
    return;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260805000100_enforce_minimum_balance.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing SQL migration script...");
    await client.query(sql);
    console.log("Migration executed successfully!");
  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await client.end();
  }
}

runPgMigration();
