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
        payment:payments(id, payment_date, payment_mode, reference_no, direction)
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Payment direction is authoritative. A party may validly be both a customer
    // and supplier, so classifying from party type misstates advances.
    const given: any[] = [];
    const received: any[] = [];

    advances?.forEach((adv: any) => {
      if (adv.payment?.direction === "received") {
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
    const { advance_id, bill_id, bill_type, amount_to_settle, allocations } = body;

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    if (!advance_id) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    if (allocations && Array.isArray(allocations) && allocations.length > 0) {
      const allocationTotal = allocations.reduce((total: number, allocation: any) => {
        const allocationAmount = Number(allocation.allocatedAmount ?? allocation.allocated_amount);
        if (!allocation.billId && !allocation.bill_id || !Number.isFinite(allocationAmount) || allocationAmount <= 0) {
          return Number.NaN;
        }
        return total + allocationAmount;
      }, 0);
      if (!Number.isFinite(allocationTotal) || allocationTotal <= 0) {
        return NextResponse.json({ error: "Each allocation requires a bill and a positive amount" }, { status: 400 });
      }
      // Call settle_advance_multi RPC procedure
      const { data: settledAmount, error } = await supabase.rpc("settle_advance_multi", {
        p_business_id: businessId,
        p_advance_id: advance_id,
        p_allocations: allocations,
        p_created_by: userId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, settledAmount });
    }

    const settlementAmount = Number(amount_to_settle);
    if (!bill_id || !bill_type || !Number.isFinite(settlementAmount) || settlementAmount <= 0) {
      return NextResponse.json({ error: "Missing bill_id, bill_type, or amount_to_settle" }, { status: 400 });
    }

    // Single bill fallback call
    const { data: success, error } = await supabase.rpc("settle_advance", {
      p_business_id: businessId,
      p_advance_id: advance_id,
      p_bill_id: bill_id,
      p_bill_type: bill_type,
      p_amount: settlementAmount,
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
