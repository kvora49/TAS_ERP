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
    const { data: challan, error: chErr } = await supabase
      .from("challans")
      .select("*, from_godown:godowns(name), to_party:parties(name, company_name, email, phone, billing_address, shipping_address)")
      .eq("id", params.id)
      .eq("business_id", businessId)
      .single();

    if (chErr || !challan) {
      return NextResponse.json({ error: "Challan not found" }, { status: 404 });
    }

    const { data: items, error: itemsErr } = await supabase
      .from("challan_items")
      .select("*, design:designs(code:design_number, name), colour:design_colours(colour_name, colour_hex)")
      .eq("challan_id", challan.id);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    return NextResponse.json({ challan, items: items || [] });
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

    // 1. Fetch current challan and its items
    const { data: challan, error: chErr } = await supabase
      .from("challans")
      .select("*")
      .eq("id", params.id)
      .eq("business_id", businessId)
      .single();

    if (chErr || !challan) {
      return NextResponse.json({ error: "Challan not found" }, { status: 404 });
    }

    const oldStatus = challan.status;
    if (oldStatus === status) {
      return NextResponse.json({ challan }); // No change
    }

    const { data: items, error: itemsErr } = await supabase
      .from("challan_items")
      .select("*")
      .eq("challan_id", challan.id);

    if (itemsErr || !items) {
      return NextResponse.json({ error: "Failed to load challan items" }, { status: 500 });
    }

    // 2. Update challan status
    const { data: updatedChallan, error: updateErr } = await supabase
      .from("challans")
      .update({ status })
      .eq("id", params.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Helper functions for stock impact checks
    const hasDeductedStock = (s: string) => ["dispatched", "received", "completed"].includes(s);
    const hasAddedStock = (s: string) => ["received", "completed"].includes(s);

    // 3. Log Compensating Stock Movements
    if (challan.challan_type === "outward") {
      // Transition A: Stock was NOT deducted before, but IS deducted now
      // -> Log challan_out (negative stock)
      if (!hasDeductedStock(oldStatus) && hasDeductedStock(status)) {
        for (const item of items) {
          await supabase
            .from("finished_stock")
            .insert({
              business_id: businessId,
              design_id: item.design_id,
              colour_id: item.colour_id,
              godown_id: challan.from_godown_id,
              entry_type: "challan_out",
              size_quantities: { [item.size]: -Number(item.quantity) },
              total_quantity: -Number(item.quantity),
              cost_per_piece: Number(item.unit_cost),
              total_value: -Number(item.total_value),
            });
        }
      }
      
      // Transition B: Stock WAS deducted before, but is now CANCELLED (or moved back to pending/in_transit)
      // -> Reverse deduction! Log challan_in (positive stock) to add it back
      if (hasDeductedStock(oldStatus) && (status === "cancelled" || !hasDeductedStock(status))) {
        for (const item of items) {
          await supabase
            .from("finished_stock")
            .insert({
              business_id: businessId,
              design_id: item.design_id,
              colour_id: item.colour_id,
              godown_id: challan.from_godown_id,
              entry_type: "challan_in", // compensating entry
              size_quantities: { [item.size]: Number(item.quantity) },
              total_quantity: Number(item.quantity),
              cost_per_piece: Number(item.unit_cost),
              total_value: Number(item.total_value),
            });
        }
      }
    } else if (challan.challan_type === "inward") {
      // Transition C: Stock was NOT added before, but IS added now
      // -> Log challan_in (positive stock)
      if (!hasAddedStock(oldStatus) && hasAddedStock(status)) {
        for (const item of items) {
          await supabase
            .from("finished_stock")
            .insert({
              business_id: businessId,
              design_id: item.design_id,
              colour_id: item.colour_id,
              godown_id: challan.from_godown_id,
              entry_type: "challan_in",
              size_quantities: { [item.size]: Number(item.quantity) },
              total_quantity: Number(item.quantity),
              cost_per_piece: Number(item.unit_cost),
              total_value: Number(item.total_value),
            });
        }
      }

      // Transition D: Stock WAS added before, but is now CANCELLED (or moved back to pending/in_transit)
      // -> Reverse addition! Log challan_out (negative stock) to deduct it
      if (hasAddedStock(oldStatus) && (status === "cancelled" || !hasAddedStock(status))) {
        for (const item of items) {
          await supabase
            .from("finished_stock")
            .insert({
              business_id: businessId,
              design_id: item.design_id,
              colour_id: item.colour_id,
              godown_id: challan.from_godown_id,
              entry_type: "challan_out", // compensating entry
              size_quantities: { [item.size]: -Number(item.quantity) },
              total_quantity: -Number(item.quantity),
              cost_per_piece: Number(item.unit_cost),
              total_value: -Number(item.total_value),
            });
        }
      }
    }

    return NextResponse.json({ challan: updatedChallan });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
