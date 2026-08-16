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
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260817000000_production_defects.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Running migration: 20260817000000_production_defects.sql`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    await client.query(sql);
    console.log('Migration executed successfully!');

    // Check tables created
    const resDefects = await client.query('SELECT count(*) FROM public.lot_defects');
    console.log(`lot_defects table exists! Current count: ${resDefects.rows[0].count}`);

    const resRes = await client.query('SELECT count(*) FROM public.defect_resolutions');
    console.log(`defect_resolutions table exists! Current count: ${resRes.rows[0].count}`);

    const resDed = await client.query('SELECT count(*) FROM public.worker_deductions');
    console.log(`worker_deductions table exists! Current count: ${resDed.rows[0].count}`);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
