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

  const { id } = params;

  try {
    // 1. Fetch Purchase Invoice
    const { data: purchase, error: purchaseError } = await supabase
      .from("raw_material_purchases")
      .select("*, supplier:parties(*)")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 404 });
    }

    // 2. Fetch Line Items
    const { data: items, error: itemsError } = await supabase
      .from("raw_material_purchase_items")
      .select("*, material_type:raw_material_types(name, category)")
      .eq("purchase_id", id)
      .eq("business_id", businessId);

    // 3. Fetch Payments Made against this Invoice
    const { data: payments } = await supabase
      .from("purchase_payments")
      .select("*")
      .eq("purchase_id", id)
      .eq("business_id", businessId)
      .eq("status", "success");

    return NextResponse.json({
      purchase: {
        ...purchase,
        items: items || [],
        payments: payments || [],
      },
    });
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

  const { id } = params;

  try {
    const body = await request.json();
    const {
      supplier_id,
      invoice_no,
      invoice_date,
      delivery_date,
      payment_terms,
      due_date,
      reference,
      transporter,
      place_of_supply,
      gst_type,
      notes,
      subtotal,
      total_taxable_value,
      total_gst_amount,
      freight,
      loading_unloading,
      other_charges,
      total_other_charges,
      grand_total,
      amount_in_words,
      attachments,
      items,
    } = body;

    if (!supplier_id) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }
    if (!invoice_no) {
      return NextResponse.json({ error: "Invoice Number is required" }, { status: 400 });
    }
    if (!invoice_date) {
      return NextResponse.json({ error: "Invoice Date is required" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one purchase item is required" }, { status: 400 });
    }

    // Update parent record
    const { data: purchase, error: purchaseError } = await supabase
      .from("raw_material_purchases")
      .update({
        supplier_id,
        invoice_no,
        invoice_date,
        delivery_date: delivery_date || null,
        payment_terms: payment_terms || '30_days',
        due_date: due_date || null,
        reference: reference || null,
        transporter: transporter || null,
        place_of_supply: place_of_supply || null,
        gst_type: gst_type || 'with_gst',
        notes: notes || null,
        subtotal: Number(subtotal || 0),
        total_taxable_value: Number(total_taxable_value || 0),
        total_gst_amount: Number(total_gst_amount || 0),
        freight: Number(freight || 0),
        loading_unloading: Number(loading_unloading || 0),
        other_charges: Number(other_charges || 0),
        total_other_charges: Number(total_other_charges || 0),
        grand_total: Number(grand_total || 0),
        amount_in_words: amount_in_words || null,
        attachments: attachments || [],
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 500 });
    }

    // Delete existing purchase items
    await supabase
      .from("raw_material_purchase_items")
      .delete()
      .eq("purchase_id", id)
      .eq("business_id", businessId);

    // Insert new items
    const itemsToInsert = items.map((item: any) => ({
      business_id: businessId,
      purchase_id: id,
      material_type_id: item.material_type_id,
      hsn_sac: item.hsn_sac || null,
      unit: item.unit,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      discount_percent: Number(item.discount_percent || 0),
      taxable_value: Number(item.taxable_value),
      gst_percent: Number(item.gst_percent || 0),
      gst_amount: Number(item.gst_amount || 0),
      amount: Number(item.amount),
    }));

    const { error: itemsError } = await supabase
      .from("raw_material_purchase_items")
      .insert(itemsToInsert);

    if (itemsError) {
      return NextResponse.json({
        purchase,
        warning: "Purchase updated, but items could not be saved: " + itemsError.message,
      });
    }

    return NextResponse.json({ purchase });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
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
    const { error } = await supabase
      .from("raw_material_purchases")
      .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
