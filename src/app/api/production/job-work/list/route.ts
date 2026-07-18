import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workerId = searchParams.get("worker_id");
  const stageId = searchParams.get("stage_id");
  const lotId = searchParams.get("lot_id");
  const paymentStatus = searchParams.get("payment_status");
  const search = searchParams.get("search");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    let query = supabase
      .from("stage_entries")
      .select("*")
      .eq("business_id", businessId)
      .not("worker_id", "is", null) // only entries with workers
      .order("entry_date", { ascending: false });

    if (workerId && workerId !== "all") {
      query = query.eq("worker_id", workerId);
    }
    if (lotId && lotId !== "all") {
      query = query.eq("lot_id", lotId);
    }
    if (paymentStatus && paymentStatus !== "all") {
      query = query.eq("payment_status", paymentStatus);
    }
    if (startDate) {
      query = query.gte("entry_date", startDate);
    }
    if (endDate) {
      query = query.lte("entry_date", endDate);
    }

    const { data: entries, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch related tables separately
    const lotIds = entries.map((e) => e.lot_id).filter(Boolean);
    const stageIds = entries.map((e) => e.lot_stage_id).filter(Boolean);
    const workerIds = entries.map((e) => e.worker_id).filter(Boolean);

    const { data: lotsList } = lotIds.length > 0 ? await supabase
      .from("production_lots")
      .select("id, lot_number, design_id")
      .in("id", lotIds) : { data: [] };

    const { data: stagesList } = stageIds.length > 0 ? await supabase
      .from("lot_production_stages")
      .select("id, stage_name")
      .in("id", stageIds) : { data: [] };

    const { data: workersList } = workerIds.length > 0 ? await supabase
      .from("workers")
      .select("id, name, worker_id")
      .in("id", workerIds) : { data: [] };

    const designIds = lotsList?.map((l) => l.design_id).filter(Boolean) || [];
    const { data: designsList } = designIds.length > 0 ? await supabase
      .from("designs")
      .select("id, name, design_number")
      .in("id", designIds) : { data: [] };

    // Combine in-memory
    const designsMap = new Map((designsList || []).map((d) => [d.id, { code: d.design_number, name: d.name }]));
    const lotsMap = new Map((lotsList || []).map((l) => [l.id, {
      id: l.id,
      lot_number: l.lot_number,
      design: l.design_id ? designsMap.get(l.design_id) : null
    }]));
    const stagesMap = new Map((stagesList || []).map((s) => [s.id, s]));
    const workersMap = new Map((workersList || []).map((w) => [w.id, w]));

    const mappedEntries = entries.map((e) => ({
      ...e,
      lot: e.lot_id ? lotsMap.get(e.lot_id) : null,
      stage: e.lot_stage_id ? stagesMap.get(e.lot_stage_id) : null,
      worker: e.worker_id ? workersMap.get(e.worker_id) : null,
    }));

    // In-memory filter for stage name and search
    let filtered = mappedEntries;
    if (stageId && stageId !== "all") {
      filtered = mappedEntries.filter((e: any) => e.stage?.stage_name === stageId);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (e: any) =>
          e.entry_number.toLowerCase().includes(searchLower) ||
          e.lot?.lot_number.toLowerCase().includes(searchLower) ||
          e.worker?.name.toLowerCase().includes(searchLower) ||
          e.worker?.worker_id.toLowerCase().includes(searchLower)
      );
    }

    // Calculate period stats
    let totalEntries = filtered.length;
    let totalJobWorkAmount = 0;
    let totalPaidAmount = 0;

    filtered.forEach((e) => {
      totalJobWorkAmount += parseFloat(e.total_job_work_amount as any || 0);
      totalPaidAmount += parseFloat(e.paid_amount as any || 0);
    });

    const totalOutstanding = totalJobWorkAmount - totalPaidAmount;

    return NextResponse.json({
      entries: filtered,
      stats: {
        totalEntries,
        totalJobWorkAmount,
        totalPaidAmount,
        totalOutstanding,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
