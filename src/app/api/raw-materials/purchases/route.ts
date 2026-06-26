import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("payment_status");
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("raw_material_purchases")
      .select("*, supplier:parties(name, company_name)")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (status) {
      query = query.eq("status", status);
    }
    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }

    if (search) {
      query = query.or(`purchase_number.ilike.%${search}%,invoice_no.ilike.%${search}%,reference.ilike.%${search}%`);
    }

    const { data: purchases, error } = await query.order("invoice_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ purchases });
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
      items, // array of purchase items
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

    // Auto-generate Purchase Number (Format: PUR-YYYY-XXXX)
    const year = new Date(invoice_date).getFullYear() || new Date().getFullYear();
    const { data: lastPur, error: lastPurErr } = await supabase
      .from("raw_material_purchases")
      .select("purchase_number")
      .eq("business_id", businessId)
      .like("purchase_number", `PUR-${year}-%`)
      .order("purchase_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastPur && lastPur.length > 0 && lastPur[0].purchase_number) {
      const parts = lastPur[0].purchase_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const purchaseNumber = `PUR-${year}-${String(nextNum).padStart(4, "0")}`;

    // Insert purchase invoice
    const { data: purchase, error: purchaseError } = await supabase
      .from("raw_material_purchases")
      .insert({
        business_id: businessId,
        purchase_number: purchaseNumber,
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
        paid_amount: 0,
        payment_status: 'unpaid',
        status: 'active',
        attachments: attachments || [],
      })
      .select()
      .single();

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 500 });
    }

    // Insert purchase line items
    const itemsToInsert = items.map((item: any) => ({
      business_id: businessId,
      purchase_id: purchase.id,
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
      // Clean up parent record if items failed to insert
      await supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
      return NextResponse.json({ error: "Failed to create purchase items: " + itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ purchase });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
