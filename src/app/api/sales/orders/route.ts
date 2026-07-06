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
      .from("sale_orders")
      .select(`
        *,
        party:parties(*),
        bill:sale_bills(bill_number)
      `)
      .eq("business_id", businessId);

    if (status) {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("order_date", startDate);
    }
    if (endDate) {
      query = query.lte("order_date", endDate);
    }

    const { data: orders, error } = await query.order("order_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side search filtering
    let filtered = orders || [];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (o: any) =>
          o.order_number.toLowerCase().includes(term) ||
          (o.party?.name && o.party.name.toLowerCase().includes(term)) ||
          (o.notes && o.notes.toLowerCase().includes(term))
      );
    }

    return NextResponse.json({ orders: filtered });
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
    const { party_id, order_date, expected_delivery, total_amount = 0, notes } = body;

    if (!party_id) {
      return NextResponse.json({ error: "Party is required" }, { status: 400 });
    }
    if (!order_date) {
      return NextResponse.json({ error: "Order date is required" }, { status: 400 });
    }

    // Auto-generate Order Number (SO-YYYY-XXXX)
    const year = new Date(order_date).getFullYear();
    const { count } = await supabase
      .from("sale_orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);

    const sequence = String((count || 0) + 1).padStart(4, "0");
    const orderNumber = `SO-${year}-${sequence}`;

    const { data: order, error } = await supabase
      .from("sale_orders")
      .insert({
        business_id: businessId,
        order_number: orderNumber,
        party_id,
        order_date,
        expected_delivery: expected_delivery || null,
        status: "pending",
        total_amount: Number(total_amount),
        notes: notes || null,
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

    return NextResponse.json({ order });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
