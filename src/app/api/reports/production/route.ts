import { productionReportFacts } from "@/lib/production-report-facts";
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
  const status = searchParams.get("status");
  const designId = searchParams.get("design_id");
  const brandId = searchParams.get("brand_id");
  const selectedLotId = searchParams.get("lot_id");
  const designSearch = searchParams.get("design_search");
  const bid = businessId;
  const companyWide = [workerId,stageName,status,designId,brandId,selectedLotId,designSearch].every(value=>!value||value==="all");

  try {
    let lotsQuery = supabase
      .from("production_lots")
      .select(`
        id, lot_number, lot_date, status, total_quantity, completed_quantity,
        defect_quantity, reworked_quantity, b_grade_quantity, scrapped_quantity, created_at,
        design:designs(id, name, design_number),
        brand:brands(id, name)
      `)
      .eq("business_id", bid)
      .is("deleted_at", null)
      .gte("lot_date", from)
      .lte("lot_date", to);

    if (status && status !== "all") lotsQuery = lotsQuery.eq("status", status);
    if (designId && designId !== "all") lotsQuery = lotsQuery.eq("design_id", designId);
    if (brandId && brandId !== "all") lotsQuery = lotsQuery.eq("brand_id", brandId);

    if (selectedLotId && selectedLotId !== "all") lotsQuery = lotsQuery.eq("id", selectedLotId);

    let stageEntriesQuery = supabase
      .from("stage_entries")
      .select(`
        id, entry_number, entry_date, qty_in, qty_out, wastage_qty,
        total_job_work_amount, total_labor_cost, job_work_rate, worker_id, lot_production_stage_id:lot_stage_id,
        lot_stage:lot_production_stages(id, stage_name, lot_id),
        worker:workers(id, name)
      `)
      .eq("business_id", bid)
      .gte("entry_date", from)
      .lte("entry_date", to);

    if (workerId && workerId !== "all") {
      stageEntriesQuery = stageEntriesQuery.eq("worker_id", workerId);
    }

    const [lotsResult, stageEntriesResult, defectsResult, defectResolutionsResult, stagesMasterResult, wipResult] = await Promise.all([
      readReportRows(lotsQuery.order("lot_date", { ascending: false }).order("id")),
      readReportRows(stageEntriesQuery.order("entry_date", { ascending: true }).order("id")),
      readReportRows(supabase
        .from("lot_defects")
        .select("id, lot_id, defect_number, defect_date, defect_category, quantity, status, responsible_stage_id, responsible_worker_id")
        .eq("business_id", bid)
        .is("deleted_at", null)
        .lte("defect_date", to).order("id")),
      readReportRows(supabase
        .from("defect_resolutions")
        .select("id, defect_id, resolution_type, qty_recovered, qty_b_grade, qty_scrapped, rework_cost, deduction_amount")
        .eq("business_id", bid)
        .gte("resolution_date", from)
        .lte("resolution_date", to).order("id")),
      readReportRows(supabase
        .from("production_stages")
        .select("id, name, order_index, template_id")
        .eq("business_id", bid)
        .is("deleted_at", null)
        .order("order_index", { ascending: true }).order("id")),
      companyWide ? supabase.rpc("fn_report_wip_positions", {p_business_id:bid,p_from:from,p_to:to}) : Promise.resolve({data:null,error:null}),
    ]);

    requireReportResults([lotsResult, stageEntriesResult, defectsResult, defectResolutionsResult, stagesMasterResult, wipResult]);
    let rawLots = lotsResult.data ?? [];
    let stageEntries = stageEntriesResult.data ?? [];
    const defects = defectsResult.data ?? [];
    const defectResolutions = defectResolutionsResult.data ?? [];

    if (stageName && stageName !== "all") {
      stageEntries = stageEntries.filter((e: any) =>
        (e.lot_stage?.stage_name || "").toLowerCase().includes(stageName.toLowerCase())
      );
    }

    if (designSearch && designSearch.trim()) {
      const q = designSearch.trim().toLowerCase();
      rawLots = rawLots.filter((l: any) =>
        (l.design?.name || "").toLowerCase().includes(q) ||
        (l.design?.design_number || "").toLowerCase().includes(q) ||
        (l.lot_number || "").toLowerCase().includes(q)
      );
    }

    const explicitLotScope = [selectedLotId, designId, brandId, status].some(v => v && v !== "all") || !!designSearch;
    const lotIds = new Set(rawLots.map((l: any) => l.id));
    if (explicitLotScope) stageEntries = stageEntries.filter((e: any) => lotIds.has(e.lot_stage?.lot_id));
    const stageIds = new Set(stageEntries.map((e: any) => e.lot_production_stage_id));
    for (const stage of stagesMasterResult.data ?? []) if (stageName && stageName !== "all" && stage.name?.toLowerCase().includes(stageName.toLowerCase())) stageIds.add(stage.id);
    const scopedDefects = defects.filter((d: any) => (!explicitLotScope || lotIds.has(d.lot_id)) && (!workerId || workerId === "all" || d.responsible_worker_id === workerId) && (!stageName || stageName === "all" || stageIds.has(d.responsible_stage_id)));
    const defectIds = new Set(scopedDefects.map((d: any) => d.id));
    const scopedResolutions = defectResolutions.filter((r: any) => defectIds.has(r.defect_id));
    const facts=productionReportFacts(rawLots, stageEntries, scopedDefects.filter((d: any) => d.defect_date >= from), scopedResolutions, stagesMasterResult.data ?? [], selectedLotId);
    const snapshot=wipResult.data;
    return NextResponse.json({ from,to,...facts,reconciliation:{...facts.reconciliation,opening_wip:snapshot?.opening_wip??null,closing_wip:snapshot?.closing_wip??null,opening_wip_value:snapshot?.opening_value??null,closing_wip_value:snapshot?.closing_value??null},metadata:{...facts.metadata,openingWipAvailable:snapshot?.opening_wip!=null,wipBasis:snapshot?.basis??"Approved company-wide WIP snapshots are unavailable or cannot be attributed to the selected filters.",note:"Stage quantities are throughput; activity is a period cohort. Reviewed opening/closing WIP uses exact-date full-company counts, when available. This is not a certified movement reconciliation."} });
  } catch (err: any) {
    console.error("[reports/production]", err);
    return NextResponse.json({ error: "Failed to load production report" }, { status: 500 });
  }
}
