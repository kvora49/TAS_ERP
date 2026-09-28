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
  const maturity = searchParams.get("maturity") || ""; // 'due_7_days' | 'due_today' | 'stale'
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = (page - 1) * limit;

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    let query = supabase
      .from("cheques")
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*)
      `, { count: "exact" })
      .eq("business_id", businessId);

    if (direction) {
      query = query.eq("direction", direction);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Maturity Filters
    if (maturity === "due_today") {
      query = query
        .in("status", ["pending", "deposited"])
        .eq("due_date", todayStr);
    } else if (maturity === "due_7_days") {
      query = query
        .in("status", ["pending", "deposited"])
        .gte("due_date", todayStr)
        .lte("due_date", sevenDaysLater);
    } else if (maturity === "stale") {
      query = query
        .in("status", ["pending", "deposited"])
        .lte("cheque_date", sixtyDaysAgo);
    }

    if (search.trim()) {
      query = query.or(`cheque_number.ilike.%${search}%,bank_name.ilike.%${search}%`);
    }

    const { data: cheques, count, error } = await query
      .order("cheque_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Server-side enriched stats calculation for current direction
    let statsQuery = supabase
      .from("cheques")
      .select("amount, status, due_date, cheque_date")
      .eq("business_id", businessId);

    if (direction) {
      statsQuery = statsQuery.eq("direction", direction);
    }

    const { data: statsData } = await statsQuery;

    const pendingCheques = statsData?.filter((c: any) => c.status === "pending" || c.status === "deposited") || [];
    const clearedCheques = statsData?.filter((c: any) => c.status === "cleared") || [];
    const bouncedCheques = statsData?.filter((c: any) => c.status === "bounced") || [];

    const dueThisWeekCheques = pendingCheques.filter((c: any) => {
      const d = c.due_date || c.cheque_date;
      return d && d >= todayStr && d <= sevenDaysLater;
    });

    const staleCheques = pendingCheques.filter((c: any) => {
      return c.cheque_date && c.cheque_date <= sixtyDaysAgo;
    });

    const stats = {
      pendingCount: pendingCheques.length,
      pendingValue: pendingCheques.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0),
      clearedCount: clearedCheques.length,
      clearedValue: clearedCheques.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0),
      bouncedCount: bouncedCheques.length,
      bouncedValue: bouncedCheques.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0),
      dueThisWeekCount: dueThisWeekCheques.length,
      dueThisWeekValue: dueThisWeekCheques.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0),
      staleCount: staleCheques.length,
    };

    return NextResponse.json({
      data: cheques || [],
      meta: {
        page,
        limit,
        total: count || 0
      },
      stats
    });
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
      cheque_image_url,
      settlement_type,
      allocations,
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

    const cleanAllocations = Array.isArray(allocations) ? allocations : [];
    const validSettlementType = settlement_type === "bill_wise" ? "bill_wise" : "on_account";

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
        settlement_type: validSettlementType,
        allocations: cleanAllocations,
        created_by: userId
      })
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*)
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
