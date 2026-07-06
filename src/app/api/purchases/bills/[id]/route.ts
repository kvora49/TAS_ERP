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
    const { data: bill, error } = await supabase
      .from("purchase_bills")
      .select(`
        *,
        supplier:parties(*)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!bill) {
      return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
    }

    return NextResponse.json({ bill });
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
    const { invoice_no, invoice_date, grand_total, paid_amount } = body;

    // Fetch existing bill first
    const { data: existingBill, error: fetchErr } = await supabase
      .from("purchase_bills")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !existingBill) {
      return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
    }

    // Set updated values
    const newInvoiceNo = invoice_no !== undefined ? invoice_no : existingBill.invoice_no;
    const newInvoiceDate = invoice_date !== undefined ? invoice_date : existingBill.invoice_date;
    const newGrandTotal = grand_total !== undefined ? Number(grand_total) : Number(existingBill.grand_total);
    const newPaidAmount = paid_amount !== undefined ? Number(paid_amount) : Number(existingBill.paid_amount);

    // Re-determine payment status
    let newPaymentStatus = "unpaid";
    if (newPaidAmount >= newGrandTotal && newGrandTotal > 0) {
      newPaymentStatus = "paid";
    } else if (newPaidAmount > 0) {
      newPaymentStatus = "partially_paid";
    }

    const { data: updatedBill, error: updateErr } = await supabase
      .from("purchase_bills")
      .update({
        invoice_no: newInvoiceNo || null,
        invoice_date: newInvoiceDate,
        grand_total: newGrandTotal,
        paid_amount: newPaidAmount,
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select(`
        *,
        supplier:parties(*)
      `)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ bill: updatedBill });
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
    // Soft delete by setting status to 'deleted'
    const { error } = await supabase
      .from("purchase_bills")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
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
