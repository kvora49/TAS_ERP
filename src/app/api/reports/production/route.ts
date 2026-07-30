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
    const [lotsResult, stageEntriesResult] = await Promise.all([
      supabase
        .from("production_lots")
        .select(`
          id, lot_number, lot_date, status, total_quantity, completed_quantity, created_at,
          design:designs(id, name, design_number),
          brand:brands(id, name)
        `)
        .eq("business_id", bid)
        .is("deleted_at", null)
        .gte("lot_date", from)
        .lte("lot_date", to)
        .order("lot_date", { ascending: false }),

      supabase
        .from("stage_entries")
        .select(`
          id, entry_number, entry_date, qty_in, qty_out, wastage_qty, total_job_work_amount,
          lot_stage:lot_production_stages(stage_name),
          worker:workers(id, name)
        `)
        .eq("business_id", bid)
        .gte("entry_date", from)
        .lte("entry_date", to),
    ]);

    const rawLots = lotsResult.data ?? [];
    const stageEntries = stageEntriesResult.data ?? [];

    const lots = rawLots.map((l: any) => ({
      id: l.id,
      lot_number: l.lot_number,
      design_name: l.design?.name ?? "—",
      design_number: l.design?.design_number ?? "—",
      brand: l.brand,
      status: l.status,
      total_quantity: Number(l.total_quantity ?? 0),
      created_at: l.lot_date ?? l.created_at,
    }));

    const totalLots = lots.length;
    const completedLots = lots.filter((l) => l.status === "completed").length;
    const totalProduced = lots.reduce((s, l) => s + l.total_quantity, 0);
    const totalJobWorkAmount = stageEntries.reduce((s, e: any) => s + Number(e.total_job_work_amount ?? 0), 0);

    // Stage throughput
    const stageMap: Record<string, { in: number; out: number }> = {};
    stageEntries.forEach((e: any) => {
      const sName = e.lot_stage?.stage_name ?? "Stage";
      if (!stageMap[sName]) stageMap[sName] = { in: 0, out: 0 };
      stageMap[sName].in += Number(e.qty_in ?? 0);
      stageMap[sName].out += Number(e.qty_out ?? 0);
    });
    const stageThroughput = Object.entries(stageMap).map(([stage, v]) => ({ stage, ...v }));

    // Lots by status
    const lotsByStatus = lots.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      from,
      to,
      summary: { totalLots, completedLots, totalProduced, totalJobWorkAmount },
      lots,
      stageThroughput,
      lotsByStatus,
      stageEntries: stageEntries.slice(0, 30),
    });
  } catch (err: any) {
    console.error("[reports/production]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
