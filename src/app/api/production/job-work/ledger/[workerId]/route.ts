import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { workerId: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workerId } = params;

  try {
    // 1. Fetch worker details
    const { data: worker, error: wError } = await supabase
      .from("workers")
      .select("*")
      .eq("id", workerId)
      .eq("business_id", businessId)
      .single();

    if (wError || !worker) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    // 2. Fetch all stage entries completed by this worker
    const { data: stageEntries } = await supabase
      .from("stage_entries")
      .select(`
        id,
        entry_date,
        entry_number,
        qty_out,
        job_work_rate,
        total_job_work_amount,
        payment_status,
        lot_id,
        lot:production_lots(lot_number),
        stage:lot_production_stages(stage_name)
      `)
      .eq("worker_id", workerId)
      .eq("business_id", businessId)
      .order("entry_date", { ascending: true });

    // 3. Fetch all payments recorded for this worker
    const { data: payments } = await supabase
      .from("job_work_payments")
      .select("*")
      .eq("worker_id", workerId)
      .eq("business_id", businessId)
      .eq("status", "success")
      .order("payment_date", { ascending: true });

    // 4. Combine into ledger entries
    const ledger: any[] = [];
    let runningBalance = 0;

    // Add stage entries (Debits - worker earns this money, so outstanding balance goes UP)
    stageEntries?.forEach((entry: any) => {
      const amount = parseFloat(entry.total_job_work_amount as any || 0);
      ledger.push({
        id: entry.id,
        date: entry.entry_date,
        entry_type: "stage_entry",
        ref_no: entry.entry_number,
        lot_id: entry.lot_id,
        lot_number: entry.lot?.lot_number || "—",
        stage_name: entry.stage?.stage_name || "—",
        qty: entry.qty_out,
        rate: parseFloat(entry.job_work_rate as any || 0),
        amount,
        payment_status: entry.payment_status,
        timestamp: new Date(entry.entry_date).getTime(),
      });
    });

    // Add payments (Credits - company pays this money, so outstanding balance goes DOWN)
    payments?.forEach((payment) => {
      const amount = parseFloat(payment.paid_amount as any || 0);
      ledger.push({
        id: payment.id,
        date: payment.payment_date,
        entry_type: "payment",
        ref_no: payment.payment_number,
        lot_id: null,
        lot_number: "—",
        stage_name: payment.payment_mode, // show payment mode as stage_name for payments row
        qty: null,
        rate: null,
        amount: -amount, // negative to show cash outflow / credit
        payment_status: "paid",
        bank_name: payment.bank_name,
        ref_code: payment.reference_no,
        timestamp: new Date(payment.payment_date).getTime(),
      });
    });

    // Sort chronologically by date
    ledger.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      // If dates match, put stage entries before payments
      return a.entry_type === "stage_entry" ? -1 : 1;
    });

    // Calculate running balance
    const ledgerWithBalance = ledger.map((row) => {
      runningBalance += row.amount; // Add debit (positive) or subtract credit (negative)
      return {
        ...row,
        balance: runningBalance,
      };
    });

    // Reverse for UI table display (newest first)
    const displayLedger = [...ledgerWithBalance].reverse();

    // Stats
    const totalJobWorkAmount = stageEntries?.reduce((acc, curr) => acc + parseFloat(curr.total_job_work_amount as any || 0), 0) || 0;
    const totalPaidAmount = payments?.reduce((acc, curr) => acc + parseFloat(curr.paid_amount as any || 0), 0) || 0;
    const currentOutstanding = totalJobWorkAmount - totalPaidAmount;

    return NextResponse.json({
      worker,
      ledger: displayLedger,
      stats: {
        totalJobWorkAmount,
        totalPaidAmount,
        currentOutstanding,
        totalEntries: stageEntries?.length || 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
