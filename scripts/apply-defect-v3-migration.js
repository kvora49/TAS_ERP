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
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260822000000_production_lot_defect_aggregates_and_rework.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Running migration: 20260822000000_production_lot_defect_aggregates_and_rework.sql`);

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    await client.query(sql);
    console.log('Migration executed successfully!');

    // Verify columns on production_lots
    const lotCols = ['reworked_quantity', 'b_grade_quantity', 'scrapped_quantity'];
    for (const col of lotCols) {
      const res = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name='production_lots' AND column_name=$1`,
        [col]
      );
      if (res.rows.length > 0) {
        console.log(`  ? production_lots.${col} exists`);
      } else {
        console.error(`  ? production_lots.${col} NOT found`);
      }
    }

    // Verify column on lot_defects
    const defectColRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='lot_defects' AND column_name='sent_for_rework'`
    );
    if (defectColRes.rows.length > 0) {
      console.log(`  ? lot_defects.sent_for_rework exists`);
    } else {
      console.error(`  ? lot_defects.sent_for_rework NOT found`);
    }

    const sampleRes = await client.query(
      `SELECT id, lot_number, total_quantity, defect_quantity, reworked_quantity, b_grade_quantity, scrapped_quantity FROM production_lots WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`
    );
    console.log('Sample production lots:');
    console.table(sampleRes.rows);

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
