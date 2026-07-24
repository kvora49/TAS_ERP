import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: lotId } = params;

  try {
    const body = await request.json();
    const { stage_id, stage_name, stage_type, is_mandatory, description, worker_ids } = body;

    if (!stage_name) {
      return NextResponse.json({ error: "Stage name is required" }, { status: 400 });
    }

    // Determine next sequence_no
    const { data: existingStages } = await supabase
      .from("lot_production_stages")
      .select("sequence_no")
      .eq("lot_id", lotId)
      .eq("business_id", businessId)
      .order("sequence_no", { ascending: false });

    const maxSeq = existingStages && existingStages.length > 0 ? Math.max(...existingStages.map((s) => s.sequence_no)) : 0;
    const nextSeqNo = maxSeq + 1;

    // 1. Insert new production stage into lot_production_stages
    const { data: stage, error: stageError } = await supabase
      .from("lot_production_stages")
      .insert({
        business_id: businessId,
        lot_id: lotId,
        stage_id: stage_id || null,
        stage_name,
        stage_type: stage_type || "in_house",
        sequence_no: nextSeqNo,
        is_mandatory: is_mandatory !== false,
        description: description || null,
        status: "pending",
      })
      .select("*")
      .single();

    if (stageError || !stage) {
      return NextResponse.json({ error: stageError?.message || "Failed to create stage" }, { status: 400 });
    }

    // 2. Assign workers if worker_ids provided
    if (Array.isArray(worker_ids) && worker_ids.length > 0) {
      const workersToInsert = worker_ids.map((workerId: string) => ({
        business_id: businessId,
        lot_stage_id: stage.id,
        worker_id: workerId,
      }));

      await supabase.from("lot_stage_workers").insert(workersToInsert);
    }

    // Log audit trail
    await logAudit(businessId, "add_lot_stage", "lot_production_stages", stage.id, stage);

    return NextResponse.json({ stage });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
