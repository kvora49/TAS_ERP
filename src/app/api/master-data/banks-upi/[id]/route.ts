import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    // 1. Fetch account details
    const { data: account, error: accountError } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (accountError || !account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // 2. Fetch recent purchase payments referencing this account
    const { data: purchasePayments } = await supabase
      .from("purchase_payments")
      .select(`
        id,
        payment_number,
        payment_date,
        amount,
        payment_mode,
        purchase:raw_material_purchases(
          invoice_number,
          supplier:parties(name)
        )
      `)
      .or(`bank_account_id.eq.${id},upi_id.eq.${id}`)
      .eq("business_id", businessId);

    // 3. Fetch recent job work payments referencing this account
    const { data: jobWorkPayments } = await supabase
      .from("job_work_payments")
      .select(`
        id,
        payment_number,
        payment_date,
        paid_amount,
        payment_mode,
        worker:workers(name)
      `)
      .or(`bank_account_id.eq.${id},upi_id.eq.${id}`)
      .eq("business_id", businessId);

    // 4. Transform and unify transaction list
    const transactions: any[] = [];

    purchasePayments?.forEach((p: any) => {
      transactions.push({
        id: p.id,
        type: "outflow",
        ref_no: p.payment_number,
        date: p.payment_date,
        amount: Number(p.amount || 0),
        mode: p.payment_mode,
        details: `Purchase Return / Supplier Payment (Invoice: ${p.purchase?.invoice_number || "N/A"})`,
        partyName: p.purchase?.supplier?.name || "Supplier",
      });
    });

    jobWorkPayments?.forEach((jw: any) => {
      transactions.push({
        id: jw.id,
        type: "outflow",
        ref_no: jw.payment_number,
        date: jw.payment_date,
        amount: Number(jw.paid_amount || 0),
        mode: jw.payment_mode,
        details: "Job Work Worker Payment",
        partyName: jw.worker?.name || "Worker",
      });
    });

    // Sort by date descending
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      account,
      transactions: transactions.slice(0, 50), // return last 50 transactions
    });

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
  const accountId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      type,
      name,
      sub_label,
      bank_name,
      account_number,
      ifsc,
      branch,
      upi_id,
      upi_provider,
      is_default,
      opening_balance,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!type || !name || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Account Type, Name, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    if (type === "bank" && (!account_number || !ifsc)) {
      return NextResponse.json(
        { error: "Account Number and IFSC Code are required for bank accounts" },
        { status: 400 }
      );
    }

    if (type === "upi" && !upi_id) {
      return NextResponse.json(
        { error: "UPI ID is required for UPI accounts" },
        { status: 400 }
      );
    }

    // If setting as default, reset others to false
    if (is_default) {
      await supabase
        .from("bank_accounts")
        .update({ is_default: false })
        .eq("business_id", businessId);
    }

    // Optimistic locking update query
    const { data: updatedAccount, error } = await supabase
      .from("bank_accounts")
      .update({
        type,
        name,
        sub_label: sub_label || null,
        bank_name: type === "bank" ? bank_name : null,
        account_number: type === "bank" ? account_number : null,
        ifsc: type === "bank" ? ifsc : null,
        branch: type === "bank" ? branch : null,
        upi_id: type === "upi" ? upi_id : null,
        upi_provider: type === "upi" ? upi_provider : null,
        is_default: !!is_default,
        opening_balance: Number(opening_balance || 0),
        is_active: is_active !== false,
      })
      .eq("id", accountId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedAccount || updatedAccount.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Bank/UPI account was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ account: updatedAccount[0] });
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
  const accountId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Soft delete: update deleted_at
    const { error } = await supabase
      .from("bank_accounts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", accountId)
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
