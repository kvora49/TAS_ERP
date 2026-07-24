const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAllocKeys() {
  const { data: bill } = await supabase.from("sale_bills").select("*").limit(1).single();
  if (!bill) {
    console.log("No bill found.");
    return;
  }
  console.log("Found bill:", bill.id, bill.bill_number, "Party:", bill.party_id, "Paid:", bill.paid_amount, "Status:", bill.payment_status);

  // Test different key names: bill_id vs billId, amount vs allocated_amount vs allocatedAmount
  const { data: res, error: err } = await supabase.rpc("record_payment", {
    p_business_id: bill.business_id,
    p_direction: "received",
    p_party_id: bill.party_id,
    p_payment_date: '2026-07-22',
    p_payment_mode: 'bank_transfer',
    p_reference_no: 'TEST-ALLOC-KEYS',
    p_bank_account_id: null,
    p_amount: 100,
    p_remarks: 'test allocation key names',
    p_allocations: [
      { bill_id: bill.id, billId: bill.id, amount: 100, allocated_amount: 100, allocatedAmount: 100, bill_type: 'sale_bill', billType: 'sale_bill' }
    ],
    p_created_by: null
  });

  console.log("RPC Result Payment ID:", res);
  console.log("RPC Error:", err);

  const { data: updatedBill } = await supabase.from("sale_bills").select("paid_amount, payment_status").eq("id", bill.id).single();
  console.log("Updated Bill after RPC:", updatedBill);
}

testAllocKeys();
