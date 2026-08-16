const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPaths = ['.env.local', '.env'];
  for (const envPath of envPaths) {
    const fullPath = path.resolve(process.cwd(), envPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
  console.log("=== Backfilling production_lots.godown_id from stock_ledger ===");

  // 1. Fetch completed production lots
  const { data: lots } = await supabase
    .from('production_lots')
    .select('id, lot_number, design_id, status, godown_id, business_id');

  console.log(`Found ${lots ? lots.length : 0} production lots`);

  for (const lot of lots || []) {
    // Check if lot has ledger entry
    const { data: ledgerEntries } = await supabase
      .from('stock_ledger')
      .select('godown_id, quantity_delta, transaction_type')
      .eq('reference_table', 'production_lots')
      .eq('reference_id', lot.id);

    if (ledgerEntries && ledgerEntries.length > 0) {
      const gId = ledgerEntries[0].godown_id;
      console.log(`Lot ${lot.lot_number} (${lot.id}): found ledger entry with godown_id ${gId}`);
      if (lot.godown_id !== gId) {
        await supabase
          .from('production_lots')
          .update({ godown_id: gId })
          .eq('id', lot.id);
        console.log(`  -> Updated lot ${lot.lot_number} godown_id to ${gId}`);
      }
    } else {
      console.log(`Lot ${lot.lot_number} (${lot.id}): no direct stock_ledger reference`);
    }
  }

  console.log("=== Backfill complete ===");
}

backfill().catch(console.error);
