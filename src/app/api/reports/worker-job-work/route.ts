import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase.from("users").select("business_id").eq("id", user.id).single();
  if (!userData?.business_id) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? `${new Date().getFullYear()}-04-01`;
  const to = searchParams.get("to") ?? new Date().toISOString().split("T")[0];
  const bid = userData.business_id;

  try {
    const { data: entries } = await supabase
      .from("stage_entries")
      .select(`
        id, entry_number, entry_date, qty_in, qty_out, total_job_work_amount, total_labor_cost, paid_amount, payment_status,
        lot_stage:lot_production_stages(stage_name),
        worker:workers(id, name, worker_id, type, phone)
      `)
      .eq("business_id", bid)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: false });

    const workerMap: Record<string, {
      id: string; name: string; code: string;
      jobs: number; qty_in: number; qty_out: number;
      amount_due: number; amount_paid: number;
      stages: Set<string>;
    }> = {};

    (entries ?? []).forEach((e: any) => {
      const w = e.worker;
      const wid = w?.id ?? "unknown";
      const name = w?.name ?? "In-house / Unknown";
      const code = w?.worker_id ?? "—";
      if (!workerMap[wid]) {
        workerMap[wid] = { id: wid, name, code, jobs: 0, qty_in: 0, qty_out: 0, amount_due: 0, amount_paid: 0, stages: new Set() };
      }
      const due = Number(e.total_job_work_amount ?? e.total_labor_cost ?? 0);
      const paid = Number(e.paid_amount ?? 0);
      workerMap[wid].jobs += 1;
      workerMap[wid].qty_in += Number(e.qty_in ?? 0);
      workerMap[wid].qty_out += Number(e.qty_out ?? 0);
      workerMap[wid].amount_due += due;
      workerMap[wid].amount_paid += paid;
      if (e.lot_stage?.stage_name) workerMap[wid].stages.add(e.lot_stage.stage_name);
    });

    const workers = Object.values(workerMap).map((w) => ({
      ...w,
      stages: Array.from(w.stages).join(", "),
      outstanding: w.amount_due - w.amount_paid,
      efficiency: w.qty_in > 0 ? (w.qty_out / w.qty_in) * 100 : 100,
    })).sort((a, b) => b.amount_due - a.amount_due);

    const totalDue = workers.reduce((s, w) => s + w.amount_due, 0);
    const totalPaid = workers.reduce((s, w) => s + w.amount_paid, 0);
    const totalOutstanding = workers.reduce((s, w) => s + w.outstanding, 0);
    const totalJobs = workers.reduce((s, w) => s + w.jobs, 0);

    const rawEntries = (entries ?? []).map((e: any) => ({
      id: e.id,
      worker: e.worker?.name ?? "—",
      stage: e.lot_stage?.stage_name ?? "—",
      date: e.entry_date,
      qty_in: Number(e.qty_in ?? 0),
      qty_out: Number(e.qty_out ?? 0),
      amount_due: Number(e.total_job_work_amount ?? e.total_labor_cost ?? 0),
      amount_paid: Number(e.paid_amount ?? 0),
      outstanding: Number(e.total_job_work_amount ?? 0) - Number(e.paid_amount ?? 0),
    }));

    return NextResponse.json({
      from,
      to,
      summary: { totalDue, totalPaid, totalOutstanding, totalJobs, totalWorkers: workers.length },
      workers,
      entries: rawEntries,
    });
  } catch (err: any) {
    console.error("[reports/worker-job-work]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
