const { Client } = require('pg');

const host = 'aws-0-us-east-1.pooler.supabase.com';
const user = 'postgres.cxekeitxvfkukujselxr';
const password = 'tas_erp';
const database = 'postgres';

async function tryConnect(port) {
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
    console.log(`Success! Connected to database on port ${port}`);
    await client.end();
    return true;
  } catch (err) {
    console.error(`Failed to connect on port ${port}:`, err.message);
    await client.end().catch(() => {});
    return false;
  }
}

async function run() {
  const success5432 = await tryConnect(5432);
  const success6543 = await tryConnect(6543);
  process.exit(success5432 || success6543 ? 0 : 1);
}

run();
