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
  const direction = searchParams.get("direction") || "";
  const status = searchParams.get("status") || "";

  try {
    let query = supabase
      .from("cheques")
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*)
      `)
      .eq("business_id", businessId);

    if (direction) {
      query = query.eq("direction", direction);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: cheques, error } = await query.order("cheque_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side search filtering
    let filtered = cheques || [];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (c: any) =>
          c.cheque_number.toLowerCase().includes(term) ||
          c.bank_name.toLowerCase().includes(term) ||
          (c.party?.name && c.party.name.toLowerCase().includes(term))
      );
    }

    return NextResponse.json({ cheques: filtered });
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
      cheque_number,
      direction,
      party_id,
      bank_name,
      account_no,
      cheque_date,
      due_date,
      amount,
      received_account_id,
      remarks,
      cheque_image_url
    } = body;

    // Validation
    if (!cheque_number) {
      return NextResponse.json({ error: "Cheque number is required" }, { status: 400 });
    }
    if (!direction || !["received", "issued"].includes(direction)) {
      return NextResponse.json({ error: "Valid direction ('received' or 'issued') is required" }, { status: 400 });
    }
    if (!bank_name) {
      return NextResponse.json({ error: "Bank name is required" }, { status: 400 });
    }
    if (!cheque_date) {
      return NextResponse.json({ error: "Cheque date is required" }, { status: 400 });
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    const { data: cheque, error } = await supabase
      .from("cheques")
      .insert({
        business_id: businessId,
        cheque_number,
        direction,
        party_id: party_id || null,
        bank_name,
        account_no: account_no || null,
        cheque_date,
        due_date: due_date || null,
        amount: Number(amount),
        status: "pending",
        received_account_id: received_account_id || null,
        remarks: remarks || null,
        cheque_image_url: cheque_image_url || null,
        created_by: userId
      })
      .select(`
        *,
        party:parties(*)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cheque });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
