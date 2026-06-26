import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("purchase_returns")
      .select("*, supplier:parties(name, company_name), purchase:raw_material_purchases(purchase_number, invoice_no)")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (search) {
      query = query.or(`return_number.ilike.%${search}%,reason.ilike.%${search}%`);
    }

    const { data: returns, error } = await query.order("return_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ returns });
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
      purchase_id,
      supplier_id,
      return_date,
      return_type,
      reason,
      godown_id,
      challan_no,
      remarks,
      total_taxable_value,
      total_discount,
      taxable_after_discount,
      cgst,
      sgst,
      igst,
      round_off,
      grand_total,
      amount_in_words,
      generate_debit_note,
      attachments,
      status, // 'pending', 'completed', 'cancelled'
      items,
    } = body;

    if (!purchase_id) {
      return NextResponse.json({ error: "Purchase Invoice is required" }, { status: 400 });
    }
    if (!supplier_id) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }
    if (!return_date) {
      return NextResponse.json({ error: "Return Date is required" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one return item is required" }, { status: 400 });
    }

    // Auto-generate Return Number (Format: RET-YYYY-XXXX)
    const year = new Date(return_date).getFullYear() || new Date().getFullYear();
    const { data: lastRet } = await supabase
      .from("purchase_returns")
      .select("return_number")
      .eq("business_id", businessId)
      .like("return_number", `RET-${year}-%`)
      .order("return_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastRet && lastRet.length > 0 && lastRet[0].return_number) {
      const parts = lastRet[0].return_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const returnNumber = `RET-${year}-${String(nextNum).padStart(4, "0")}`;

    // Insert purchase return
    const { data: pReturn, error: returnError } = await supabase
      .from("purchase_returns")
      .insert({
        business_id: businessId,
        return_number: returnNumber,
        purchase_id,
        supplier_id,
        return_date,
        return_type: return_type || 'material_return',
        reason: reason || null,
        godown_id: godown_id || null,
        challan_no: challan_no || null,
        remarks: remarks || null,
        total_taxable_value: Number(total_taxable_value || 0),
        total_discount: Number(total_discount || 0),
        taxable_after_discount: Number(taxable_after_discount || 0),
        cgst: Number(cgst || 0),
        sgst: Number(sgst || 0),
        igst: Number(igst || 0),
        round_off: Number(round_off || 0),
        grand_total: Number(grand_total || 0),
        amount_in_words: amount_in_words || null,
        generate_debit_note: generate_debit_note !== false,
        attachments: attachments || [],
        status: status || 'pending',
      })
      .select()
      .single();

    if (returnError) {
      return NextResponse.json({ error: returnError.message }, { status: 500 });
    }

    // Insert purchase return items
    const itemsToInsert = items.map((item: any) => ({
      business_id: businessId,
      return_id: pReturn.id,
      purchase_item_id: item.purchase_item_id || null,
      material_type_id: item.material_type_id,
      hsn_sac: item.hsn_sac || null,
      unit: item.unit,
      invoice_qty: Number(item.invoice_qty),
      returned_qty: Number(item.returned_qty),
      rate: Number(item.rate),
      discount_percent: Number(item.discount_percent || 0),
      taxable_value: Number(item.taxable_value),
    }));

    const { error: itemsError } = await supabase
      .from("purchase_return_items")
      .insert(itemsToInsert);

    if (itemsError) {
      await supabase.from("purchase_returns").delete().eq("id", pReturn.id);
      return NextResponse.json({ error: "Failed to create return items: " + itemsError.message }, { status: 500 });
    }

    // If status is 'completed' and godown_id is specified, automatically generate a stock entry
    if ((status === "completed") && godown_id) {
      const { data: stockEntry, error: seError } = await supabase
        .from("raw_material_stock_entries")
        .insert({
          business_id: businessId,
          stock_entry_number: `STK-OUT-${returnNumber}`,
          entry_type: "stock_out",
          reference_type: "return",
          reference_id: pReturn.id,
          reference_no: returnNumber,
          reference_date: return_date,
          godown_id,
          posting_date: return_date,
          remarks: `Auto-generated from Purchase Return ${returnNumber}`,
          total_items_value: Number(total_taxable_value || 0),
          grand_total: Number(grand_total || 0),
          status: "active",
        })
        .select()
        .single();

      if (!seError && stockEntry) {
        const seItems = items.map((item: any) => ({
          business_id: businessId,
          stock_entry_id: stockEntry.id,
          material_type_id: item.material_type_id,
          hsn_sac: item.hsn_sac || null,
          unit: item.unit,
          quantity: Number(item.returned_qty),
          rate: Number(item.rate),
          amount: Number(item.taxable_value),
        }));

        await supabase.from("raw_material_stock_entry_items").insert(seItems);
      }
    }

    return NextResponse.json({ return: pReturn });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
