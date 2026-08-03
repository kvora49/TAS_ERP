import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { allocations } = body;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json({ error: "No roll allocations specified" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Perform allocations and stock ledger writes
    for (const alloc of allocations) {
      const { purchase_roll_id, allocated_meters } = alloc;

      // 1. Fetch original roll details
      const { data: roll, error: rollError } = await supabase
        .from("purchase_rolls")
        .select(`
          *,
          item:raw_material_purchase_items (
            material_type_id,
            rate,
            purchase:raw_material_purchases (godown_id)
          )
        `)
        .eq("id", purchase_roll_id)
        .eq("business_id", businessId)
        .single();

      if (rollError || !roll) {
        throw new Error(`Failed to find roll ${purchase_roll_id}: ${rollError?.message || "Not found"}`);
      }

      const nextRemaining = Math.max(0, Number(roll.remaining_meters || 0) - Number(allocated_meters));

      // 2. Update purchase roll remaining meters
      const { error: updateError } = await supabase
        .from("purchase_rolls")
        .update({ remaining_meters: nextRemaining })
        .eq("id", purchase_roll_id);

      if (updateError) {
        throw new Error(`Failed to update roll ${purchase_roll_id}: ${updateError.message}`);
      }

      // 3. Write negative stock delta to stock_ledger
      const rate = Number(roll.item?.rate || 0);
      const valDelta = Number(allocated_meters) * rate;

      const { error: ledgerError } = await supabase
        .from("stock_ledger")
        .insert({
          business_id: businessId,
          item_type: 'raw_material',
          item_id: roll.item?.material_type_id,
          godown_id: roll.item?.purchase?.godown_id,
          transaction_type: 'production_lot_allocation',
          quantity_delta: -Number(allocated_meters),
          value_delta: -valDelta,
          reference_table: 'purchase_rolls',
          reference_id: purchase_roll_id,
          created_by: user?.id || null,
        });

      if (ledgerError) {
        throw new Error(`Failed to write stock ledger for roll ${purchase_roll_id}: ${ledgerError.message}`);
      }

      // Fetch default godown if roll purchase godown_id is missing
      let godownId = roll.item?.purchase?.godown_id;
      if (!godownId) {
        const { data: defaultG } = await supabase
          .from("godowns")
          .select("id")
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();
        godownId = defaultG?.id;
      }

      const matTypeId = roll.item?.material_type_id;
      if (godownId && matTypeId) {
        const { data: stockEntry } = await supabase
          .from("raw_material_current_stock")
          .select("*")
          .eq("business_id", businessId)
          .eq("material_type_id", matTypeId)
          .eq("godown_id", godownId)
          .maybeSingle();

        if (stockEntry) {
          const updatedQty = Math.max(0, Number(stockEntry.current_stock || 0) - Number(allocated_meters));
          const updatedValue = Math.max(0, Number(stockEntry.stock_value || 0) - valDelta);
          const updatedUnitCost = updatedQty > 0 ? Number((updatedValue / updatedQty).toFixed(2)) : Number(stockEntry.unit_cost || 0);

          await supabase
            .from("raw_material_current_stock")
            .update({
              current_stock: updatedQty,
              stock_value: updatedValue,
              unit_cost: updatedUnitCost,
              updated_at: new Date().toISOString(),
            })
            .eq("id", stockEntry.id);
        }

        // Auto-register Stock Entry Voucher for Stock Movement Registers
        const entryNumber = `STK-OUT-LOT-${roll.roll_number || purchase_roll_id.slice(0, 6)}`;
        const { data: seVoucher } = await supabase
          .from("raw_material_stock_entries")
          .insert({
            business_id: businessId,
            stock_entry_number: entryNumber,
            entry_type: "stock_out",
            posting_date: new Date().toISOString().split("T")[0],
            godown_id: godownId,
            reference_type: "production",
            reference_id: purchase_roll_id,
            remarks: `Production Lot Allocation (Roll ${roll.roll_number || ''})`,
            total_items_value: valDelta,
            grand_total: valDelta,
            status: "active",
          })
          .select()
          .single();

        if (seVoucher) {
          await supabase.from("raw_material_stock_entry_items").insert({
            business_id: businessId,
            stock_entry_id: seVoucher.id,
            material_type_id: matTypeId,
            unit: "meter",
            quantity: Number(allocated_meters),
            rate: rate,
            amount: valDelta,
          });
        }
      }
    }

    try {
      const { reconcileRawMaterialStock } = await import("@/lib/stock-reconciliation");
      await reconcileRawMaterialStock(supabase, businessId);
    } catch (recErr) {
      console.warn("Reconciliation on roll allocation warning:", recErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
