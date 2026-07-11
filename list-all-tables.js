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
    
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log("Tables in public schema:");
    console.log(tablesRes.rows.map(r => r.table_name));

  } catch (err) {
    console.error("Execution failed:", err.message);
  } finally {
    await client.end();
  }
}

run();
