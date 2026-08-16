import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { UpdatePurchaseBillSchema } from "@/lib/schemas/purchases";
import { logAudit } from "@/lib/audit";

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
    const parsed = UpdatePurchaseBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { invoice_no, invoice_date, grand_total, paid_amount } = parsed.data;

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
    // 1. Fetch purchase bill details
    const { data: bill, error: fetchErr } = await supabase
      .from("purchase_bills")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !bill) {
      return NextResponse.json({ error: "Purchase bill not found" }, { status: 404 });
    }

    if (bill.status === "cancelled" || bill.status === "deleted") {
      return NextResponse.json({ error: "This purchase bill is already cancelled" }, { status: 400 });
    }

    // 2. Payment Lock Check
    if (Number(bill.paid_amount || 0) > 0) {
      return NextResponse.json(
        { error: `Cannot cancel purchase bill: Paid amount of ₹${bill.paid_amount} exists for this bill. Please cancel or unallocate payments first.` },
        { status: 400 }
      );
    }

    const { data: allocations } = await supabase
      .from("payment_allocations")
      .select("id, amount")
      .eq("bill_id", id)
      .eq("business_id", businessId);

    if (allocations && allocations.length > 0) {
      const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
      if (totalAllocated > 0) {
        return NextResponse.json(
          { error: `Cannot cancel purchase bill: Active payment allocation of ₹${totalAllocated} linked to this bill.` },
          { status: 400 }
        );
      }
    }

    // Block cancellation if a purchase return has been raised against this bill
    const { data: linkedPurchaseReturns } = await supabase
      .from("purchase_returns")
      .select("id, return_number")
      .eq("purchase_bill_id", id)
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .limit(1);

    if (linkedPurchaseReturns && linkedPurchaseReturns.length > 0) {
      return NextResponse.json(
        { error: `Cannot cancel purchase bill: Purchase return ${linkedPurchaseReturns[0].return_number} exists against this bill. Cancel the return first.` },
        { status: 400 }
      );
    }

    // 3. Update status to 'cancelled' and set deleted_at
    const { error: cancelErr } = await supabase
      .from("purchase_bills")
      .update({
        status: "cancelled",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (cancelErr) {
      return NextResponse.json({ error: cancelErr.message }, { status: 500 });
    }

    // 4. Record Audit Log
    await logAudit(
      businessId,
      "cancel_purchase_bill",
      "purchase_bills",
      id,
      { status: "cancelled", deleted_at: new Date().toISOString() },
      { bill_number: bill.bill_number, grand_total: bill.grand_total, status: bill.status },
      request
    );

    return NextResponse.json({
      success: true,
      message: `Purchase Bill '${bill.bill_number}' successfully cancelled.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
