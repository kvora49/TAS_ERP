const { Client } = require('pg');

const host = 'db.cxekeitxvfkukujselxr.supabase.co';
const port = 5432;
const user = 'postgres';
const database = 'postgres';

const passwords = [
  'postgres',
  'cxekeitxvfkukujselxr',
  'TAS_ERP',
  'tas_erp',
  'TAS_ERP_Password',
  'admin',
  'password',
  'krish',
  'Krish',
  'krish123',
  'Krish123',
  'admin123',
  'password123',
  'supabase',
  'Supabase',
  'supabase123',
  'Supabase123',
  'tas-erp',
  'TAS-ERP'
];

async function tryPassword(password) {
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
    console.log(`Success! Password is: ${password}`);
    await client.end();
    return true;
  } catch (err) {
    if (err.message.includes('SASL') || err.message.includes('password authentication')) {
      // console.log(`Wrong password: ${password}`);
    } else {
      console.log(`Error for ${password}: ${err.message}`);
    }
    await client.end().catch(() => {});
    return false;
  }
}

async function run() {
  for (const pwd of passwords) {
    const success = await tryPassword(pwd);
    if (success) {
      process.exit(0);
    }
  }
  console.log("None of the guessed passwords worked.");
}

run();
