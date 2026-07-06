import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";

  try {
    let query = supabase
      .from("sales_returns")
      .select(`
        *,
        party:parties(*),
        bill:sale_bills(bill_number),
        credit_note:credit_notes(*)
      `)
      .eq("business_id", businessId);

    if (status) {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("return_date", startDate);
    }
    if (endDate) {
      query = query.lte("return_date", endDate);
    }

    const { data: returns, error } = await query.order("return_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side search filtering
    let filtered = returns || [];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (r: any) =>
          r.return_number.toLowerCase().includes(term) ||
          (r.party?.name && r.party.name.toLowerCase().includes(term)) ||
          (r.return_reason && r.return_reason.toLowerCase().includes(term))
      );
    }

    return NextResponse.json({ returns: filtered });
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
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!businessId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      party_id,
      original_bill_id,
      return_date,
      return_reason,
      grand_total,
      // Stock return details
      design_id,
      colour_id,
      godown_id,
      size_quantities,
      total_quantity
    } = body;

    if (!party_id) {
      return NextResponse.json({ error: "Customer is required" }, { status: 400 });
    }
    if (!return_date) {
      return NextResponse.json({ error: "Return date is required" }, { status: 400 });
    }
    if (!grand_total || Number(grand_total) <= 0) {
      return NextResponse.json({ error: "Return total value must be greater than 0" }, { status: 400 });
    }

    // 1. Generate Return Number (SR-YYYY-XXXX)
    const year = new Date(return_date).getFullYear();
    const { count: returnCount } = await supabase
      .from("sales_returns")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);

    const sequence = String((returnCount || 0) + 1).padStart(4, "0");
    const returnNumber = `SR-${year}-${sequence}`;

    // 2. Generate Credit Note Number (CN-YYYY-XXXX)
    const { count: cnCount } = await supabase
      .from("credit_notes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);
    const cnSequence = String((cnCount || 0) + 1).padStart(4, "0");
    const cnNumber = `CN-${year}-${cnSequence}`;

    // 3. Save Sales Return Header (initially pending or auto-approved)
    const { data: sReturn, error: returnErr } = await supabase
      .from("sales_returns")
      .insert({
        business_id: businessId,
        return_number: returnNumber,
        party_id,
        original_bill_id: original_bill_id || null,
        return_date,
        return_reason: return_reason || null,
        grand_total: Number(grand_total),
        status: "approved", // Auto-approved to directly apply stock & credit note
        approved_by: userId,
        approved_at: new Date().toISOString(),
        created_by: userId
      })
      .select()
      .single();

    if (returnErr) {
      return NextResponse.json({ error: returnErr.message }, { status: 500 });
    }

    // 4. Create Linked Credit Note
    const { data: creditNote, error: cnErr } = await supabase
      .from("credit_notes")
      .insert({
        business_id: businessId,
        cn_number: cnNumber,
        party_id,
        return_id: sReturn.id,
        cn_date: return_date,
        amount: Number(grand_total),
        reason: `Sales Return ${returnNumber}`
      })
      .select()
      .single();

    if (cnErr) {
      // Soft rollback: delete the return
      await supabase.from("sales_returns").delete().eq("id", sReturn.id);
      return NextResponse.json({ error: "Failed to generate credit note: " + cnErr.message }, { status: 500 });
    }

    // Update return with credit_note_id
    await supabase
      .from("sales_returns")
      .update({ credit_note_id: creditNote.id })
      .eq("id", sReturn.id);

    // 5. Reverse Stock: Add back garments to finished_stock ledger (positive quantities)
    if (design_id && colour_id && godown_id && size_quantities && total_quantity > 0) {
      const { error: stockErr } = await supabase
        .from("finished_stock")
        .insert({
          business_id: businessId,
          design_id,
          colour_id,
          godown_id,
          entry_type: "sales_return",
          size_quantities: size_quantities,
          total_quantity: Number(total_quantity),
          cost_per_piece: 0, // return value can be derived or kept 0
          total_value: 0,
          created_by: userId
        });

      if (stockErr) {
        console.error("Stock reversal warning:", stockErr.message);
      }
    }

    return NextResponse.json({ return: sReturn, creditNote });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
