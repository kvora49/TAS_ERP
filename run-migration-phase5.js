const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const host = 'db.cxekeitxvfkukujselxr.supabase.co';
const port = 5432;
const user = 'postgres';
const password = 'tas_erp';
const database = 'postgres';

async function connectWithRetry(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
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
      console.log("Connected successfully to PostgreSQL database.");
      return client;
    } catch (err) {
      console.warn(`Connection attempt ${i + 1} failed: ${err.message}`);
      await client.end().catch(() => {});
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw err;
      }
    }
  }
}

async function run() {
  let client;
  try {
    client = await connectWithRetry();

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260630000000_phase5_finished_stock.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log("Executing Phase 5 database migration SQL...");
    await client.query(sql);
    console.log("Migration executed successfully!");
    
    // Grant privileges and reload schema
    console.log("Granting privileges and reloading schema cache...");
    await client.query(`
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
      NOTIFY pgrst, 'reload schema';
    `);
    console.log("Database schema updated and reloaded.");

  } catch (err) {
    console.error("Migration execution failed:", err.message);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

run();
