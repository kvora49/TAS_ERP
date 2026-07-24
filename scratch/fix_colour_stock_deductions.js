const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixColourDeductions() {
  console.log("=== 1. RESTORING ALL FINISHED_STOCK ROWS FROM PRODUCTION LOTS ===");

  // Reset finished_stock total_quantity and size_quantities based on production_lots / initial pushes
  const { data: fsRows } = await supabase.from("finished_stock").select("*").is("deleted_at", null);
  for (const fs of fsRows || []) {
    // Check original production push or ledger additions
    const { data: additions } = await supabase
      .from("stock_ledger")
      .select("quantity_delta, value_delta")
      .eq("business_id", fs.business_id)
      .eq("item_type", "finished_good")
      .eq("item_id", fs.design_id)
      .eq("godown_id", fs.godown_id)
      .gt("quantity_delta", 0);

    const totalAdded = (additions || []).reduce((sum, a) => sum + Number(a.quantity_delta || 0), 0);

    if (totalAdded > 0) {
      const costPerPiece = Number(fs.cost_per_piece || 0);
      const restoredVal = totalAdded * costPerPiece;

      // Re-distribute sizes evenly or from size_quantities
      await supabase
        .from("finished_stock")
        .update({
          total_quantity: totalAdded,
          total_value: restoredVal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fs.id);

      console.log(`Restored Finished Stock Row ${fs.id} (Design: ${fs.design_id}, Colour: ${fs.colour_id}, Godown: ${fs.godown_id}) to ${totalAdded} Pcs.`);
    }
  }

  console.log("\n=== 2. APPLYING COLOUR-EXACT DEDUCTIONS FROM SALE BILLS ===");

  const { data: bills } = await supabase.from("sale_bills").select("*").neq("status", "cancelled");

  for (const bill of bills || []) {
    const { data: items } = await supabase.from("sale_bill_items").select("*").eq("bill_id", bill.id);

    for (const item of items || []) {
      const qty = Number(item.quantity || 0);
      if (qty <= 0) continue;

      console.log(`Processing Bill Item: Design=${item.design_id}, Colour=${item.colour_id}, Size=${item.size}, Qty=${qty}`);

      // Query finished_stock for EXACT design_id AND colour_id
      let query = supabase
        .from("finished_stock")
        .select("*")
        .eq("business_id", bill.business_id)
        .eq("design_id", item.design_id);

      if (item.colour_id) {
        query = query.eq("colour_id", item.colour_id);
      }
      if (bill.godown_id) {
        query = query.eq("godown_id", bill.godown_id);
      }

      let { data: targetFs } = await query.limit(1).maybeSingle();

      if (!targetFs && item.colour_id) {
        // Fallback: match design_id and colour_id in any godown
        const { data } = await supabase
          .from("finished_stock")
          .select("*")
          .eq("business_id", bill.business_id)
          .eq("design_id", item.design_id)
          .eq("colour_id", item.colour_id)
          .limit(1)
          .maybeSingle();
        targetFs = data;
      }

      if (targetFs) {
        const currentSizeQty = targetFs.size_quantities || {};
        const sz = item.size || "all";
        const newSzQty = Math.max(0, Number(currentSizeQty[sz] || 0) - qty);
        const newTotalQty = Math.max(0, Number(targetFs.total_quantity || 0) - qty);
        const costPerPiece = Number(targetFs.cost_per_piece || 0);
        const newTotalValue = newTotalQty * costPerPiece;

        const updatedSizes = { ...currentSizeQty };
        if (sz !== "all") {
          updatedSizes[sz] = newSzQty;
        }

        await supabase
          .from("finished_stock")
          .update({
            size_quantities: updatedSizes,
            total_quantity: newTotalQty,
            total_value: newTotalValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetFs.id);

        console.log(`--> EXCLUSIVELY DEDUCTED ${qty} Pcs from Row ${targetFs.id} (Design: ${targetFs.design_id}, Colour: ${targetFs.colour_id}). Remaining: ${newTotalQty} Pcs`);
      } else {
        console.warn(`--> WARNING: No finished_stock row found for Design ${item.design_id} and Colour ${item.colour_id}`);
      }
    }
  }

  console.log("\n=== COLOUR-EXACT STOCK DEDUCTION RECONCILIATION COMPLETED ===");
}

fixColourDeductions();
