import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workerId = searchParams.get("worker_id");

  try {
    let query = supabase
      .from("job_work_payments")
      .select(`
        *,
        worker:workers(id, name, worker_id)
      `)
      .eq("business_id", businessId)
      .order("payment_date", { ascending: false });

    if (workerId) {
      query = query.eq("worker_id", workerId);
    }

    const { data: payments, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payments: payments || [] });
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
    const {
      worker_id,
      payment_date,
      payment_mode,
      reference_no,
      paid_amount,
      bank_name,
      account_name,
      bank_account_id,
      upi_id,
      remarks,
      entries, // Array of { stage_entry_id, amount_to_apply }
    } = body;

    if (!worker_id || !payment_date || !payment_mode || !paid_amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // Generate Payment ID: JWP-[YY][MM]-XXXX
    const now = new Date();
    const prefix = `JWP-${String(now.getFullYear()).substring(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: lastPayments } = await supabase
      .from("job_work_payments")
      .select("payment_number")
      .eq("business_id", businessId)
      .like("payment_number", `${prefix}-%`)
      .order("payment_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastPayments && lastPayments.length > 0) {
      const numPart = lastPayments[0].payment_number.substring(prefix.length + 1);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const paymentNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

    // Map payment_mode to payment_method constraint
    const payment_method = 
      payment_mode === "upi" ? "upi" :
      payment_mode === "cash" ? "cash" :
      payment_mode === "cheque" ? "cheque" :
      "bank_transfer";

    // 1. Create Job Work Payment
    const { data: payment, error: pError } = await supabase
      .from("job_work_payments")
      .insert({
        business_id: businessId,
        payment_number: paymentNumber,
        worker_id,
        payment_date,
        payment_mode,
        payment_method,
        reference_no: reference_no || null,
        paid_amount: parseFloat(paid_amount),
        bank_name: bank_name || null,
        account_name: account_name || null,
        bank_account_id: bank_account_id || null,
        upi_id: upi_id || null,
        remarks: remarks || null,
        status: "success",
        created_by: userId,
      })
      .select("*")
      .single();

    if (pError) {
      return NextResponse.json({ error: pError.message }, { status: 400 });
    }

    // 2. Link payment entries and update stage entries
    if (entries && Array.isArray(entries) && entries.length > 0) {
      const paymentEntriesToInsert = entries.map((e: any) => ({
        business_id: businessId,
        payment_id: payment.id,
        stage_entry_id: e.stage_entry_id,
        amount_applied: parseFloat(e.amount_to_apply),
      }));

      const { error: peError } = await supabase
        .from("job_work_payment_entries")
        .insert(paymentEntriesToInsert);

      if (peError) {
        return NextResponse.json({ error: `Payment recorded but entries link failed: ${peError.message}` }, { status: 400 });
      }

      // 3. For each stage entry, update its paid_amount and status
      for (const e of entries) {
        // Fetch current paid_amount of this stage entry
        const { data: entryData } = await supabase
          .from("stage_entries")
          .select("total_job_work_amount, paid_amount")
          .eq("id", e.stage_entry_id)
          .single();

        if (entryData) {
          const currentPaid = parseFloat(entryData.paid_amount as any || 0);
          const newPaid = currentPaid + parseFloat(e.amount_to_apply);
          const totalAmount = parseFloat(entryData.total_job_work_amount as any || 0);

          let paymentStatus = "unpaid";
          if (newPaid >= totalAmount) {
            paymentStatus = "paid";
          } else if (newPaid > 0) {
            paymentStatus = "partial";
          }

          await supabase
            .from("stage_entries")
            .update({
              paid_amount: newPaid,
              payment_status: paymentStatus,
            })
            .eq("id", e.stage_entry_id);
        }
      }
    }

    // Log audit trail
    await logAudit(businessId, "record_payment", "job_work_payments", payment.id, payment);

    return NextResponse.json({ payment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
