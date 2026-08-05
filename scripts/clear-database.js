const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local or .env
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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const clearAuth = process.argv.includes('--with-auth');

async function clearViaPg() {
  console.log('Connecting directly to PostgreSQL via connection string...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('Clearing all table data while keeping table structure & schema intact...');

    const clearQuery = `
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN
          SET CONSTRAINTS ALL DEFERRED;

          FOR r IN (
              SELECT tablename 
              FROM pg_tables 
              WHERE schemaname = 'public' 
                AND tablename NOT IN ('schema_migrations', '_supabase_migrations', 'spatial_ref_sys')
          ) LOOP
              EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE;';
          END LOOP;

          ${clearAuth ? "EXECUTE 'TRUNCATE TABLE auth.users CASCADE;';" : ''}
      END $$;
    `;

    await client.query(clearQuery);
    console.log('✅ Successfully cleared all data from all public tables!');
    if (clearAuth) {
      console.log('✅ Successfully cleared all auth users from Supabase Auth.');
    }
  } finally {
    await client.end();
  }
}

async function clearViaSupabaseRest() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or DATABASE_URL) must be defined in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  console.log('Using Supabase REST API fallback...');

  const { data: tableData, error: tableError } = await supabase.rpc('pg_tables');
  
  // Static table fallback list if RPC not available
  const tables = [
    'payment_allocations', 'cheques', 'bank_balances', 'party_bank_details', 'party_contacts', 'parties',
    'sale_bill_items', 'sale_bill_charges', 'sale_bills', 'sale_orders', 'sales_returns', 'credit_notes', 'bill_profit',
    'purchase_bills', 'bill_templates', 'brand_bill_config', 'job_work_payment_entries', 'job_work_payments',
    'stage_entries', 'lot_rolls', 'lot_spec_sheet', 'lot_stage_workers', 'lot_specifications', 'lot_size_quantities',
    'lot_production_stages', 'production_lots', 'finished_stock', 'stock_adjustments', 'stock_transfer_items',
    'stock_transfers', 'challan_items', 'challans', 'purchase_return_rolls', 'purchase_return_items', 'purchase_returns',
    'purchase_payments', 'purchase_rolls', 'raw_material_purchase_items', 'raw_material_purchases',
    'raw_material_stock_entry_items', 'raw_material_stock_entries', 'raw_material_current_stock',
    'worker_attendance', 'worker_documents', 'workers', 'whatsapp_logs', 'whatsapp_templates', 'backup_history',
    'business_settings', 'notification_rules', 'role_permissions', 'units', 'garment_types', 'design_spec_templates',
    'production_templates', 'in_app_notifications', 'audit_logs', 'bill_reminder_schedules'
  ];

  let successCount = 0;
  let failCount = 0;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        failCount++;
      } else {
        successCount++;
      }
    } catch {
      failCount++;
    }
  }

  console.log(`Clean-up completed: ${successCount} tables cleared.`);
}

async function main() {
  if (dbUrl) {
    await clearViaPg();
  } else {
    await clearViaSupabaseRest();
  }
}

main().catch(err => {
  console.error('Fatal error during database clear:', err);
  process.exit(1);
});
