import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PurchaseService } from "@/services/purchase.service";

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
    const service = new PurchaseService(supabase);
    const purchase = await service.getPurchaseById(params.id, businessId);

    // Augment items with rolls info (fetch separately for backward compat)
    const itemIds = purchase.items?.map((item: any) => item.id) || [];
    const rollsLookup: Record<string, any[]> = {};
    if (itemIds.length > 0) {
      const { data: rolls } = await supabase
        .from("purchase_rolls")
        .select("*")
        .in("purchase_item_id", itemIds)
        .eq("business_id", businessId);

      (rolls || []).forEach((roll: any) => {
        if (!rollsLookup[roll.purchase_item_id]) rollsLookup[roll.purchase_item_id] = [];
        rollsLookup[roll.purchase_item_id].push(roll);
      });
    }

    const itemsWithRolls = (purchase.items || []).map((item: any) => {
      const itemRolls = rollsLookup[item.id] || [];
      return { ...item, rolls: itemRolls, item_type: itemRolls.length > 0 ? "fabric" : "accessory" };
    });

    const { data: payments } = await supabase
      .from("purchase_payments")
      .select("*")
      .eq("purchase_id", params.id)
      .eq("business_id", businessId)
      .eq("status", "success");

    return NextResponse.json({
      purchase: { ...purchase, items: itemsWithRolls, payments: payments || [] },
    });
  } catch (err: any) {
    const status = err.message === "Purchase not found" ? 404 : 500;
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status });
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

  const { id } = params;

  try {
    const body = await request.json();
    const { supplier_id, invoice_no, invoice_date, delivery_date, payment_terms, due_date, reference,
      transporter, place_of_supply, gst_type, notes, subtotal, total_taxable_value, total_gst_amount,
      freight, loading_unloading, other_charges, total_other_charges, grand_total, amount_in_words,
      attachments, items } = body;

    if (!supplier_id) return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    if (!invoice_no) return NextResponse.json({ error: "Invoice Number is required" }, { status: 400 });
    if (!invoice_date) return NextResponse.json({ error: "Invoice Date is required" }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: "At least one purchase item is required" }, { status: 400 });

    // Verify ownership (multi-tenant safety)
    const { data: existing } = await supabase
      .from("raw_material_purchases")
      .select("id")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Purchase not found or access denied" }, { status: 404 });

    // Update parent record
    const { data: purchase, error: purchaseError } = await supabase
      .from("raw_material_purchases")
      .update({
        supplier_id, invoice_no, invoice_date,
        delivery_date: delivery_date || null,
        payment_terms: payment_terms || "30_days",
        due_date: due_date || null, reference: reference || null,
        transporter: transporter || null, place_of_supply: place_of_supply || null,
        gst_type: gst_type || "with_gst", notes: notes || null,
        subtotal: Number(subtotal || 0), total_taxable_value: Number(total_taxable_value || 0),
        total_gst_amount: Number(total_gst_amount || 0), freight: Number(freight || 0),
        loading_unloading: Number(loading_unloading || 0), other_charges: Number(other_charges || 0),
        total_other_charges: Number(total_other_charges || 0), grand_total: Number(grand_total || 0),
        amount_in_words: amount_in_words || null, attachments: attachments || [],
      })
      .eq("id", id).eq("business_id", businessId).select().single();

    if (purchaseError) return NextResponse.json({ error: purchaseError.message }, { status: 500 });

    // Replace items (delete then re-insert)
    await supabase.from("raw_material_purchase_items").delete().eq("purchase_id", id).eq("business_id", businessId);

    const itemsToInsert = items.map((item: any) => ({
      business_id: businessId, purchase_id: id,
      material_type_id: item.material_type_id, hsn_sac: item.hsn_sac || null,
      unit: item.unit, quantity: Number(item.quantity), rate: Number(item.rate),
      discount_percent: Number(item.discount_percent || 0), taxable_value: Number(item.taxable_value),
      gst_percent: Number(item.gst_percent || 0), gst_amount: Number(item.gst_amount || 0), amount: Number(item.amount),
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from("raw_material_purchase_items").insert(itemsToInsert).select();

    if (itemsError || !insertedItems) {
      return NextResponse.json({
        purchase,
        warning: "Purchase updated, but items could not be saved: " + (itemsError?.message || "No data returned"),
      });
    }

    // Insert rolls for fabric items
    const rollsToInsert: any[] = [];
    insertedItems.forEach((insertedItem, idx) => {
      const inputItem = items[idx];
      if (inputItem?.item_type === "fabric" && inputItem.rolls?.length) {
        inputItem.rolls.forEach((roll: any) => {
          rollsToInsert.push({
            business_id: businessId, purchase_item_id: insertedItem.id,
            roll_number: roll.roll_number, meters: Number(roll.meters), shade: roll.shade,
            comment: roll.comment || null, width: roll.width ? Number(roll.width) : null,
            weight_unit: roll.weight_unit || null,
            weight_value: roll.weight_value ? Number(roll.weight_value) : null,
            remaining_meters: Number(roll.meters),
          });
        });
      }
    });

    if (rollsToInsert.length > 0) {
      const { error: rollsError } = await supabase.from("purchase_rolls").insert(rollsToInsert);
      if (rollsError) {
        return NextResponse.json({ purchase, warning: "Purchase updated, but rolls could not be saved: " + rollsError.message });
      }
    }

    return NextResponse.json({ purchase });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const service = new PurchaseService(supabase);
    await service.deletePurchase(params.id, businessId);

    // Also mark as cancelled
    await supabase
      .from("raw_material_purchases")
      .update({ status: "cancelled" })
      .eq("id", params.id)
      .eq("business_id", businessId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message === "Purchase not found or access denied" ? 404 : 500;
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status });
  }
}
