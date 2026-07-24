const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPayment() {
  const { data: parties } = await supabase.from("parties").select("id, name").limit(1);
  if (!parties || parties.length === 0) {
    console.log("No parties found.");
    return;
  }
  const party = parties[0];
  console.log("Found party:", party);

  const { data: res, error } = await supabase.rpc("record_payment", {
    p_business_id: '70f74d68-ade1-4b03-a88a-2b90947dedb0',
    p_direction: "received",
    p_party_id: party.id,
    p_payment_date: '2026-07-22',
    p_payment_mode: 'bank_transfer',
    p_reference_no: 'TEST-RPC-123',
    p_bank_account_id: null,
    p_amount: 500,
    p_remarks: 'test allocation RPC',
    p_allocations: [],
    p_created_by: null
  });

  console.log("Payment Created ID:", res);
  console.log("Payment RPC Error:", error);
}

testPayment();
