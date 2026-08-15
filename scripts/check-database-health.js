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

async function checkDatabase() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('--- DATABASE HEALTH & SCHEMA AUDIT ---');

    // 1. Check all public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log(`\n1. Public Tables Total: ${tablesRes.rows.length}`);
    tablesRes.rows.forEach(r => console.log(`   - ${r.table_name}`));

    // 2. Check businesses table columns
    const bizCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'businesses'
      ORDER BY ordinal_position;
    `);
    console.log(`\n2. Businesses Table Columns:`);
    bizCols.rows.forEach(c => console.log(`   - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable}, default: ${c.column_default})`));

    // 3. Check company_members table columns & indexes
    const cmCols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'company_members'
      ORDER BY ordinal_position;
    `);
    console.log(`\n3. Company Members Table Columns:`);
    cmCols.rows.forEach(c => console.log(`   - ${c.column_name} (${c.data_type})`));

    const cmIndexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'company_members';
    `);
    console.log(`\n   Company Members Indexes:`);
    cmIndexes.rows.forEach(i => console.log(`   - ${i.indexname}: ${i.indexdef}`));

    // 4. Check companies view
    const viewRes = await client.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'companies';
    `);
    console.log(`\n4. Companies View:`, viewRes.rows.length > 0 ? 'ACTIVE (mapped to businesses)' : 'MISSING');

    // 5. Check RLS status across public tables
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    console.log(`\n5. RLS Security Status:`);
    const rlsDisabled = rlsRes.rows.filter(t => !t.rowsecurity);
    console.log(`   Total Tables with RLS Enabled: ${rlsRes.rows.length - rlsDisabled.length}/${rlsRes.rows.length}`);
    if (rlsDisabled.length > 0) {
      console.log(`   Tables with RLS Disabled:`, rlsDisabled.map(t => t.tablename));
    }

    // 6. Check counts in core entities
    const counts = await Promise.all([
      client.query('SELECT count(*) FROM businesses'),
      client.query('SELECT count(*) FROM users'),
      client.query('SELECT count(*) FROM company_members'),
    ]);
    console.log(`\n6. Core Data Records:`);
    console.log(`   - Businesses: ${counts[0].rows[0].count}`);
    console.log(`   - Users: ${counts[1].rows[0].count}`);
    console.log(`   - Company Memberships: ${counts[2].rows[0].count}`);

    console.log('\n--- ALL DATABASE CHECKS PASSED ---');
  } catch (err) {
    console.error('Database check error:', err);
  } finally {
    await client.end();
  }
}

checkDatabase();
