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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

// All public schema tables in TAS ERP
const tables = [
  'sale_bill_items',
  'sale_bill_charges',
  'sale_bills',
  'sale_orders',
  'sales_returns',
  'credit_notes',
  'bill_profit',
  'purchase_bills',
  'bill_templates',
  'brand_bill_config',
  'job_work_payment_entries',
  'job_work_payments',
  'stage_entries',
  'lot_rolls',
  'lot_spec_sheet',
  'lot_stage_workers',
  'lot_specifications',
  'lot_size_quantities',
  'lot_production_stages',
  'production_lots',
  'finished_stock',
  'stock_adjustments',
  'stock_transfer_items',
  'stock_transfers',
  'challan_items',
  'challans',
  'purchase_return_rolls',
  'purchase_return_items',
  'purchase_returns',
  'purchase_payments',
  'purchase_rolls',
  'raw_material_purchase_items',
  'raw_material_purchases',
  'raw_material_stock_entry_items',
  'raw_material_stock_entries',
  'raw_material_current_stock',
  'party_bank_details',
  'party_contacts',
  'worker_attendance',
  'worker_documents',
  'workers',
  'whatsapp_logs',
  'whatsapp_templates',
  'backup_history',
  'business_settings',
  'notification_rules',
  'role_permissions',
  'units',
  'garment_types',
  'design_spec_templates',
  'production_templates'
];

async function clearDatabase() {
  console.log('Starting Database Data Clean-Up...');
  console.log('------------------------------------');
  
  let successCount = 0;
  let failCount = 0;

  for (const table of tables) {
    try {
      // Delete all records from table
      const { error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.warn(`[WARN] Table '${table}': ${error.message}`);
        failCount++;
      } else {
        console.log(`[OK] Truncated/Cleared table '${table}' (${count ?? 0} rows deleted)`);
        successCount++;
      }
    } catch (err) {
      console.error(`[ERROR] Failed to clear table '${table}':`, err.message);
      failCount++;
    }
  }

  console.log('------------------------------------');
  console.log(`Clean-up completed: ${successCount} tables cleared successfully, ${failCount} warnings/errors.`);
}

clearDatabase();
