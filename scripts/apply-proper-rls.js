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

async function applyProperRls() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    // 1. Update businesses table policy
    console.log('\nUpdating businesses table policies...');
    await client.query(`
      DROP POLICY IF EXISTS "business_own" ON public.businesses;
      DROP POLICY IF EXISTS "business_access_policy" ON public.businesses;
      CREATE POLICY "business_access_policy" ON public.businesses
        FOR ALL USING (
          public.auth_has_business_access(id)
          OR id = (SELECT users.business_id FROM public.users WHERE users.id = auth.uid())
        );
    `);
    console.log('businesses policy updated successfully.');

    // 2. Fetch all public tables with business_id column
    const tablesWithBizId = await client.query(`
      SELECT DISTINCT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = 'public'
      WHERE c.table_schema = 'public' 
        AND c.column_name = 'business_id'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name != 'company_members'
      ORDER BY c.table_name;
    `);

    console.log(`\nFound ${tablesWithBizId.rows.length} tenant tables with business_id:`);

    for (const row of tablesWithBizId.rows) {
      const table = row.table_name;
      // Get all existing policies on this table
      const pols = await client.query(`
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = $1
      `, [table]);

      for (const p of pols.rows) {
        await client.query(`DROP POLICY IF EXISTS "${p.policyname}" ON public."${table}";`);
      }

      // Create standard tenant isolation policy
      await client.query(`
        CREATE POLICY "tenant_isolation" ON public."${table}"
          FOR ALL USING (public.auth_has_business_access(business_id));
      `);
      console.log(`  ✓ Updated policies for table: ${table}`);
    }

    // 3. Verify businesses visibility for test user
    console.log('\nVerifying businesses query via auth_has_business_access:');
    const userRes = await client.query('SELECT id, email FROM users LIMIT 1');
    const userId = userRes.rows[0].id;

    const accessibleBiz = await client.query(`
      SELECT b.id, b.name 
      FROM businesses b
      WHERE EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.user_id = $1 AND cm.company_id = b.id AND cm.status = 'active'
      )
    `, [userId]);

    console.log(`User (${userRes.rows[0].email}) has access to ${accessibleBiz.rows.length} businesses:`);
    accessibleBiz.rows.forEach(b => console.log(`   - [${b.id}] ${b.name}`));

    console.log('\n--- RLS POLICIES UPGRADED SUCCESSFULLY ---');

  } catch (err) {
    console.error('Error applying RLS:', err);
  } finally {
    await client.end();
  }
}

applyProperRls();
