import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { data: cheque, error } = await supabase
      .from("cheques")
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!cheque) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    return NextResponse.json({ cheque });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const {
      status,
      received_account_id,
      deposited_date,
      cleared_date,
      bounce_reason,
      bounce_charges,
      remarks
    } = body;

    // Fetch existing cheque
    const { data: existing, error: fetchErr } = await supabase
      .from("cheques")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (received_account_id !== undefined) updates.received_account_id = received_account_id || null;
    if (remarks !== undefined) updates.remarks = remarks || null;

    // Dates & Bounces
    if (status === "deposited") {
      updates.deposited_date = deposited_date || new Date().toISOString().split("T")[0];
    } else if (status === "cleared") {
      updates.cleared_date = cleared_date || new Date().toISOString().split("T")[0];
      
      // Dynamic clearing ledger logic: if received cheque clears, optionally increase bank balance
      const accountId = received_account_id || existing.received_account_id;
      if (accountId && existing.direction === "received" && existing.status !== "cleared") {
        // Fetch current balance
        const { data: acc } = await supabase
          .from("bank_accounts")
          .select("current_balance")
          .eq("id", accountId)
          .maybeSingle();
        if (acc) {
          const newBal = Number(acc.current_balance || 0) + Number(existing.amount);
          await supabase
            .from("bank_accounts")
            .update({ current_balance: newBal })
            .eq("id", accountId);
        }
      }
    } else if (status === "bounced") {
      updates.bounce_reason = bounce_reason || null;
      updates.bounce_charges = bounce_charges ? Number(bounce_charges) : 0;
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedCheque, error: updateErr } = await supabase
      .from("cheques")
      .update(updates)
      .eq("id", id)
      .eq("business_id", businessId)
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*)
      `)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ cheque: updatedCheque });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { error } = await supabase
      .from("cheques")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

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
