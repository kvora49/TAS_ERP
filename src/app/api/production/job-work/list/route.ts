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
      .select(`
        *,
        lot:production_lots(id, lot_number, design:designs(code, name)),
        stage:lot_production_stages(id, stage_name),
        worker:workers(id, name, worker_id)
      `)
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

    // In-memory filter for stage name and search
    let filtered = entries || [];
    if (stageId && stageId !== "all" && entries) {
      filtered = entries.filter((e: any) => e.stage?.stage_name === stageId);
    }

    if (search && entries) {
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
