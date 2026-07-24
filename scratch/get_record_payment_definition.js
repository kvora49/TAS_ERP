const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getDefinition() {
  const { data, error } = await supabase.rpc('record_payment', {
    p_business_id: 'invalid',
    p_direction: 'received',
    p_party_id: 'invalid',
    p_payment_date: '2026-01-01',
    p_payment_mode: 'cash',
    p_reference_no: '',
    p_bank_account_id: null,
    p_amount: 0,
    p_remarks: '',
    p_allocations: [{ billId: 'test', allocatedAmount: 100 }],
    p_created_by: null
  });

  console.log("RPC Call with dummy allocation Result:", data, "Error:", error);
}

getDefinition();
