import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PurchaseService } from "@/services/purchase.service";
import { logAudit } from "@/lib/audit";

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
      return { ...item, rolls: itemRolls, item_type: item.item_type || (itemRolls.length > 0 ? "fabric" : "accessory") };
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

    // Fire-and-forget audit log
    void logAudit(businessId, "update", "raw_material_purchases", id, {
      invoice_no,
      grand_total,
      updated_at: new Date().toISOString(),
    });

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

  const { id } = params;

  try {
    const service = new PurchaseService(supabase);
    const existing = await service.getPurchaseById(id, businessId);

    if (!existing) {
      return NextResponse.json({ error: "Purchase not found or access denied" }, { status: 404 });
    }

    // 1. Stock In-Use Check: Check if any purchase rolls have already been consumed/partially used
    const itemIdsList = (existing.items || []).map((it: any) => it.id);

    if (itemIdsList.length > 0) {
      const { data: rolls } = await supabase
        .from("purchase_rolls")
        .select("id, roll_number, meters, remaining_meters")
        .in("purchase_item_id", itemIdsList)
        .eq("business_id", businessId);

      const usedRoll = (rolls || []).find(
        (r: any) => Number(r.remaining_meters || 0) < Number(r.meters || 0)
      );

      if (usedRoll) {
        return NextResponse.json(
          {
            error: `Stock already in use: Roll '${usedRoll.roll_number}' has been partially or fully consumed in production. You cannot delete this purchase bill.`,
          },
          { status: 400 }
        );
      }
    }

    // 2. Revert Stock & Insert Stock Ledger Reversal
    const { data: { user } } = await supabase.auth.getUser();

    for (const item of existing.items || []) {
      const qty = Number(item.quantity || 0);
      const val = Number(item.taxable_value || item.amount || 0);

      // Insert negative delta entry into stock_ledger to reverse inventory
      await supabase.from("stock_ledger").insert({
        business_id: businessId,
        item_type: "raw_material",
        item_id: item.material_type_id,
        godown_id: existing.godown_id,
        transaction_type: "purchase_cancellation",
        quantity_delta: -qty,
        value_delta: -val,
        reference_table: "raw_material_purchases",
        reference_id: id,
        created_by: user?.id || null,
      });

      // Update raw_material_current_stock for godown
      const { data: stockEntry } = await supabase
        .from("raw_material_current_stock")
        .select("*")
        .eq("business_id", businessId)
        .eq("material_type_id", item.material_type_id)
        .eq("godown_id", existing.godown_id)
        .maybeSingle();

      if (stockEntry) {
        const updatedQty = Math.max(0, Number(stockEntry.current_stock || 0) - qty);
        const updatedValue = Math.max(0, Number(stockEntry.stock_value || 0) - val);
        const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stockEntry.unit_cost || 0);

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
    }

    // 3. Mark Purchase Rolls as status = 'cancelled'
    if (itemIdsList.length > 0) {
      await supabase
        .from("purchase_rolls")
        .update({ status: "cancelled", remaining_meters: 0 })
        .in("purchase_item_id", itemIdsList)
        .eq("business_id", businessId);
    }

    // 4. Mark Raw Material Purchase as soft deleted and status = 'cancelled'
    await service.deletePurchase(id, businessId);
    await supabase
      .from("raw_material_purchases")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    // Fire-and-forget audit log (replace raw insert)
    void logAudit(businessId, "cancel", "raw_material_purchases", id, {
      status: "cancelled",
      deleted_at: new Date().toISOString(),
    }, { purchase_number: existing.purchase_number, grand_total: existing.grand_total, status: existing.status });

    try {
      const { reconcileRawMaterialStock } = await import("@/lib/stock-reconciliation");
      await reconcileRawMaterialStock(supabase, businessId);
    } catch (recErr) {
      console.warn("Reconciliation on purchase deletion warning:", recErr);
    }

    return NextResponse.json({ success: true, message: `Purchase ${existing.purchase_number} successfully cancelled and stock reverted.` });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status });
  }
}
