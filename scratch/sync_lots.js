const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncLots() {
  console.log("1. Backfilling missing size_set_id for all production_lots...");
  const { data: lots, error: lotsErr } = await supabase
    .from("production_lots")
    .select("id, design_id, size_set_id, status, total_quantity, colour_id, business_id");

  if (lotsErr) {
    console.error("Error fetching lots:", lotsErr);
    return;
  }

  const { data: designs } = await supabase.from("designs").select("id, size_set_id");
  const designSizeSetMap = new Map((designs || []).map((d) => [d.id, d.size_set_id]));

  for (const lot of lots) {
    // A. Backfill size_set_id if missing
    if (!lot.size_set_id && lot.design_id) {
      const designSizeSetId = designSizeSetMap.get(lot.design_id);
      if (designSizeSetId) {
        await supabase
          .from("production_lots")
          .update({ size_set_id: designSizeSetId })
          .eq("id", lot.id);
        console.log(`Updated lot ${lot.id} size_set_id to ${designSizeSetId}`);
        lot.size_set_id = designSizeSetId;
      }
    }

    // B. If lot status is completed, push to finished_stock if not present
    if (lot.status === "completed") {
      const { data: existingFs } = await supabase
        .from("finished_stock")
        .select("id")
        .eq("lot_id", lot.id)
        .limit(1);

      if (!existingFs || existingFs.length === 0) {
        console.log(`Lot ${lot.id} is COMPLETED but missing from finished_stock. Pushing now...`);

        // Fetch godown
        const { data: godowns } = await supabase
          .from("godowns")
          .select("id")
          .eq("business_id", lot.business_id)
          .limit(1);
        const godownId = godowns && godowns.length > 0 ? godowns[0].id : null;

        if (godownId) {
          // Fetch size quantities
          const { data: sizeQuantities } = await supabase
            .from("lot_size_quantities")
            .select("*")
            .eq("lot_id", lot.id);

          const colourGroups = {};
          if (sizeQuantities && sizeQuantities.length > 0) {
            sizeQuantities.forEach((sq) => {
              const colId = sq.colour_id || "default";
              if (!colourGroups[colId]) colourGroups[colId] = [];
              colourGroups[colId].push({ size: sq.size, quantity: sq.quantity });
            });
          } else {
            colourGroups["default"] = [{ size: "ALL", quantity: lot.total_quantity || 0 }];
          }

          for (const [colId, items] of Object.entries(colourGroups)) {
            const sizeQtyJson = {};
            let colourTotalQty = 0;
            items.forEach((item) => {
              sizeQtyJson[item.size] = item.quantity;
              colourTotalQty += item.quantity;
            });

            const actualColourId = colId === "default" ? (lot.colour_id || null) : colId;

            const { data: fsEntry, error: fsErr } = await supabase
              .from("finished_stock")
              .insert({
                business_id: lot.business_id,
                design_id: lot.design_id,
                colour_id: actualColourId,
                size_set_id: lot.size_set_id,
                lot_id: lot.id,
                godown_id: godownId,
                entry_type: "production",
                size_quantities: sizeQtyJson,
                total_quantity: colourTotalQty,
                cost_per_piece: 0,
                total_value: 0,
              })
              .select("*")
              .single();

            if (fsErr) {
              console.error(`Finished stock insert error for lot ${lot.id}:`, fsErr);
            } else {
              console.log(`Successfully pushed lot ${lot.id} (${colourTotalQty} Pcs) to finished_stock! Entry:`, fsEntry.id);

              await supabase.from("stock_ledger").insert({
                business_id: lot.business_id,
                item_type: "finished_good",
                item_id: lot.design_id,
                godown_id: godownId,
                transaction_type: "production_lot_finished_good_push",
                quantity_delta: colourTotalQty,
                value_delta: 0,
                reference_table: "production_lots",
                reference_id: lot.id,
              });
            }
          }
        }
      }
    }
  }

  console.log("Sync completed successfully!");
}

syncLots();
