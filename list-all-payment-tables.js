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
    
    // Check tables containing 'payment' in their name
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%payment%'
      ORDER BY table_name;
    `);
    
    console.log("Matching tables containing 'payment':");
    console.table(tablesRes.rows);

    for (const row of tablesRes.rows) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [row.table_name]);
      
      console.log(`\nColumns for table: ${row.table_name}`);
      console.table(cols.rows);
    }

  } catch (err) {
    console.error("Execution failed:", err.message);
  } finally {
    await client.end();
  }
}

run();
