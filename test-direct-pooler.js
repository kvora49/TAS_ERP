const { Client } = require('pg');

const host = 'db.cxekeitxvfkukujselxr.supabase.co';
const port = 6543;
const user = 'postgres';
const password = 'tas_erp';
const database = 'postgres';

async function run() {
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`Connecting to ${host}:${port} as ${user}...`);
    await client.connect();
    console.log("Success! Connected on port 6543");
    await client.end();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

run();
