const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanTestPayments() {
  console.log("=== CLEANING UP TEST PAYMENTS ===");

  // 1. Fetch test payments starting with TEST-
  const { data: testPayments } = await supabase
    .from("payments")
    .select("id, payment_number, reference_no, amount")
    .like("reference_no", "TEST-%");

  console.log(`Found ${testPayments?.length || 0} test payment entries to remove.`);

  if (testPayments && testPayments.length > 0) {
    const ids = testPayments.map((p) => p.id);

    // Delete allocations first
    await supabase.from("payment_allocations").delete().in("payment_id", ids);
    // Delete payments
    await supabase.from("payments").delete().in("id", ids);

    console.log("Successfully removed all test payment records and allocations.");
  }

  // 2. Re-sync paid_amount and payment_status for all sale_bills
  const { data: bills } = await supabase.from("sale_bills").select("id, grand_total");
  for (const b of bills || []) {
    const { data: allocs } = await supabase
      .from("payment_allocations")
      .select("amount")
      .eq("bill_id", b.id);

    const totalPaid = (allocs || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const grandTotal = Number(b.grand_total || 0);
    const status = totalPaid >= grandTotal ? "paid" : totalPaid > 0 ? "partially_paid" : "unpaid";

    await supabase
      .from("sale_bills")
      .update({
        paid_amount: totalPaid,
        payment_status: status,
      })
      .eq("id", b.id);

    console.log(`Bill ${b.id}: Paid ${totalPaid}/${grandTotal} (${status})`);
  }

  console.log("=== CLEANUP & RE-SYNC COMPLETED ===");
}

cleanTestPayments();
