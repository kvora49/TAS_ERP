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

    // Call the postgres function via RPC
    const { error: updateErr } = await supabase
      .rpc("process_cheque_status_update", {
        p_cheque_id: id,
        p_business_id: businessId,
        p_new_status: status !== undefined ? status : existing.status,
        p_received_account_id: received_account_id !== undefined ? (received_account_id || null) : existing.received_account_id,
        p_remarks: remarks !== undefined ? (remarks || null) : existing.remarks,
        p_deposited_date: deposited_date || null,
        p_cleared_date: cleared_date || null,
        p_bounce_reason: bounce_reason || null,
        p_bounce_charges: bounce_charges ? Number(bounce_charges) : null
      });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Query the updated cheque with relationships
    const { data: updatedCheque, error: selectErr } = await supabase
      .from("cheques")
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (selectErr) {
      return NextResponse.json({ error: selectErr.message }, { status: 500 });
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
    const { data: success, error } = await supabase
      .rpc("delete_cheque", {
        p_cheque_id: id,
        p_business_id: businessId
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!success) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
