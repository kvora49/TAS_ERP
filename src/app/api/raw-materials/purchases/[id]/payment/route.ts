import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
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
      payment_date,
      payment_mode,
      reference_no,
      paid_amount,
      bank_account_id,
      upi_id,
      remarks,
    } = body;

    if (!payment_date) {
      return NextResponse.json({ error: "Payment Date is required" }, { status: 400 });
    }
    if (!payment_mode) {
      return NextResponse.json({ error: "Payment Mode is required" }, { status: 400 });
    }
    if (!paid_amount || Number(paid_amount) <= 0) {
      return NextResponse.json({ error: "Paid Amount must be greater than 0" }, { status: 400 });
    }

    // 1. Fetch Purchase Invoice to verify and get current amounts
    const { data: purchase, error: purchaseError } = await supabase
      .from("raw_material_purchases")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 404 });
    }

    // Map payment_mode to payment_method constraint
    const payment_method = 
      payment_mode === "upi" ? "upi" :
      payment_mode === "cash" ? "cash" :
      payment_mode === "cheque" ? "cheque" :
      "bank_transfer";

    // 2. Insert payment row
    const { data: payment, error: paymentError } = await supabase
      .from("purchase_payments")
      .insert({
        business_id: businessId,
        purchase_id: id,
        supplier_id: purchase.supplier_id,
        payment_date,
        payment_mode,
        payment_method,
        reference_no: reference_no || null,
        paid_amount: Number(paid_amount),
        bank_account_id: bank_account_id || null,
        upi_id: upi_id || null,
        remarks: remarks || null,
        status: "success",
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    // 3. Update purchase invoice paid amount and payment status
    const newPaidAmount = Number(purchase.paid_amount || 0) + Number(paid_amount);
    const grandTotal = Number(purchase.grand_total);
    let newPaymentStatus = "unpaid";
    if (newPaidAmount >= grandTotal) {
      newPaymentStatus = "paid";
    } else if (newPaidAmount > 0) {
      newPaymentStatus = "partially_paid";
    }

    const { error: updateError } = await supabase
      .from("raw_material_purchases")
      .update({
        paid_amount: newPaidAmount,
        payment_status: newPaymentStatus,
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (updateError) {
      return NextResponse.json({
        payment,
        warning: "Payment saved, but purchase invoice status could not be updated: " + updateError.message,
      });
    }

    // 4. Update bank account balance for immediate payment modes
    const targetAccountId = bank_account_id || upi_id || null;
    if (targetAccountId && payment_mode !== "cheque") {
      const { data: bank } = await supabase
        .from("bank_accounts")
        .select("current_balance")
        .eq("id", targetAccountId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (bank) {
        const newBal = Number(bank.current_balance || 0) - Number(paid_amount);
        await supabase
          .from("bank_accounts")
          .update({ current_balance: newBal, updated_at: new Date().toISOString() })
          .eq("id", targetAccountId)
          .eq("business_id", businessId);
      }
    }

    return NextResponse.json({ payment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
