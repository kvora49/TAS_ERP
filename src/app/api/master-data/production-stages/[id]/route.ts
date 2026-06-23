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
    // Soft delete: update deleted_at
    const { error } = await supabase
      .from("production_stages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", stageId)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
