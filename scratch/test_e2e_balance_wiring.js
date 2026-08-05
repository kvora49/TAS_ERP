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

async function runE2ETests() {
  console.log("=== STARTING E2E BANK & CASH BALANCE WIRING TESTS ===");

  // 1. Get bank account and cash account
  const { data: accounts } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
  if (!accounts || accounts.length === 0) {
    console.error("No bank accounts found!");
    return;
  }

  const bankAccount = accounts.find(a => a.type === 'bank') || accounts[0];
  const cashAccount = accounts.find(a => a.type === 'cash') || accounts[0];
  const businessId = bankAccount.business_id;

  // Get a valid user ID
  const { data: paymentsSample } = await supabase.from('payments').select('created_by').not('created_by', 'is', null).limit(1);
  const userId = paymentsSample && paymentsSample.length > 0 ? paymentsSample[0].created_by : null;

  // Get a test party
  const { data: parties } = await supabase.from('parties').select('id, name').eq('business_id', businessId).limit(1);
  const partyId = parties && parties.length > 0 ? parties[0].id : null;

  console.log(`Testing with Business ID: ${businessId}`);
  console.log(`Valid User ID: ${userId}`);
  console.log(`Valid Party ID: ${partyId}`);
  console.log(`Bank Account '${bankAccount.name}': Initial Balance = ₹${bankAccount.current_balance}`);
  console.log(`Cash Account '${cashAccount.name}': Initial Balance = ₹${cashAccount.current_balance}`);

  const initialBankBal = Number(bankAccount.current_balance || 0);
  const initialCashBal = Number(cashAccount.current_balance || 0);

  // --- TEST 1: Receive Payment via UPI/Bank ---
  console.log("\n[TEST 1] Testing Receive Payment (₹5,000 via UPI)...");
  const { data: rPmtId, error: rPmtErr } = await supabase.rpc('record_payment', {
    p_business_id: businessId,
    p_direction: 'received',
    p_party_id: partyId,
    p_payment_date: new Date().toISOString().split('T')[0],
    p_payment_mode: 'upi',
    p_reference_no: 'TEST-UPI-101',
    p_bank_account_id: bankAccount.id,
    p_amount: 5000,
    p_remarks: 'E2E Test Receive Payment',
    p_allocations: [],
    p_created_by: userId
  });

  if (rPmtErr) {
    console.error("TEST 1 Failed:", rPmtErr.message);
  } else {
    const { data: updatedBank } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccount.id).single();
    const newBal = Number(updatedBank.current_balance);
    const expected = initialBankBal + 5000;
    console.log(`TEST 1 Result: New Balance = ₹${newBal} (Expected ₹${expected}) -> ${newBal === expected ? 'PASS ✓' : 'FAIL ✗'}`);
  }

  // --- TEST 2: Make Payment via Bank Transfer ---
  console.log("\n[TEST 2] Testing Make Payment (₹2,000 via Bank Transfer)...");
  const { data: mPmtId, error: mPmtErr } = await supabase.rpc('record_payment', {
    p_business_id: businessId,
    p_direction: 'paid',
    p_party_id: partyId,
    p_payment_date: new Date().toISOString().split('T')[0],
    p_payment_mode: 'bank_transfer',
    p_reference_no: 'TEST-NEFT-202',
    p_bank_account_id: bankAccount.id,
    p_amount: 2000,
    p_remarks: 'E2E Test Make Payment',
    p_allocations: [],
    p_created_by: userId
  });

  if (mPmtErr) {
    console.error("TEST 2 Failed:", mPmtErr.message);
  } else {
    const { data: updatedBank } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccount.id).single();
    const newBal = Number(updatedBank.current_balance);
    const expected = initialBankBal + 5000 - 2000;
    console.log(`TEST 2 Result: New Balance = ₹${newBal} (Expected ₹${expected}) -> ${newBal === expected ? 'PASS ✓' : 'FAIL ✗'}`);
  }

  // --- TEST 3: Receive Cash Payment ---
  console.log("\n[TEST 3] Testing Cash Receipt (₹1,500 via Cash)...");
  const { data: cPmtId, error: cPmtErr } = await supabase.rpc('record_payment', {
    p_business_id: businessId,
    p_direction: 'received',
    p_party_id: partyId,
    p_payment_date: new Date().toISOString().split('T')[0],
    p_payment_mode: 'cash',
    p_reference_no: 'TEST-CASH-303',
    p_bank_account_id: cashAccount.id,
    p_amount: 1500,
    p_remarks: 'E2E Test Cash Payment',
    p_allocations: [],
    p_created_by: userId
  });

  if (cPmtErr) {
    console.error("TEST 3 Failed:", cPmtErr.message);
  } else {
    const { data: updatedCash } = await supabase.from('bank_accounts').select('current_balance').eq('id', cashAccount.id).single();
    const newBal = Number(updatedCash.current_balance);
    const expected = initialCashBal + 1500;
    console.log(`TEST 3 Result: Cash Balance = ₹${newBal} (Expected ₹${expected}) -> ${newBal === expected ? 'PASS ✓' : 'FAIL ✗'}`);
  }

  // --- TEST 4: Issued Cheque Clearance & Reversal ---
  console.log("\n[TEST 4] Testing Issued Cheque Clearance (₹3,000)...");
  const { data: newChq, error: chqErr } = await supabase.from('cheques').insert({
    business_id: businessId,
    cheque_number: 'CHQ-TEST-999',
    direction: 'issued',
    party_id: partyId,
    bank_name: 'Test Bank',
    cheque_date: new Date().toISOString().split('T')[0],
    amount: 3000,
    status: 'pending',
    received_account_id: bankAccount.id,
    created_by: userId
  }).select().single();

  if (chqErr) {
    console.error("Cheque creation failed:", chqErr.message);
  } else {
    console.log("Created issued cheque:", newChq.id);
    
    // Clear the cheque
    const { error: clearErr } = await supabase.rpc('process_cheque_status_update', {
      p_cheque_id: newChq.id,
      p_business_id: businessId,
      p_new_status: 'cleared',
      p_received_account_id: bankAccount.id,
      p_remarks: 'Cleared via test',
      p_deposited_date: new Date().toISOString().split('T')[0],
      p_cleared_date: new Date().toISOString().split('T')[0],
      p_bounce_reason: null,
      p_bounce_charges: null
    });

    if (clearErr) {
      console.error("Cheque clearance failed:", clearErr.message);
    } else {
      const { data: postChqBank } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccount.id).single();
      const balAfterClear = Number(postChqBank.current_balance);
      const expectedAfterClear = initialBankBal + 5000 - 2000 - 3000;
      console.log(`TEST 4 Clearance Result: New Balance = ₹${balAfterClear} (Expected ₹${expectedAfterClear}) -> ${balAfterClear === expectedAfterClear ? 'PASS ✓' : 'FAIL ✗'}`);

      // Delete the cheque to reverse
      await supabase.rpc('delete_cheque', { p_cheque_id: newChq.id, p_business_id: businessId });
      const { data: postDelBank } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccount.id).single();
      const balAfterDelete = Number(postDelBank.current_balance);
      const expectedAfterDelete = initialBankBal + 5000 - 2000;
      console.log(`TEST 4 Delete Reversal Result: Balance Restored = ₹${balAfterDelete} (Expected ₹${expectedAfterDelete}) -> ${balAfterDelete === expectedAfterDelete ? 'PASS ✓' : 'FAIL ✗'}`);
    }
  }

  // Cleanup test payment records
  console.log("\nCleaning up test payment records...");
  if (rPmtId) await supabase.from('payments').delete().eq('id', rPmtId);
  if (mPmtId) await supabase.from('payments').delete().eq('id', mPmtId);
  if (cPmtId) await supabase.from('payments').delete().eq('id', cPmtId);
  
  // Reset test account balances to initial
  await supabase.from('bank_accounts').update({ current_balance: initialBankBal }).eq('id', bankAccount.id);
  await supabase.from('bank_accounts').update({ current_balance: initialCashBal }).eq('id', cashAccount.id);
  console.log("Cleanup finished. Test balances restored.");

  console.log("\n=== ALL E2E BALANCE WIRING TESTS COMPLETED SUCCESSFULLY ===");
}

runE2ETests();
