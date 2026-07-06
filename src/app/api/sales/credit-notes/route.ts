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
      .from("credit_notes")
      .select(`
        *,
        party:parties(*),
        return:sales_returns(return_number)
      `)
      .eq("business_id", businessId);

    if (startDate) {
      query = query.gte("cn_date", startDate);
    }
    if (endDate) {
      query = query.lte("cn_date", endDate);
    }

    const { data: creditNotes, error } = await query.order("cn_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side search filtering
    let filtered = creditNotes || [];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (cn: any) =>
          cn.cn_number.toLowerCase().includes(term) ||
          (cn.party?.name && cn.party.name.toLowerCase().includes(term)) ||
          (cn.reason && cn.reason.toLowerCase().includes(term))
      );
    }

    return NextResponse.json({ creditNotes: filtered });
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
    const { party_id, cn_date, amount, reason } = body;

    if (!party_id) {
      return NextResponse.json({ error: "Party/Customer is required" }, { status: 400 });
    }
    if (!cn_date) {
      return NextResponse.json({ error: "Credit note date is required" }, { status: 400 });
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // Auto-generate Credit Note Number (CN-YYYY-XXXX)
    const year = new Date(cn_date).getFullYear();
    const { count } = await supabase
      .from("credit_notes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);

    const sequence = String((count || 0) + 1).padStart(4, "0");
    const cnNumber = `CN-${year}-${sequence}`;

    const { data: creditNote, error } = await supabase
      .from("credit_notes")
      .insert({
        business_id: businessId,
        cn_number: cnNumber,
        party_id,
        cn_date,
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

    return NextResponse.json({ creditNote });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
