const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findKeys() {
  const { data: bill } = await supabase.from("sale_bills").select("*").limit(1).single();
  console.log("Bill:", bill.id, "Paid:", bill.paid_amount, "Status:", bill.payment_status);

  const testPayloads = [
    { name: "billId & allocatedAmount", payload: [{ billId: bill.id, allocatedAmount: 50, billType: "sale_bill" }] },
    { name: "bill_id & allocated_amount", payload: [{ bill_id: bill.id, allocated_amount: 50, bill_type: "sale_bill" }] },
    { name: "bill_id & amount", payload: [{ bill_id: bill.id, amount: 50, bill_type: "sale_bill" }] },
    { name: "invoice_id & amount", payload: [{ invoice_id: bill.id, amount: 50 }] },
    { name: "reference_id & amount", payload: [{ reference_id: bill.id, amount: 50, reference_table: "sale_bills" }] },
  ];

  for (const item of testPayloads) {
    const { data: pId, error: pErr } = await supabase.rpc("record_payment", {
      p_business_id: bill.business_id,
      p_direction: "received",
      p_party_id: bill.party_id,
      p_payment_date: '2026-07-22',
      p_payment_mode: 'bank_transfer',
      p_reference_no: 'TEST-KEY-' + item.name,
      p_bank_account_id: null,
      p_amount: 50,
      p_remarks: 'test',
      p_allocations: item.payload,
      p_created_by: null
    });

    const { data: checkBill } = await supabase.from("sale_bills").select("paid_amount, payment_status").eq("id", bill.id).single();
    const { data: checkAlloc } = await supabase.from("payment_allocations").select("*").eq("payment_id", pId);

    console.log(`Test [${item.name}]: PaymentID=${pId}, BillPaid=${checkBill.paid_amount}, Status=${checkBill.payment_status}, AllocsCount=${checkAlloc?.length || 0}`);
  }
}

findKeys();
