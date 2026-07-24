const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSingleKeys() {
  const { data: bill } = await supabase.from("sale_bills").select("*").limit(1).single();

  // Test 1: { bill_id, amount }
  console.log("Testing { bill_id, amount }...");
  const { data: res1, error: err1 } = await supabase.rpc("record_payment", {
    p_business_id: bill.business_id,
    p_direction: "received",
    p_party_id: bill.party_id,
    p_payment_date: '2026-07-22',
    p_payment_mode: 'bank_transfer',
    p_reference_no: 'TEST-1',
    p_bank_account_id: null,
    p_amount: 50,
    p_remarks: 'test 1',
    p_allocations: [
      { bill_id: bill.id, amount: 50 }
    ],
    p_created_by: null
  });
  console.log("Res 1:", res1, "Err 1:", err1);
  const { data: b1 } = await supabase.from("sale_bills").select("paid_amount, payment_status").eq("id", bill.id).single();
  console.log("Bill 1 status:", b1);

  // Check payment_allocations table
  const { data: allocs } = await supabase.from("payment_allocations").select("*").eq("payment_id", res1);
  console.log("Payment allocations recorded:", allocs);
}

testSingleKeys();
