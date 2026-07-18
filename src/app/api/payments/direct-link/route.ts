import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch source payments (received payments with unallocated_amount > 0)
    const { data: sources, error: sourcesError } = await supabase
      .from("payments")
      .select(`
        id,
        payment_number,
        payment_date,
        amount,
        unallocated_amount,
        party:parties(id, name, company_name)
      `)
      .eq("business_id", businessId)
      .eq("direction", "received")
      .gt("unallocated_amount", 0)
      .neq("status", "cancelled");

    if (sourcesError) {
      return NextResponse.json({ error: sourcesError.message }, { status: 500 });
    }

    // 2. Fetch target payments (paid payments with unallocated_amount > 0)
    const { data: targets, error: targetsError } = await supabase
      .from("payments")
      .select(`
        id,
        payment_number,
        payment_date,
        amount,
        unallocated_amount,
        party:parties(id, name, company_name)
      `)
      .eq("business_id", businessId)
      .eq("direction", "paid")
      .gt("unallocated_amount", 0)
      .neq("status", "cancelled");

    if (targetsError) {
      return NextResponse.json({ error: targetsError.message }, { status: 500 });
    }

    // 3. Fetch existing direct payment links
    const { data: links, error: linksError } = await supabase
      .from("direct_payment_links")
      .select(`
        id,
        linked_amount,
        remarks,
        created_at,
        source:payments!source_payment_id(payment_number, party:parties(name)),
        target:payments!target_payment_id(payment_number, party:parties(name))
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (linksError) {
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    // 4. Fetch workers for the inline creation form
    const { data: parties, error: partiesError } = await supabase
      .from("parties")
      .select("id, name, company_name, type")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (partiesError) {
      return NextResponse.json({ error: partiesError.message }, { status: 500 });
    }

    const workers = parties.filter((p) => p.type?.includes("worker"));

    // Fetch bank accounts
    const { data: banks } = await supabase
      .from("bank_accounts")
      .select("id, account_name, bank_name")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    return NextResponse.json({
      sources: sources || [],
      targets: targets || [],
      links: links || [],
      workers: workers || [],
      bankAccounts: banks || [],
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
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User session not found" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      source_payment_id,
      target_payment_id,
      linked_amount,
      remarks,
      // Inline details if target is created inline
      is_inline,
      party_id,
      payment_date,
      payment_mode,
      bank_account_id,
    } = body;

    if (!source_payment_id || !linked_amount) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    let finalTargetId = target_payment_id;

    // 1. If target payment is created inline, record it first
    if (is_inline) {
      if (!party_id || !payment_date || !payment_mode) {
        return NextResponse.json({ error: "Missing inline target fields" }, { status: 400 });
      }

      const { data: paymentId, error: paymentError } = await supabase.rpc("record_payment", {
        p_business_id: businessId,
        p_direction: "paid",
        p_party_id: party_id,
        p_payment_date: payment_date,
        p_payment_mode: payment_mode,
        p_reference_no: "",
        p_bank_account_id: bank_account_id || null,
        p_amount: Number(linked_amount), // amount paid matches link amount
        p_remarks: remarks || "",
        p_allocations: JSON.stringify([]), // advances/unallocated
        p_created_by: userId,
      });

      if (paymentError) {
        return NextResponse.json({ error: paymentError.message }, { status: 500 });
      }
      finalTargetId = paymentId;
    }

    if (!finalTargetId) {
      return NextResponse.json({ error: "No target payment selected or created" }, { status: 400 });
    }

    // 2. Call create_direct_payment_link RPC function
    const { data: linkId, error: linkError } = await supabase.rpc("create_direct_payment_link", {
      p_business_id: businessId,
      p_source_payment_id: source_payment_id,
      p_target_payment_id: finalTargetId,
      p_linked_amount: Number(linked_amount),
      p_remarks: remarks || "",
      p_created_by: userId,
    });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, linkId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
