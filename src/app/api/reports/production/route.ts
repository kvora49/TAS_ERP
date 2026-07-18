import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || `${new Date().getFullYear()}-04-01`;
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

  try {
    const [lotsResult, stageEntriesResult, jobWorkResult] = await Promise.all([
      supabase
        .from("production_lots")
        .select("id, lot_number, design_name, status, total_quantity, created_at, brand:brands(name)")
        .eq("business_id", businessId)
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false }),
      supabase
        .from("production_stage_entries")
        .select("id, lot_id, stage_name, quantity_in, quantity_out, entry_date")
        .eq("business_id", businessId)
        .gte("entry_date", from)
        .lte("entry_date", to),
      supabase
        .from("job_work_entries")
        .select("id, party_id, entry_date, quantity, amount_due, status")
        .eq("business_id", businessId)
        .gte("entry_date", from)
        .lte("entry_date", to),
    ]);

    const lots = lotsResult.data || [];
    const stageEntries = stageEntriesResult.data || [];
    const jobWork = jobWorkResult.data || [];

    const totalLots = lots.length;
    const completedLots = lots.filter((l: any) => l.status === "completed").length;
    const totalProduced = lots.reduce((s: number, l: any) => s + Number(l.total_quantity || 0), 0);
    const totalJobWorkAmount = jobWork.reduce((s: number, j: any) => s + Number(j.amount_due || 0), 0);

    // Stage-wise throughput
    const stageMap: Record<string, { in: number; out: number }> = {};
    stageEntries.forEach((e: any) => {
      if (!stageMap[e.stage_name]) stageMap[e.stage_name] = { in: 0, out: 0 };
      stageMap[e.stage_name].in += Number(e.quantity_in || 0);
      stageMap[e.stage_name].out += Number(e.quantity_out || 0);
    });
    const stageThroughput = Object.entries(stageMap).map(([stage, v]) => ({ stage, ...v }));

    // Lots by status
    const lotsByStatus = lots.reduce((acc: Record<string, number>, l: any) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      from, to,
      summary: { totalLots, completedLots, totalProduced, totalJobWorkAmount },
      lots,
      stageThroughput,
      lotsByStatus,
      jobWork,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
