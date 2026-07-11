const { Client } = require('pg');

const host = 'aws-1-ap-northeast-2.pooler.supabase.com';
const port = 6543;
const user = 'postgres.cxekeitxvfkukujselxr';
const password = 'True_ass_Sniffers@69';
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
    await client.connect();
    console.log("Connected successfully!");
    
    const columnsRes = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'party_bank_details'
      ORDER BY ordinal_position;
    `);
    
    console.log("Columns of party_bank_details:");
    console.table(columnsRes.rows);

  } catch (err) {
    console.error("Execution failed:", err.message);
  } finally {
    await client.end();
  }
}

run();
