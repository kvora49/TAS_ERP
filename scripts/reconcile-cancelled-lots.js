const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runReconciliation() {
  console.log("=== STARTING DATA RECONCILIATION ===");

  const lot1Id = '97601e88-c065-4e27-b558-492018f08939';
  const lot2Id = 'b463d939-16c8-413f-b979-0510018bdc4c';

  // 1. Reconcile Lot #1 (Cancelled Lot)
  console.log("\n1. Reconciling Cancelled Lot #1 (ID:", lot1Id, ")...");
  const { data: lot1 } = await supabase.from('production_lots').select('*').eq('id', lot1Id).single();
  
  if (lot1) {
    const { data: lot1Rolls } = await supabase.from('lot_rolls').select('*').eq('lot_id', lot1Id);
    console.log("Found Lot #1 rolls:", lot1Rolls);

    if (lot1Rolls && lot1Rolls.length > 0) {
      for (const lr of lot1Rolls) {
        const allocated = Number(lr.allocated_meters || 0);
        console.log(`Releasing ${allocated}m for roll ID ${lr.purchase_roll_id}...`);

        const { data: roll } = await supabase
          .from('purchase_rolls')
          .select(`
            *,
            item:raw_material_purchase_items (
              material_type_id,
              rate,
              purchase:raw_material_purchases (godown_id)
            )
          `)
          .eq('id', lr.purchase_roll_id)
          .single();

        if (roll) {
          const newRemaining = Number(roll.remaining_meters || 0) + allocated;
          await supabase
            .from('purchase_rolls')
            .update({ remaining_meters: newRemaining })
            .eq('id', lr.purchase_roll_id);
          console.log(`Updated Roll ${roll.roll_number} remaining meters to ${newRemaining}m.`);

          const godownId = roll.item?.purchase?.godown_id;
          const matTypeId = roll.item?.material_type_id;
          const rate = Number(roll.item?.rate || 0);
          const valDelta = allocated * rate;

          if (godownId && matTypeId) {
            const { data: stockEntry } = await supabase
              .from('raw_material_current_stock')
              .select('*')
              .eq('business_id', lot1.business_id)
              .eq('material_type_id', matTypeId)
              .eq('godown_id', godownId)
              .maybeSingle();

            if (stockEntry) {
              const updatedQty = Number(stockEntry.current_stock || 0) + allocated;
              const updatedValue = Number(stockEntry.stock_value || 0) + valDelta;
              const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stockEntry.unit_cost || 0);

              await supabase
                .from('raw_material_current_stock')
                .update({
                  current_stock: updatedQty,
                  stock_value: updatedValue,
                  unit_cost: updatedUnitCost,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', stockEntry.id);
              console.log(`Updated Raw Material current stock to ${updatedQty}m.`);
            }

            await supabase
              .from('stock_ledger')
              .insert({
                business_id: lot1.business_id,
                item_type: 'raw_material',
                item_id: matTypeId,
                godown_id: godownId,
                transaction_type: 'production_lot_cancellation_roll_release',
                quantity_delta: allocated,
                value_delta: valDelta,
                reference_table: 'production_lots',
                reference_id: lot1Id,
              });
            console.log(`Inserted stock_ledger release entry (+${allocated}m).`);
          }
        }
      }
    }
  }

  // 2. Reconcile Lot #2 Unused Accessory (1 Piece black buttons)
  console.log("\n2. Reconciling Lot #2 Unused Accessory (ID:", lot2Id, ")...");
  const { data: lot2 } = await supabase.from('production_lots').select('*').eq('id', lot2Id).single();

  if (lot2) {
    const { data: lot2Accs } = await supabase.from('production_lot_accessories').select('*').eq('lot_id', lot2Id);
    
    if (lot2Accs && lot2Accs.length > 0) {
      for (const acc of lot2Accs) {
        const allocated = Number(acc.allocated_qty || 0);
        const issued = Number(acc.total_issued_qty || 0);
        const unused = Math.max(0, allocated - issued);

        console.log(`Lot #2 Accessory "${acc.item_name}": Allocated = ${allocated}, Issued = ${issued}, Unused = ${unused}`);

        if (unused > 0 && acc.purchase_item_id) {
          const { data: pItem } = await supabase
            .from('raw_material_purchase_items')
            .select(`
              material_type_id,
              rate,
              purchase:raw_material_purchases (godown_id)
            `)
            .eq('id', acc.purchase_item_id)
            .single();

          const godownId = acc.godown_id || (pItem && pItem.purchase ? pItem.purchase.godown_id : null);
          const matTypeId = pItem ? pItem.material_type_id : null;
          const rate = Number(acc.unit_rate || (pItem ? pItem.rate : 0) || 0);
          const valDelta = unused * rate;

          if (godownId && matTypeId) {
            const { data: stockEntry } = await supabase
              .from('raw_material_current_stock')
              .select('*')
              .eq('business_id', lot2.business_id)
              .eq('material_type_id', matTypeId)
              .eq('godown_id', godownId)
              .maybeSingle();

            if (stockEntry) {
              const updatedQty = Number(stockEntry.current_stock || 0) + unused;
              const updatedValue = Number(stockEntry.stock_value || 0) + valDelta;
              const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stockEntry.unit_cost || 0);

              await supabase
                .from('raw_material_current_stock')
                .update({
                  current_stock: updatedQty,
                  stock_value: updatedValue,
                  unit_cost: updatedUnitCost,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', stockEntry.id);
              console.log(`Updated Raw Material stock for "${acc.item_name}" to ${updatedQty} pcs.`);
            }

            await supabase
              .from('stock_ledger')
              .insert({
                business_id: lot2.business_id,
                item_type: 'raw_material',
                item_id: matTypeId,
                godown_id: godownId,
                transaction_type: 'production_lot_return_unused_accessory',
                quantity_delta: unused,
                value_delta: valDelta,
                reference_table: 'production_lots',
                reference_id: lot2Id,
              });
            console.log(`Inserted stock_ledger return entry (+${unused} pcs).`);
          }
        }
      }
    }
  }

  console.log("\n=== RECONCILIATION COMPLETE ===");
}

runReconciliation().catch(console.error);
