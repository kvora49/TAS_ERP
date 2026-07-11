const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const host = 'db.cxekeitxvfkukujselxr.supabase.co';
const port = 6543;
const user = 'postgres';
const password = 'tas_erp';
const database = 'postgres';

async function run() {
  const filename = process.argv[2];
  if (!filename) {
    console.error("Please specify a migration file name (e.g., 20260711000001_stock_ledger.sql)");
    process.exit(1);
  }

  const migrationPath = path.join(__dirname, 'supabase', 'migrations', filename);
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Connecting to database to run: ${filename}...`);
  
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully. Running SQL...");
    await client.query(sql);
    console.log("Migration executed successfully!");
    
    console.log("Granting privileges and reloading schema cache...");
    await client.query(`
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
      NOTIFY pgrst, 'reload schema';
    `);
    console.log("Database schema updated and PostgREST reloaded.");
  } catch (err) {
    console.error("Migration execution failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
