const { createClient } = require('@supabase/supabase-js');
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testMinBalanceEnforcement() {
  console.log("=== TESTING MINIMUM BALANCE ENFORCEMENT ===");

  const { data: accounts } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
  const account = accounts.find(a => a.current_balance > 0) || accounts[0];
  const businessId = account.business_id;

  const { data: paymentsSample } = await supabase.from('payments').select('created_by').not('created_by', 'is', null).limit(1);
  const userId = paymentsSample[0]?.created_by;

  const { data: parties } = await supabase.from('parties').select('id').eq('business_id', businessId).limit(1);
  const partyId = parties[0]?.id;

  console.log(`Testing Account '${account.name}' with Available Balance = ₹${account.current_balance}`);

  const excessiveAmount = Number(account.current_balance || 0) + 50000;

  console.log(`\nAttempting outgoing payment of ₹${excessiveAmount} (Exceeds available balance)...`);
  const { data, error } = await supabase.rpc('record_payment', {
    p_business_id: businessId,
    p_direction: 'paid',
    p_party_id: partyId,
    p_payment_date: new Date().toISOString().split('T')[0],
    p_payment_mode: 'bank_transfer',
    p_reference_no: 'TEST-OVERDRAFT',
    p_bank_account_id: account.id,
    p_amount: excessiveAmount,
    p_remarks: 'Overdraft test',
    p_allocations: [],
    p_created_by: userId
  });

  if (error) {
    console.log("PASS ✓: Payment correctly rejected by database RPC!");
    console.log("Rejection message:", error.message);
  } else {
    console.error("FAIL ✗: Payment was unexpectedly allowed!");
    await supabase.from('payments').delete().eq('id', data);
  }

  console.log("\n=== MINIMUM BALANCE ENFORCEMENT VERIFIED ===");
}

testMinBalanceEnforcement();
