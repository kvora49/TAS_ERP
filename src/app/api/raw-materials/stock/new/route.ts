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
    const {
      entry_type,
      posting_date,
      godown_id,
      remarks,
      notes,
      reference_type,
      reference_no,
      reference_date,
      reference_id,
      total_items_value,
      freight,
      loading_unloading,
      other_charges,
      total_additional_charges,
      grand_total,
      amount_in_words,
      attachments,
      items,
    } = body;

    const { getBusinessServerSettings } = await import("@/lib/settings/serverSettings");
    const serverSettings = await getBusinessServerSettings(supabase, businessId);

    const effectiveGodownId = godown_id || serverSettings.default_godown_id;

    if (!entry_type) {
      return NextResponse.json({ error: "Entry Type is required" }, { status: 400 });
    }
    if (!posting_date) {
      return NextResponse.json({ error: "Posting Date is required" }, { status: 400 });
    }
    if (!effectiveGodownId) {
      return NextResponse.json({ error: "Godown is required" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // If negative stock is disallowed, check stock for stock deductions/issues
    if (!serverSettings.allow_negative_stock && (entry_type === 'issue' || entry_type === 'damage' || entry_type === 'adjustment_out')) {
      for (const item of items) {
        if (!item.material_type_id || !item.quantity || Number(item.quantity) <= 0) continue;
        const { data: rmRow } = await supabase
          .from("raw_materials")
          .select("current_stock, name")
          .eq("business_id", businessId)
          .eq("id", item.material_type_id)
          .maybeSingle();

        const currentQty = Number(rmRow?.current_stock || 0);
        const reqQty = Number(item.quantity);
        if (currentQty < reqQty) {
          return NextResponse.json(
            { error: `Insufficient stock for raw material ${rmRow?.name || ''}. Available: ${currentQty}, Required: ${reqQty}` },
            { status: 400 }
          );
        }
      }
    }

    // Auto-generate Stock Entry Number (Format: STK-YYYY-XXXX)
    const year = new Date(posting_date).getFullYear() || new Date().getFullYear();
    const { data: lastStk } = await supabase
      .from("raw_material_stock_entries")
      .select("stock_entry_number")
      .eq("business_id", businessId)
      .like("stock_entry_number", `STK-${year}-%`)
      .order("stock_entry_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastStk && lastStk.length > 0 && lastStk[0].stock_entry_number) {
      const parts = lastStk[0].stock_entry_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const stockEntryNumber = `STK-${year}-${String(nextNum).padStart(4, "0")}`;

    // Insert stock entry
    const { data: entry, error: entryError } = await supabase
      .from("raw_material_stock_entries")
      .insert({
        business_id: businessId,
        stock_entry_number: stockEntryNumber,
        entry_type,
        posting_date,
        godown_id: effectiveGodownId,
        remarks: remarks || null,
        notes: notes || null,
        reference_type: reference_type || 'manual',
        reference_no: reference_no || null,
        reference_date: reference_date || null,
        reference_id: reference_id || null,
        total_items_value: Number(total_items_value || 0),
        freight: Number(freight || 0),
        loading_unloading: Number(loading_unloading || 0),
        other_charges: Number(other_charges || 0),
        total_additional_charges: Number(total_additional_charges || 0),
        grand_total: Number(grand_total || 0),
        amount_in_words: amount_in_words || null,
        status: "active",
        attachments: attachments || [],
      })
      .select()
      .single();

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 500 });
    }

    // Insert items
    const itemsToInsert = items.map((item: any) => ({
      business_id: businessId,
      stock_entry_id: entry.id,
      material_type_id: item.material_type_id,
      hsn_sac: item.hsn_sac || null,
      unit: item.unit,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      batch_lot_no: item.batch_lot_no || null,
      expiry_date: item.expiry_date || null,
      amount: Number(item.amount),
    }));

    const { error: itemsError } = await supabase
      .from("raw_material_stock_entry_items")
      .insert(itemsToInsert);

    if (itemsError) {
      await supabase.from("raw_material_stock_entries").delete().eq("id", entry.id);
      return NextResponse.json({ error: "Failed to create stock items: " + itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
