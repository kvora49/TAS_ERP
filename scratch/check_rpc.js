const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  console.log("Testing record_payment RPC call with native array...");
  // Attempt with native array
  const { data, error } = await supabase.rpc("record_payment", {
    p_business_id: '70f74d68-ade1-4b03-a88a-2b90947dedb0',
    p_direction: "received",
    p_party_id: '864e4ee5-4bcf-4f96-bd76-0bf1dbef9555',
    p_payment_date: '2026-07-22',
    p_payment_mode: 'bank_transfer',
    p_reference_no: 'TEST-123',
    p_bank_account_id: null,
    p_amount: 100,
    p_remarks: 'test',
    p_allocations: [],
    p_created_by: null
  });

  console.log("RPC Data:", data);
  console.log("RPC Error:", error);
}

testRpc();
