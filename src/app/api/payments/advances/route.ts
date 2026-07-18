import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all advances
    const { data: advances, error } = await supabase
      .from("advance_payments")
      .select(`
        id,
        advance_amount,
        settled_amount,
        remaining_amount,
        is_settled,
        created_at,
        party:parties(id, name, company_name, type, phone),
        payment:payments(id, payment_date, payment_mode, reference_no)
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Split advances into Given (to suppliers/workers) and Received (from customers)
    const given: any[] = [];
    const received: any[] = [];

    advances?.forEach((adv: any) => {
      const partyTypes = adv.party?.type || [];
      if (partyTypes.includes("customer")) {
        received.push(adv);
      } else {
        given.push(adv);
      }
    });

    return NextResponse.json({ given, received });
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
    const { advance_id, bill_id, bill_type, amount_to_settle } = body;

    if (!advance_id || !bill_id || !bill_type || !amount_to_settle) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Call settle_advance RPC function
    const { data: success, error } = await supabase.rpc("settle_advance", {
      p_business_id: businessId,
      p_advance_id: advance_id,
      p_bill_id: bill_id,
      p_bill_type: bill_type,
      p_amount: Number(amount_to_settle),
    });

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
