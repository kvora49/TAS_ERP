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
      .from("raw_material_transfers")
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
      items, // array of { material_type_id, unit, quantity, unit_cost, total_value }
      status = "pending",
    } = body;

    if (!transfer_date || !from_godown_id || !to_godown_id || !reason || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "All required fields must be filled" }, { status: 400 });
    }

    if (from_godown_id === to_godown_id) {
      return NextResponse.json({ error: "Source and destination godowns must be different" }, { status: 400 });
    }

    const { getBusinessServerSettings } = await import("@/lib/settings/serverSettings");
    const serverSettings = await getBusinessServerSettings(supabase, businessId);

    // Verify stock availability in source godown if allow_negative_stock is false
    if (!serverSettings.allow_negative_stock) {
      for (const item of items) {
        if (!item.material_type_id || !item.quantity || Number(item.quantity) <= 0) continue;

        const { data: stockRow } = await supabase
          .from("raw_material_current_stock")
          .select("current_stock")
          .eq("business_id", businessId)
          .eq("godown_id", from_godown_id)
          .eq("material_type_id", item.material_type_id)
          .maybeSingle();

        const currentQty = Number(stockRow?.current_stock || 0);
        const reqQty = Number(item.quantity);
        if (currentQty < reqQty) {
          return NextResponse.json(
            { error: `Insufficient stock in source godown. Available: ${currentQty}, Required: ${reqQty}` },
            { status: 400 }
          );
        }
      }
    }

    // Auto-generate transfer number (TRF-RM-YYYY-XXXX)
    const year = new Date(transfer_date).getFullYear() || new Date().getFullYear();
    const { data: lastTrf } = await supabase
      .from("raw_material_transfers")
      .select("transfer_number")
      .eq("business_id", businessId)
      .like("transfer_number", `TRF-RM-${year}-%`)
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
    const transferNumber = `TRF-RM-${year}-${String(nextNum).padStart(4, "0")}`;

    // Calculate aggregate totals
    let totalQuantity = 0;
    let totalValue = 0;
    items.forEach((item) => {
      totalQuantity += Number(item.quantity || 0);
      totalValue += Number(item.total_value || 0);
    });

    // Insert transfer header
    const { data: transfer, error: trfErr } = await supabase
      .from("raw_material_transfers")
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
        status,
      })
      .select()
      .single();

    if (trfErr) {
      return NextResponse.json({ error: trfErr.message }, { status: 500 });
    }

    // Insert transfer line items
    const transferItemsToInsert = items.map((item) => ({
      business_id: businessId,
      transfer_id: transfer.id,
      material_type_id: item.material_type_id,
      unit: item.unit || "meter",
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost),
      total_value: Number(item.total_value),
    }));

    const { error: itemsErr } = await supabase
      .from("raw_material_transfer_items")
      .insert(transferItemsToInsert);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    // Record stock entries vouchers to handle stock updates
    // 1. Deduct immediately from source godown via stock_out entry
    const { data: outEntry } = await supabase
      .from("raw_material_stock_entries")
      .insert({
        business_id: businessId,
        stock_entry_number: `STK-TRF-OUT-${transfer.transfer_number}`,
        entry_type: "stock_out",
        posting_date: transfer_date,
        godown_id: from_godown_id,
        remarks: `Raw Material Transfer Out (${transfer.transfer_number})`,
        reference_type: "transfer",
        reference_no: transfer.transfer_number,
        grand_total: totalValue,
      })
      .select()
      .single();

    if (outEntry) {
      const outItems = items.map((item) => ({
        business_id: businessId,
        entry_id: outEntry.id,
        material_type_id: item.material_type_id,
        unit: item.unit || "meter",
        quantity: Number(item.quantity),
        rate: Number(item.unit_cost),
        amount: Number(item.total_value),
      }));
      await supabase.from("raw_material_stock_entry_items").insert(outItems);
    }

    // 2. If status is completed, add immediately to destination godown via stock_in entry
    if (status === "completed") {
      const { data: inEntry } = await supabase
        .from("raw_material_stock_entries")
        .insert({
          business_id: businessId,
          stock_entry_number: `STK-TRF-IN-${transfer.transfer_number}`,
          entry_type: "stock_in",
          posting_date: transfer_date,
          godown_id: to_godown_id,
          remarks: `Raw Material Transfer In (${transfer.transfer_number})`,
          reference_type: "transfer",
          reference_no: transfer.transfer_number,
          grand_total: totalValue,
        })
        .select()
        .single();

      if (inEntry) {
        const inItems = items.map((item) => ({
          business_id: businessId,
          entry_id: inEntry.id,
          material_type_id: item.material_type_id,
          unit: item.unit || "meter",
          quantity: Number(item.quantity),
          rate: Number(item.unit_cost),
          amount: Number(item.total_value),
        }));
        await supabase.from("raw_material_stock_entry_items").insert(inItems);
      }
    }

    // Reconcile stock
    const { reconcileRawMaterialStock } = await import("@/lib/stock-reconciliation");
    await reconcileRawMaterialStock(supabase, businessId);

    return NextResponse.json({ transfer });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
