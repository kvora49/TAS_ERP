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
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";

  try {
    let query = supabase
      .from("debit_notes")
      .select(`
        *,
        party:parties(*),
        purchase_return:purchase_returns(return_number)
      `)
      .eq("business_id", businessId);

    if (startDate) {
      query = query.gte("dn_date", startDate);
    }
    if (endDate) {
      query = query.lte("dn_date", endDate);
    }

    const { data: debitNotes, error } = await query.order("dn_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side search filtering
    let filtered = debitNotes || [];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (dn: any) =>
          dn.dn_number.toLowerCase().includes(term) ||
          (dn.party?.name && dn.party.name.toLowerCase().includes(term)) ||
          (dn.reason && dn.reason.toLowerCase().includes(term))
      );
    }

    return NextResponse.json({ debitNotes: filtered });
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
    const { party_id, dn_date, amount, reason } = body;

    if (!party_id) {
      return NextResponse.json({ error: "Party/Supplier is required" }, { status: 400 });
    }
    if (!dn_date) {
      return NextResponse.json({ error: "Debit note date is required" }, { status: 400 });
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // Auto-generate Debit Note Number (DN-YYYY-XXXX)
    const year = new Date(dn_date).getFullYear();
    const { count } = await supabase
      .from("debit_notes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);

    const sequence = String((count || 0) + 1).padStart(4, "0");
    const dnNumber = `DN-${year}-${sequence}`;

    const { data: debitNote, error } = await supabase
      .from("debit_notes")
      .insert({
        business_id: businessId,
        dn_number: dnNumber,
        party_id,
        dn_date,
        amount: Number(amount),
        reason: reason || null
      })
      .select(`
        *,
        party:parties(*)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ debitNote });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
