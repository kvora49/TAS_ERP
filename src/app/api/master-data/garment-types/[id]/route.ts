import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data: garmentType, error } = await supabase
      .from("garment_types")
      .update({ name })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ garmentType });
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
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetGarmentTypeId = searchParams.get("target_garment_type_id");

    const { data: garmentType, error: gErr } = await supabase
      .from("garment_types")
      .select("id, name")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (gErr || !garmentType) {
      return NextResponse.json({ error: "Garment Type not found" }, { status: 404 });
    }

    // Query designs & production lots referencing this garment type
    const { data: designs } = await supabase
      .from("designs")
      .select("id")
      .eq("category", garmentType.name)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const { data: lots } = await supabase
      .from("production_lots")
      .select("id")
      .eq("garment_type_id", id)
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
      if (!targetGarmentTypeId) {
        return NextResponse.json({ error: "Target Garment Type is required for transfer" }, { status: 400 });
      }

      const { data: targetGType } = await supabase
        .from("garment_types")
        .select("id, name")
        .eq("id", targetGarmentTypeId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetGType) {
        return NextResponse.json({ error: "Target Garment Type not found" }, { status: 404 });
      }

      // Re-assign designs category name
      if (designsCount > 0) {
        await supabase
          .from("designs")
          .update({ category: targetGType.name })
          .eq("category", garmentType.name)
          .eq("business_id", businessId);
      }

      // Re-assign production lots garment_type_id
      if (lotsCount > 0) {
        await supabase
          .from("production_lots")
          .update({ garment_type_id: targetGarmentTypeId })
          .eq("garment_type_id", id)
          .eq("business_id", businessId);
      }

      await supabase
        .from("garment_types")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Garment Type '${garmentType.name}' deleted. Re-assigned ${designsCount} designs and ${lotsCount} production lots to '${targetGType.name}'.`,
      });
    }

    if (action === "force") {
      await supabase
        .from("garment_types")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", businessId);

      return NextResponse.json({
        success: true,
        message: `Garment Type '${garmentType.name}' soft-deleted. Historical designs and consumption rules preserved.`,
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
