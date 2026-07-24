const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDeductions() {
  console.log("=== RE-EVALUATING FINISHED STOCK DEDUCTIONS FOR ALL SALE BILLS ===");

  const { data: bills } = await supabase.from("sale_bills").select("*").neq("status", "cancelled");
  console.log(`Found ${bills?.length || 0} active sale bills.`);

  for (const bill of bills || []) {
    const { data: items } = await supabase.from("sale_bill_items").select("*").eq("bill_id", bill.id);
    if (!items || items.length === 0) continue;

    for (const item of items) {
      const qty = Number(item.quantity || 0);
      if (qty <= 0) continue;

      // Locate matching finished_stock row with available quantity > 0 or any row for design
      let { data: fsRow } = await supabase
        .from("finished_stock")
        .select("*")
        .eq("business_id", bill.business_id)
        .eq("design_id", item.design_id)
        .gt("total_quantity", 0)
        .order("total_quantity", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!fsRow) {
        const { data } = await supabase
          .from("finished_stock")
          .select("*")
          .eq("business_id", bill.business_id)
          .eq("design_id", item.design_id)
          .limit(1)
          .maybeSingle();
        fsRow = data;
      }

      if (fsRow) {
        const currentSizeQty = fsRow.size_quantities || {};
        const sz = item.size || "all";
        const currentSzQty = Number(currentSizeQty[sz] || 0);
        const newSzQty = Math.max(0, currentSzQty - qty);
        const newTotalQty = Math.max(0, Number(fsRow.total_quantity || 0) - qty);

        const updatedSizes = { ...currentSizeQty };
        if (sz !== "all") {
          updatedSizes[sz] = newSzQty;
        }

        await supabase
          .from("finished_stock")
          .update({
            size_quantities: updatedSizes,
            total_quantity: newTotalQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", fsRow.id);

        console.log(`Deducted ${qty} Pcs of Design ${item.design_id} (Size ${sz}) from Finished Stock Row ${fsRow.id}. New Total: ${newTotalQty}`);
      } else {
        console.warn(`No finished_stock row found for design ${item.design_id}`);
      }
    }
  }

  console.log("\n=== FINISHED STOCK DEDUCTION RE-EVALUATION COMPLETED ===");
}

fixDeductions();
