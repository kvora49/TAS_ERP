import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: transfers, error } = await supabase
      .from("stock_transfers")
      .select("*, from_godown:godowns!from_godown_id(name), to_godown:godowns!to_godown_id(name)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("transfer_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transfers });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      transfer_date,
      from_godown_id,
      to_godown_id,
      reference_no,
      reason,
      remarks,
      items, // array of transfer items
      status = 'pending'
    } = body;

    // Validate inputs
    if (!transfer_date || !from_godown_id || !to_godown_id || !reason || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "All required fields must be filled" }, { status: 400 });
    }

    if (from_godown_id === to_godown_id) {
      return NextResponse.json({ error: "Source and destination godowns must be different" }, { status: 400 });
    }

    // Auto-generate transfer number (TRF-YYYY-XXXX)
    const year = new Date(transfer_date).getFullYear() || new Date().getFullYear();
    const { data: lastTrf } = await supabase
      .from("stock_transfers")
      .select("transfer_number")
      .eq("business_id", businessId)
      .like("transfer_number", `TRF-${year}-%`)
      .order("transfer_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastTrf && lastTrf.length > 0 && lastTrf[0].transfer_number) {
      const parts = lastTrf[0].transfer_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const transferNumber = `TRF-${year}-${String(nextNum).padStart(4, "0")}`;

    // Calculate totals
    let totalQuantity = 0;
    let totalValue = 0;
    items.forEach((item) => {
      totalQuantity += Number(item.quantity || 0);
      totalValue += Number(item.total_value || 0);
    });

    // Insert transfer header
    const { data: transfer, error: trfErr } = await supabase
      .from("stock_transfers")
      .insert({
        business_id: businessId,
        transfer_number: transferNumber,
        transfer_date,
        from_godown_id,
        to_godown_id,
        reference_no: reference_no || null,
        reason,
        remarks: remarks || null,
        total_quantity: totalQuantity,
        total_value: totalValue,
        status
      })
      .select()
      .single();

    if (trfErr) {
      return NextResponse.json({ error: trfErr.message }, { status: 500 });
    }

    // Insert transfer items
    const transferItemsToInsert = items.map((item) => ({
      business_id: businessId,
      transfer_id: transfer.id,
      design_id: item.design_id,
      colour_id: item.colour_id,
      size: item.size,
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost),
      total_value: Number(item.total_value),
    }));

    const { error: itemsErr } = await supabase
      .from("stock_transfer_items")
      .insert(transferItemsToInsert);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // Log stock movements in finished_stock
    // 1. Deduct immediately from source godown (transfer_out)
    for (const item of items) {
      await supabase
        .from("finished_stock")
        .insert({
          business_id: businessId,
          design_id: item.design_id,
          colour_id: item.colour_id,
          godown_id: from_godown_id,
          entry_type: "transfer_out",
          size_quantities: { [item.size]: -Number(item.quantity) },
          total_quantity: -Number(item.quantity),
          cost_per_piece: Number(item.unit_cost),
          total_value: -Number(item.total_value),
        });
    }

    // 2. If status is completed, add immediately to destination godown (transfer_in)
    if (status === "completed") {
      for (const item of items) {
        await supabase
          .from("finished_stock")
          .insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id,
            godown_id: to_godown_id,
            entry_type: "transfer_in",
            size_quantities: { [item.size]: Number(item.quantity) },
            total_quantity: Number(item.quantity),
            cost_per_piece: Number(item.unit_cost),
            total_value: Number(item.total_value),
          });
      }
    }

    return NextResponse.json({ transfer });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
