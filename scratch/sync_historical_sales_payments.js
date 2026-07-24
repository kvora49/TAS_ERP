const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncHistoricalData() {
  console.log("=== 1. RECONCILING PREVIOUS PAYMENTS & BILL PAYMENT STATUSES ===");

  // A. Fetch all payments
  const { data: payments, error: pErr } = await supabase
    .from("payments")
    .select("*, allocations:payment_allocations(*)")
    .neq("status", "cancelled");

  if (pErr) {
    console.error("Error fetching payments:", pErr);
  } else {
    console.log(`Found ${payments?.length || 0} active payments to check for allocation backfill.`);

    // Map bill_id -> total allocated amount
    const billPaidMap = new Map();

    for (const p of payments || []) {
      const allocs = p.allocations || [];
      for (const a of allocs) {
        if (a.bill_id && Number(a.amount || 0) > 0) {
          const current = billPaidMap.get(a.bill_id) || 0;
          billPaidMap.set(a.bill_id, current + Number(a.amount));
        }
      }
    }

    // Update all sale_bills
    const { data: bills } = await supabase.from("sale_bills").select("id, grand_total, paid_amount, payment_status");
    for (const b of bills || []) {
      const allocated = billPaidMap.get(b.id) || 0;
      if (allocated > 0 || Number(b.paid_amount || 0) !== allocated) {
        const grandTotal = Number(b.grand_total || 0);
        const newPaid = Math.min(grandTotal, Math.max(Number(b.paid_amount || 0), allocated));
        const newStatus = newPaid >= grandTotal ? "paid" : newPaid > 0 ? "partially_paid" : "unpaid";

        await supabase
          .from("sale_bills")
          .update({
            paid_amount: newPaid,
            payment_status: newStatus,
          })
          .eq("id", b.id);

        console.log(`Updated Sale Bill ${b.id}: Paid ${newPaid}/${grandTotal} (${newStatus})`);
      }
    }
  }

  console.log("\n=== 2. RECONCILING FINISHED STOCK DEDUCTIONS FOR PREVIOUS SALE BILLS ===");

  // Fetch all active sale_bills
  const { data: saleBills, error: sbErr } = await supabase
    .from("sale_bills")
    .select("id, business_id, created_by")
    .neq("status", "cancelled");

  if (sbErr) {
    console.error("Error fetching sale bills:", sbErr);
    return;
  }

  // Fetch default godown if needed
  const { data: defaultGodowns } = await supabase.from("godowns").select("id, business_id");
  const defaultGodownMap = new Map((defaultGodowns || []).map((g) => [g.business_id, g.id]));

  for (const bill of saleBills || []) {
    // Check if stock_ledger already has outflow entries for this bill
    const { data: existingLedger } = await supabase
      .from("stock_ledger")
      .select("id")
      .eq("reference_table", "sale_bills")
      .eq("reference_id", bill.id)
      .limit(1);

    if (!existingLedger || existingLedger.length === 0) {
      console.log(`Bill ${bill.id} missing stock outflow. Processing line items...`);

      const { data: items } = await supabase
        .from("sale_bill_items")
        .select("*")
        .eq("bill_id", bill.id);

      const targetGodownId = bill.godown_id || defaultGodownMap.get(bill.business_id);

      if (targetGodownId && items && items.length > 0) {
        for (const item of items) {
          const qty = Number(item.quantity || 0);
          if (qty <= 0) continue;

          // Insert stock_ledger entry
          await supabase.from("stock_ledger").insert({
            business_id: bill.business_id,
            item_type: "finished_good",
            item_id: item.design_id,
            godown_id: targetGodownId,
            transaction_type: "sale_bill_outflow",
            quantity_delta: -qty,
            value_delta: -Number(item.amount || 0),
            reference_table: "sale_bills",
            reference_id: bill.id,
            created_by: bill.created_by || null,
          });

          // Update finished_stock table if record exists
          const { data: existingFs } = await supabase
            .from("finished_stock")
            .select("*")
            .eq("business_id", bill.business_id)
            .eq("design_id", item.design_id)
            .eq("godown_id", targetGodownId)
            .maybeSingle();

          if (existingFs) {
            const currentSizeQty = existingFs.size_quantities || {};
            const sz = item.size || "all";
            const newSzQty = Math.max(0, Number(currentSizeQty[sz] || 0) - qty);
            const newTotalQty = Math.max(0, Number(existingFs.total_quantity || 0) - qty);

            await supabase
              .from("finished_stock")
              .update({
                size_quantities: { ...currentSizeQty, [sz]: newSzQty },
                total_quantity: newTotalQty,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingFs.id);
          }
          console.log(`Deducted ${qty} Pcs of Design ${item.design_id} (Size ${item.size}) from Finished Stock.`);
        }
      }
    }
  }

  console.log("\n=== HISTORICAL RECONCILIATION COMPLETED SUCCESSFULLY ===");
}

syncHistoricalData();
