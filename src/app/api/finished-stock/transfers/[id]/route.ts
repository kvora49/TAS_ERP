import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: transfer, error: trfErr } = await supabase
      .from("stock_transfers")
      .select("*, from_godown:godowns!from_godown_id(name), to_godown:godowns!to_godown_id(name)")
      .eq("id", params.id)
      .eq("business_id", businessId)
      .single();

    if (trfErr || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    const { data: items, error: itemsErr } = await supabase
      .from("stock_transfer_items")
      .select("*, design:designs(code:design_number, name), colour:design_colours(colour_name, colour_hex)")
      .eq("transfer_id", transfer.id);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    return NextResponse.json({ transfer, items: items || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    // 1. Fetch current transfer and its items
    const { data: transfer, error: trfErr } = await supabase
      .from("stock_transfers")
      .select("*")
      .eq("id", params.id)
      .eq("business_id", businessId)
      .single();

    if (trfErr || !transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    const oldStatus = transfer.status;
    if (oldStatus === status) {
      return NextResponse.json({ transfer }); // No change
    }

    const { data: items, error: itemsErr } = await supabase
      .from("stock_transfer_items")
      .select("*")
      .eq("transfer_id", transfer.id);

    if (itemsErr || !items) {
      return NextResponse.json({ error: "Failed to load transfer items" }, { status: 500 });
    }

    // 2. Update transfer status
    const { data: updatedTransfer, error: updateErr } = await supabase
      .from("stock_transfers")
      .update({ status })
      .eq("id", params.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. Log Compensating Stock Movements
    // Rule A: Transitioning to 'completed' from 'pending' or 'in_transit'
    // -> Add stock to destination (to_godown_id)
    if ((oldStatus === "pending" || oldStatus === "in_transit") && status === "completed") {
      for (const item of items) {
        await supabase
          .from("finished_stock")
          .insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id,
            godown_id: transfer.to_godown_id,
            entry_type: "transfer_in",
            size_quantities: { [item.size]: Number(item.quantity) },
            total_quantity: Number(item.quantity),
            cost_per_piece: Number(item.unit_cost),
            total_value: Number(item.total_value),
          });
      }
    }

    // Rule B: Transitioning to 'cancelled' from 'pending' or 'in_transit'
    // -> Reverse the deduction from source (from_godown_id) - add it back!
    if ((oldStatus === "pending" || oldStatus === "in_transit") && status === "cancelled") {
      for (const item of items) {
        await supabase
          .from("finished_stock")
          .insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id,
            godown_id: transfer.from_godown_id,
            entry_type: "transfer_in", // compensating entry type
            size_quantities: { [item.size]: Number(item.quantity) },
            total_quantity: Number(item.quantity),
            cost_per_piece: Number(item.unit_cost),
            total_value: Number(item.total_value),
          });
      }
    }

    // Rule C: Transitioning to 'cancelled' from 'completed' (Reversal of both sides)
    // -> Add back to source (from_godown_id) AND deduct from destination (to_godown_id)
    if (oldStatus === "completed" && status === "cancelled") {
      for (const item of items) {
        // Add back to source
        await supabase
          .from("finished_stock")
          .insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id,
            godown_id: transfer.from_godown_id,
            entry_type: "transfer_in",
            size_quantities: { [item.size]: Number(item.quantity) },
            total_quantity: Number(item.quantity),
            cost_per_piece: Number(item.unit_cost),
            total_value: Number(item.total_value),
          });

        // Deduct from destination
        await supabase
          .from("finished_stock")
          .insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id,
            godown_id: transfer.to_godown_id,
            entry_type: "transfer_out",
            size_quantities: { [item.size]: -Number(item.quantity) },
            total_quantity: -Number(item.quantity),
            cost_per_piece: Number(item.unit_cost),
            total_value: -Number(item.total_value),
          });
      }
    }

    return NextResponse.json({ transfer: updatedTransfer });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
