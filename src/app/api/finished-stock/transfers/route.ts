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

    // Verify all design_ids belong to finished stock designs table (excluding raw materials & accessories)
    for (const item of items) {
      if (!item.design_id) continue;
      const { data: validDesign } = await supabase
        .from("designs")
        .select("id")
        .eq("id", item.design_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!validDesign) {
        return NextResponse.json(
          { error: "Invalid item selected. Only Finished Garment Designs can be transferred here. Raw materials and accessories are managed in their respective stock modules." },
          { status: 400 }
        );
      }
    }

    const { getBusinessServerSettings } = await import("@/lib/settings/serverSettings");
    const serverSettings = await getBusinessServerSettings(supabase, businessId);

    // If negative stock is disallowed, verify stock availability in source godown
    if (!serverSettings.allow_negative_stock) {
      for (const item of items) {
        if (!item.design_id || !item.quantity || Number(item.quantity) <= 0) continue;
        const { data: stockRow } = await supabase
          .from("finished_stock")
          .select("quantity")
          .eq("business_id", businessId)
          .eq("godown_id", from_godown_id)
          .eq("design_id", item.design_id)
          .maybeSingle();

        const currentQty = Number(stockRow?.quantity || 0);
        const reqQty = Number(item.quantity);
        if (currentQty < reqQty) {
          return NextResponse.json(
            { error: `Insufficient stock in source godown. Available: ${currentQty}, Required: ${reqQty}` },
            { status: 400 }
          );
        }
      }
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

    // Write stock_ledger audit entries for the transfer.
    // finished_stock is rebuilt by reconcileFinishedStock() below — do NOT directly
    // insert into finished_stock here (single-writer pattern). Reconciliation reads
    // from stock_transfers + stock_transfer_items directly.
    for (const item of items) {
      await supabase.from("stock_ledger").insert({
        business_id: businessId,
        item_type: "finished_good",
        item_id: item.design_id,
        godown_id: from_godown_id,
        transaction_type: "stock_transfer_out",
        quantity_delta: -Number(item.quantity),
        value_delta: -Number(item.total_value),
        reference_table: "stock_transfers",
        reference_id: transfer.id,
      });

      if (status === "completed") {
        await supabase.from("stock_ledger").insert({
          business_id: businessId,
          item_type: "finished_good",
          item_id: item.design_id,
          godown_id: to_godown_id,
          transaction_type: "stock_transfer_in",
          quantity_delta: Number(item.quantity),
          value_delta: Number(item.total_value),
          reference_table: "stock_transfers",
          reference_id: transfer.id,
        });
      }
    }

    // Reconcile finished stock ground-truth after transfer creation
    const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
    await reconcileFinishedStock(supabase, businessId);

    return NextResponse.json({ transfer });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
