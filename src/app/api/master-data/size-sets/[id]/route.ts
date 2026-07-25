import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const sizeSetId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, sizes, is_active, updated_at: lastKnownUpdatedAt } = body;

    if (!name || !sizes || !Array.isArray(sizes) || sizes.length === 0 || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Name, sizes list, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Optimistic locking update query
    const { data: updatedSizeSet, error } = await supabase
      .from("size_sets")
      .update({
        name,
        sizes,
        is_active: is_active !== false,
      })
      .eq("id", sizeSetId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedSizeSet || updatedSizeSet.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Size Set was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ sizeSet: updatedSizeSet[0] });
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
  const sizeSetId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetSizeSetId = searchParams.get("target_size_set_id");

    const { data: sizeSet, error: sizeErr } = await supabase
      .from("size_sets")
      .select("id, name")
      .eq("id", sizeSetId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (sizeErr || !sizeSet) {
      return NextResponse.json({ error: "Size Set not found" }, { status: 404 });
    }

    // Query designs & production lots linked to this size set
    const { data: designs } = await supabase
      .from("designs")
      .select("id")
      .eq("size_set_id", sizeSetId)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const { data: lots } = await supabase
      .from("production_lots")
      .select("id")
      .eq("size_set_id", sizeSetId)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const designsCount = designs?.length || 0;
    const lotsCount = lots?.length || 0;
    const hasReferences = designsCount > 0 || lotsCount > 0;

    if (action === "check") {
      return NextResponse.json({
        hasReferences,
        designsCount,
        lotsCount,
      });
    }

    if (action === "transfer") {
      if (!targetSizeSetId) {
        return NextResponse.json({ error: "Target Size Set is required for transfer" }, { status: 400 });
      }

      const { data: targetSet } = await supabase
        .from("size_sets")
        .select("id, name")
        .eq("id", targetSizeSetId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetSet) {
        return NextResponse.json({ error: "Target Size Set not found" }, { status: 404 });
      }

      // Re-assign designs
      if (designsCount > 0) {
        await supabase
          .from("designs")
          .update({ size_set_id: targetSizeSetId })
          .eq("size_set_id", sizeSetId)
          .eq("business_id", businessId);
      }

      // Re-assign production lots
      if (lotsCount > 0) {
        await supabase
          .from("production_lots")
          .update({ size_set_id: targetSizeSetId })
          .eq("size_set_id", sizeSetId)
          .eq("business_id", businessId);
      }

      await supabase
        .from("size_sets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", sizeSetId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Size Set '${sizeSet.name}' deleted. Re-assigned ${designsCount} designs and ${lotsCount} production lots to '${targetSet.name}'.`,
      });
    }

    if (action === "force") {
      await supabase
        .from("size_sets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", sizeSetId)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Size Set '${sizeSet.name}' soft-deleted. Historical stock matrices remain preserved.`,
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
