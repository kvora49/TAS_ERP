import { workerReportFacts } from "@/lib/worker-report-facts";
import { readReportRows, requireReportResults } from "@/lib/report-data";
import { validReportRequest } from "@/lib/report-request";
import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-04-01`;

  const { searchParams } = new URL(req.url);
  if (!validReportRequest(searchParams)) return NextResponse.json({ error: "Invalid report filters" }, { status: 400 });
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? today.toISOString().split("T")[0];
  const workerId = searchParams.get("worker_id");
  const stageName = searchParams.get("stage_name");
  const lotId = searchParams.get("lot_id");
  const paymentStatus = searchParams.get("payment_status");
  const bid = businessId;

  try {
    let query = supabase.from("stage_entries").select("id,entry_number,entry_date,qty_in,qty_out,wastage_qty,job_work_rate,total_job_work_amount,total_labor_cost,paid_amount,payment_status,worker_id,lot_stage:lot_production_stages(id,stage_name,lot_id,lot:production_lots(id,lot_number))").eq("business_id", bid).gte("entry_date", from).lte("entry_date", to);
    if (workerId && workerId !== "all") query = query.eq("worker_id", workerId);
    const results = await Promise.all([
      readReportRows(query.order("entry_date", { ascending: false }).order("id")),
      readReportRows(supabase.from("workers").select("id,name,worker_id").eq("business_id", bid).order("id")),
      readReportRows(supabase.from("parties").select("id,name,company_name,code").eq("business_id", bid).order("id")),
      readReportRows(supabase.from("lot_defects").select("id,lot_id,responsible_worker_id,quantity,status").eq("business_id", bid).is("deleted_at", null).gte("defect_date", from).lte("defect_date", to).order("id")),
      readReportRows(supabase.from("defect_resolutions").select("id,defect_id,qty_recovered,qty_b_grade,qty_scrapped").eq("business_id", bid).gte("resolution_date", from).lte("resolution_date", to).order("id")),
      readReportRows(supabase.from("job_work_payment_entries").select("id,stage_entry_id,amount_applied,payment:job_work_payments!inner(payment_date,status)").eq("business_id", bid).gt("payment.payment_date", to).eq("payment.status", "success").order("id")),
      readReportRows(supabase.from("payment_allocations").select("id,bill_id,allocated_amount,payment:payments!inner(payment_date,status)").eq("business_id", bid).eq("bill_type", "job_work_entry").gt("payment.payment_date", to).in("payment.status", ["completed", "success"]).order("id")),
    ]);
    requireReportResults(results);
    let entries = results[0].data;
    if (lotId && lotId !== "all") entries = entries.filter(e => e.lot_stage?.lot_id === lotId);
    if (stageName && stageName !== "all") entries = entries.filter(e => (e.lot_stage?.stage_name || "").toLowerCase().includes(stageName.toLowerCase()));
    if (paymentStatus && paymentStatus !== "all") {
      const rollback = new Map<string, number>();
      for (const a of [...results[5].data, ...results[6].data]) { const id = a.stage_entry_id || a.bill_id; rollback.set(id, (rollback.get(id) || 0) + Number(a.amount_applied ?? a.allocated_amount ?? 0)); }
      entries = entries.filter(e => { const paid = Math.max(0, Number(e.paid_amount || 0) - (rollback.get(e.id) || 0)), amount = Number(e.total_job_work_amount ?? e.total_labor_cost ?? 0); const status = paid >= amount && amount > 0 ? "paid" : paid > 0 ? "partial" : "unpaid"; return status === paymentStatus || (paymentStatus === "partially_paid" && status === "partial"); });
    }
    const facts = workerReportFacts(entries, results[1].data, results[2].data, results[3].data.filter(d => (!workerId || workerId === "all" || d.responsible_worker_id === workerId) && (!lotId || lotId === "all" || d.lot_id === lotId)), results[4].data, [...results[5].data, ...results[6].data], searchParams.get("selected_worker_id") || workerId);
    return NextResponse.json({ from, to, ...facts });
  } catch (err: any) {
    console.error("[reports/worker-job-work]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
