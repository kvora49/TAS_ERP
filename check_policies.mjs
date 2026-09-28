import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:True_ass_Sniffers%4069@db.cxekeitxvfkukujselxr.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE proname = 'auth_has_business_access';
  `);
  res.rows.forEach(r => console.log(`Function ${r.proname}:\n${r.prosrc}`));
  await client.end();
}

run().catch(console.error);
