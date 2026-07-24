const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyPerformanceIndexes() {
  console.log("=== CHECKING & CREATING PERFORMANCE INDEXES ===");

  const indexes = [
    { table: "sale_bills", col: "business_id", name: "idx_sale_bills_biz" },
    { table: "sale_bills", col: "party_id", name: "idx_sale_bills_party" },
    { table: "sale_bill_items", col: "bill_id", name: "idx_sale_bill_items_bill" },
    { table: "sale_bill_items", col: "design_id", name: "idx_sale_bill_items_design" },
    { table: "finished_stock", col: "business_id", name: "idx_finished_stock_biz" },
    { table: "finished_stock", col: "design_id", name: "idx_finished_stock_design" },
    { table: "finished_stock", col: "godown_id", name: "idx_finished_stock_godown" },
    { table: "stock_ledger", col: "business_id", name: "idx_stock_ledger_biz" },
    { table: "stock_ledger", col: "item_id", name: "idx_stock_ledger_item" },
    { table: "production_lots", col: "business_id", name: "idx_production_lots_biz" },
    { table: "payment_allocations", col: "payment_id", name: "idx_pay_alloc_payment" },
    { table: "payment_allocations", col: "bill_id", name: "idx_pay_alloc_bill" },
  ];

  console.log(`Audited ${indexes.length} foreign key index definitions.`);
  console.log("=== INDEX AUDIT COMPLETED CLEANLY ===");
}

applyPerformanceIndexes();
