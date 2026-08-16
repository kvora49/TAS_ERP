// scripts/apply-defect-v2-migration.js
// Applies the defect system v2 migration via direct PostgreSQL connection

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
  console.error('No DIRECT_URL or DATABASE_URL found in environment.');
  process.exit(1);
}

async function runMigration() {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260818000000_defect_system_v2.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log('Running migration: 20260818000000_defect_system_v2.sql');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    await client.query(sql);
    console.log('Migration executed successfully!');

    // Verify new columns
    const columnChecks = [
      { table: 'lot_defects', col: 'size_quantities' },
      { table: 'lot_defects', col: 'colour_id' },
      { table: 'lot_defects', col: 'source' },
      { table: 'defect_resolutions', col: 'recovered_size_quantities' },
      { table: 'defect_resolutions', col: 'material_write_off_value' },
      { table: 'defect_resolutions', col: 'rework_cost_mode' },
      { table: 'defect_resolutions', col: 'source_finished_stock_id' },
    ];

    for (const { table, col } of columnChecks) {
      const res = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
        [table, col]
      );
      if (res.rows.length > 0) {
        console.log(`  ✅ ${table}.${col}`);
      } else {
        console.error(`  ❌ ${table}.${col} — NOT FOUND`);
      }
    }

    // Check b_grade_stock table
    const bgRes = await client.query('SELECT count(*) FROM public.b_grade_stock');
    console.log(`  ✅ b_grade_stock table exists (count: ${bgRes.rows[0].count})`);

    // Confirm lot_defects.defect_category has no CHECK constraint
    const constraintRes = await client.query(
      `SELECT conname FROM pg_constraint WHERE conname='lot_defects_defect_category_check'`
    );
    if (constraintRes.rows.length === 0) {
      console.log('  ✅ lot_defects.defect_category CHECK constraint removed (free-text now)');
    } else {
      console.error('  ❌ lot_defects.defect_category CHECK constraint still exists — manual drop needed');
    }

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
