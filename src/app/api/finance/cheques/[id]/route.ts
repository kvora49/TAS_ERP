import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api-response";

const chequeDetails = `
  *, party:parties(*), received_account:bank_accounts(*),
  payment:payments(*, allocations:payment_allocations(*))
`;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { data: cheque, error } = await supabase.from("cheques").select(chequeDetails)
      .eq("id", params.id).eq("business_id", businessId).maybeSingle();
    if (error) throw error;
    if (!cheque) return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    return NextResponse.json({ cheque });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const status = body.status;
    const bounceCharges = body.bounce_charges === undefined || body.bounce_charges === null ? 0 : Number(body.bounce_charges);
    if (!status || !["pending", "deposited", "cleared", "bounced", "cancelled"].includes(status) || !Number.isFinite(bounceCharges) || bounceCharges < 0) {
      return NextResponse.json({ error: "Invalid cheque status or bounce charges" }, { status: 400 });
    }
    const { error } = await supabase.rpc("settle_cheque_atomic", {
      p_business_id: businessId,
      p_cheque_id: params.id,
      p_new_status: status,
      p_received_account_id: body.received_account_id || null,
      p_deposited_date: body.deposited_date || null,
      p_cleared_date: body.cleared_date || null,
      p_bounce_reason: body.bounce_reason || null,
      p_bounce_charges: bounceCharges,
      p_remarks: body.remarks || null,
      p_debit_party: Boolean(body.debit_party),
    });
    if (error) throw error;
    const { data: cheque, error: selectError } = await supabase.from("cheques").select(chequeDetails)
      .eq("id", params.id).eq("business_id", businessId).single();
    if (selectError) throw selectError;
    return NextResponse.json({ cheque });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { data: success, error } = await supabase.rpc("delete_cheque", { p_cheque_id: params.id, p_business_id: businessId });
    if (error) throw error;
    if (!success) return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
