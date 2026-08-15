const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  for (const envPath of envPaths) {
    const fullPath = path.resolve(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
      break;
    }
  }
}

loadEnv();

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function fixUsersPolicy() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    console.log('Updating users table policy...');
    await client.query(`
      DROP POLICY IF EXISTS "tenant_isolation" ON public.users;
      DROP POLICY IF EXISTS "users_self_and_tenant_access" ON public.users;
      DROP POLICY IF EXISTS "users_read_own" ON public.users;
      DROP POLICY IF EXISTS "users_update_own" ON public.users;

      CREATE POLICY "users_self_and_tenant_access" ON public.users
        FOR ALL USING (
          id = auth.uid() 
          OR public.auth_has_business_access(business_id)
        )
        WITH CHECK (
          id = auth.uid() 
          OR public.auth_has_business_access(business_id)
        );
    `);
    console.log('users policy updated successfully with id = auth.uid() self access.');

    // Verify policies on users
    const pols = await client.query(`
      SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
      WHERE tablename = 'users'
    `);
    console.log('Updated policies on users:', pols.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fixUsersPolicy();
