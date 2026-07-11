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
    
    const rowsRes = await client.query(`
      SELECT id, name, worker_id, type, specialization, default_rate
      FROM workers
      LIMIT 5;
    `);
    
    console.table(rowsRes.rows);

  } catch (err) {
    console.error("Execution failed:", err.message);
  } finally {
    await client.end();
  }
}

run();
