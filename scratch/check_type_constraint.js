const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function checkConstraint() {
  await client.connect();
  const res = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'bank_accounts'::regclass;
  `);
  console.log("Bank Accounts Constraints:", res.rows);
  await client.end();
}

checkConstraint();
