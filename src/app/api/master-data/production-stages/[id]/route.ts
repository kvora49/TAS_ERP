import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const stageId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      icon,
      color,
      custom_fields,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!name || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Name and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Optimistic locking update query
    const { data: updatedStage, error } = await supabase
      .from("production_stages")
      .update({
        name,
        description: description || null,
        icon: icon || null,
        color: color || null,
        custom_fields: custom_fields || [],
        is_active: is_active !== false,
      })
      .eq("id", stageId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedStage || updatedStage.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Stage was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ stage: updatedStage[0] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const stageId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetStageId = searchParams.get("target_stage_id");

    const { data: stage, error: stageErr } = await supabase
      .from("production_stages")
      .select("id, name")
      .eq("id", stageId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (stageErr || !stage) {
      return NextResponse.json({ error: "Production Stage not found" }, { status: 404 });
    }

    // Query active stage entries and active WIP production lots currently in this stage
    const { data: stageEntries } = await supabase
      .from("stage_entries")
      .select("id, lot_id")
      .eq("stage_id", stageId)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const entriesCount = stageEntries?.length || 0;

    if (action === "check") {
      return NextResponse.json({
        hasReferences: entriesCount > 0,
        entriesCount,
      });
    }

    if (action === "transfer") {
      if (!targetStageId) {
        return NextResponse.json({ error: "Target Production Stage is required for transfer" }, { status: 400 });
      }

      const { data: targetStage } = await supabase
        .from("production_stages")
        .select("id, name")
        .eq("id", targetStageId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetStage) {
        return NextResponse.json({ error: "Target Production Stage not found" }, { status: 404 });
      }

      // Re-assign stage entries
      if (entriesCount > 0) {
        await supabase
          .from("stage_entries")
          .update({ stage_id: targetStageId })
          .eq("stage_id", stageId)
          .eq("business_id", businessId);
      }

      await supabase
        .from("production_stages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", stageId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Production Stage '${stage.name}' deleted. Re-assigned ${entriesCount} WIP stage entries to '${targetStage.name}'.`,
      });
    }

    if (action === "force") {
      await supabase
        .from("production_stages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", stageId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Production Stage '${stage.name}' soft-deleted. Historical worker piece-rate logs remain preserved.`,
      });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
