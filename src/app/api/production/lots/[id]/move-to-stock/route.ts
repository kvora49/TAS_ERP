import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const { design_number, godown_id } = body;

    if (!design_number || !godown_id) {
      return NextResponse.json({ error: "Missing design number or godown selection" }, { status: 400 });
    }

    // 1. Fetch Lot detail with design
    const { data: lot, error: lotError } = await supabase
      .from("production_lots")
      .select(`
        *,
        design:designs(id, name, code:design_number)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (lotError || !lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Verify design number matches
    if (design_number.trim().toLowerCase() !== lot.design?.code?.trim().toLowerCase()) {
      return NextResponse.json({ error: `Design number mismatch. Expected: ${lot.design?.code}` }, { status: 400 });
    }

    // 2. Fetch Size Quantities grouped by colour
    const { data: sizeQuantities, error: sqError } = await supabase
      .from("lot_size_quantities")
      .select("*")
      .eq("lot_id", id)
      .eq("business_id", businessId);

    if (sqError || !sizeQuantities || sizeQuantities.length === 0) {
      return NextResponse.json({ error: "No size quantities found for this lot" }, { status: 400 });
    }

    // 3. Fetch Lot Rolls for costing calculation
    const { data: lotRolls } = await supabase
      .from("lot_rolls")
      .select(`
        allocated_meters,
        purchase_roll:purchase_rolls (
          item:raw_material_purchase_items (rate)
        )
      `)
      .eq("lot_id", id)
      .eq("business_id", businessId);

    // 4. Fetch Stage Entries for labor cost calculation
    const { data: stageEntries } = await supabase
      .from("stage_entries")
      .select("qty_out, job_work_rate")
      .eq("lot_id", id)
      .eq("business_id", businessId);

    // Calculations
    const totalFabricCost = (lotRolls || []).reduce((acc: number, curr: any) => {
      const rate = Number(curr.purchase_roll?.item?.rate || 0);
      return acc + (Number(curr.allocated_meters || 0) * rate);
    }, 0);

    const totalLaborCost = (stageEntries || []).reduce((acc: number, curr: any) => {
      const rate = Number(curr.job_work_rate || 0);
      const qty = Number(curr.qty_out || 0);
      return acc + (qty * rate);
    }, 0);

    const totalLotCost = totalFabricCost + totalLaborCost + Number(lot.accessory_cost || 0) + Number(lot.other_cost || 0);
    const totalQty = Number(lot.total_quantity || 0);
    const costPerPiece = totalQty > 0 ? (totalLotCost / totalQty) : 0;

    // Group size quantities by colour_id
    const colourGroups: Record<string, Array<{ size: string, quantity: number }>> = {};
    sizeQuantities.forEach((sq) => {
      const colId = sq.colour_id || "default";
      if (!colourGroups[colId]) {
        colourGroups[colId] = [];
      }
      colourGroups[colId].push({ size: sq.size, quantity: sq.quantity });
    });

    const { data: { user } } = await supabase.auth.getUser();

    // 5. Insert into finished_stock and write to stock_ledger
    for (const [colId, items] of Object.entries(colourGroups)) {
      const sizeQtyJson: Record<string, number> = {};
      let colourTotalQty = 0;
      items.forEach((item) => {
        sizeQtyJson[item.size] = item.quantity;
        colourTotalQty += item.quantity;
      });

      const actualColourId = colId === "default" ? null : colId;
      const totalVal = colourTotalQty * costPerPiece;

      // Insert finished_stock
      const { data: fsEntry, error: fsError } = await supabase
        .from("finished_stock")
        .insert({
          business_id: businessId,
          design_id: lot.design_id,
          colour_id: actualColourId,
          size_set_id: lot.size_set_id,
          lot_id: lot.id,
          godown_id,
          entry_type: "production",
          size_quantities: sizeQtyJson,
          total_quantity: colourTotalQty,
          cost_per_piece: costPerPiece,
          total_value: totalVal,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (fsError) {
        throw new Error(`Failed to insert finished stock: ${fsError.message}`);
      }

      // Write to stock_ledger
      const { error: ledgerError } = await supabase
        .from("stock_ledger")
        .insert({
          business_id: businessId,
          item_type: "finished_good",
          item_id: lot.design_id,
          godown_id,
          transaction_type: "production_lot_finished_good_push",
          quantity_delta: colourTotalQty,
          value_delta: totalVal,
          reference_table: "production_lots",
          reference_id: lot.id,
          created_by: user?.id || null,
        });

      if (ledgerError) {
        throw new Error(`Failed to write stock ledger for finished goods: ${ledgerError.message}`);
      }
    }

    // 6. Update Lot status to completed
    const { error: updateLotError } = await supabase
      .from("production_lots")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user?.id || null,
      })
      .eq("id", id);

    if (updateLotError) {
      throw new Error(`Failed to finalize lot status: ${updateLotError.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
