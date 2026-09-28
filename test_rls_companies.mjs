import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:True_ass_Sniffers%4069@db.cxekeitxvfkukujselxr.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const userId = '18233a02-93b2-4dd0-80f8-e01d9d80bf18';
  
  // Set auth.uid() to dropdrone30's userId
  await client.query(`
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = '${userId}';
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
  `);

  const memRes = await client.query(`
    SELECT cm.id, cm.company_id, cm.role, cm.status, b.name as biz_name, b.id as biz_id
    FROM company_members cm
    LEFT JOIN businesses b ON b.id = cm.company_id
    WHERE cm.user_id = '${userId}';
  `);
  console.log('Query result under authenticated role for dropdrone30:');
  console.log(memRes.rows);

  await client.end();
}

run().catch(console.error);
