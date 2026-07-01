const { Client } = require('pg');

async function testConnection() {
  const host = 'aws-0-ap-northeast-1.pooler.supabase.com';
  const port = 6543;
  const user = 'postgres.cxekeitxvfkukujselxr'; // tenant-scoped username for Supavisor pooler
  const password = 'tas_erp';
  const database = 'postgres';

  console.log(`Connecting to pooler: ${host}:${port} as ${user}...`);
  
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
    console.log("Connected successfully over IPv4 Pooler in Tokyo!");
    const res = await client.query("SELECT version();");
    console.log("Database version:", res.rows[0].version);
  } catch (err) {
    console.error("Pooler connection failed:", err.message);
  } finally {
    await client.end();
  }
}

testConnection();
