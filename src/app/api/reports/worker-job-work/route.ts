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
  const from = searchParams.get("from") ?? defaultFrom;
  const to = searchParams.get("to") ?? today.toISOString().split("T")[0];
  const workerId = searchParams.get("worker_id");
  const stageName = searchParams.get("stage_name");
  const bid = businessId;

  try {
    let query = supabase
      .from("stage_entries")
      .select(`
        id, entry_number, entry_date, qty_in, qty_out, total_job_work_amount, total_labor_cost, paid_amount, payment_status, worker_id,
        lot_stage:lot_production_stages(stage_name)
      `)
      .eq("business_id", bid)
      .gte("entry_date", from)
      .lte("entry_date", to);

    if (workerId && workerId !== "all") {
      query = query.eq("worker_id", workerId);
    }

    let jobWorkPaymentsQuery = supabase
      .from("job_work_payments")
      .select("worker_id, paid_amount, payment_date")
      .eq("business_id", bid)
      .neq("status", "cancelled")
      .gte("payment_date", from)
      .lte("payment_date", to);

    if (workerId && workerId !== "all") {
      jobWorkPaymentsQuery = jobWorkPaymentsQuery.eq("worker_id", workerId);
    }

    const [rawEntriesResult, jobWorkPaymentsResult, workersListResult, partiesListResult] = await Promise.all([
      query.order("entry_date", { ascending: false }),
      jobWorkPaymentsQuery,
      supabase.from("workers").select("id, name, worker_id, phone, type").eq("business_id", bid),
      supabase.from("parties").select("id, name, code, phone").eq("business_id", bid),
    ]);

    const workersLookup = new Map<string, { id: string; name: string; code: string }>();
    (partiesListResult.data || []).forEach((p: any) => {
      workersLookup.set(p.id, { id: p.id, name: p.name, code: p.code || "WRK" });
    });
    (workersListResult.data || []).forEach((w: any) => {
      workersLookup.set(w.id, { id: w.id, name: w.name, code: w.worker_id || "WRK" });
    });

    let entries = rawEntriesResult.data ?? [];

    if (stageName && stageName !== "all") {
      entries = entries.filter((e: any) =>
        (e.lot_stage?.stage_name || "").toLowerCase().includes(stageName.toLowerCase())
      );
    }

    const workerMap: Record<string, {
      id: string; name: string; code: string;
      jobs: number; qty_in: number; qty_out: number;
      amount_due: number; amount_paid: number;
      stages: Set<string>;
    }> = {};

    (entries ?? []).forEach((e: any) => {
      const wid = e.worker_id ?? "unknown";
      const resolvedWorker = workersLookup.get(wid);
      const name = resolvedWorker?.name ?? "In-house / Direct Worker";
      const code = resolvedWorker?.code ?? "—";
      if (!workerMap[wid]) {
        workerMap[wid] = { id: wid, name, code, jobs: 0, qty_in: 0, qty_out: 0, amount_due: 0, amount_paid: 0, stages: new Set() };
      }
      const due = Number(e.total_job_work_amount ?? e.total_labor_cost ?? 0);
      const entryPaid = Number(e.paid_amount ?? 0);
      workerMap[wid].jobs += 1;
      workerMap[wid].qty_in += Number(e.qty_in ?? 0);
      workerMap[wid].qty_out += Number(e.qty_out ?? 0);
      workerMap[wid].amount_due += due;
      workerMap[wid].amount_paid += entryPaid;
      if (e.lot_stage?.stage_name) workerMap[wid].stages.add(e.lot_stage.stage_name);
    });

    // Also account for direct Job Work Payments made to workers
    (jobWorkPaymentsResult.data ?? []).forEach((jwp: any) => {
      const wid = jwp.worker_id ?? "unknown";
      const resolvedWorker = workersLookup.get(wid);
      const name = resolvedWorker?.name ?? "In-house / Direct Worker";
      const code = resolvedWorker?.code ?? "—";
      if (!workerMap[wid]) {
        workerMap[wid] = { id: wid, name, code, jobs: 0, qty_in: 0, qty_out: 0, amount_due: 0, amount_paid: 0, stages: new Set() };
      }
      workerMap[wid].amount_paid += Number(jwp.paid_amount ?? 0);
    });

    const workers = Object.values(workerMap).map((w) => ({
      ...w,
      stages: Array.from(w.stages).join(", "),
      outstanding: Math.max(0, w.amount_due - w.amount_paid),
      efficiency: w.qty_in > 0 ? (w.qty_out / w.qty_in) * 100 : 100,
    })).sort((a, b) => b.amount_due - a.amount_due);

    const totalDue = workers.reduce((s, w) => s + w.amount_due, 0);
    const totalPaid = workers.reduce((s, w) => s + w.amount_paid, 0);
    const totalOutstanding = workers.reduce((s, w) => s + w.outstanding, 0);
    const totalJobs = workers.reduce((s, w) => s + w.jobs, 0);

    const rawEntries = (entries ?? []).map((e: any) => {
      const resolvedWorker = e.worker_id ? workersLookup.get(e.worker_id) : null;
      return {
        id: e.id,
        worker: resolvedWorker?.name ?? "—",
        stage: e.lot_stage?.stage_name ?? "—",
        date: e.entry_date,
        qty_in: Number(e.qty_in ?? 0),
        qty_out: Number(e.qty_out ?? 0),
        amount_due: Number(e.total_job_work_amount ?? e.total_labor_cost ?? 0),
        amount_paid: Number(e.paid_amount ?? 0),
        outstanding: Number(e.total_job_work_amount ?? 0) - Number(e.paid_amount ?? 0),
      };
    });

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
