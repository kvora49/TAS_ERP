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

if (!dbUrl) {
  console.error("No DIRECT_URL or DATABASE_URL found in environment.");
  process.exit(1);
}

async function runMigration() {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260815000000_multi_company_memberships.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Running migration: 20260815000000_multi_company_memberships.sql`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    await client.query(sql);
    console.log('Migration executed successfully!');

    // Check table and rows
    const res = await client.query('SELECT count(*) FROM public.company_members');
    console.log(`Total company_members rows: ${res.rows[0].count}`);

    const res2 = await client.query('SELECT * FROM public.company_members LIMIT 5');
    console.log('Sample company_members rows:', res2.rows);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
