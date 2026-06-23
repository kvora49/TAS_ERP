import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const materialId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      unit,
      image_url,
      default_supplier_id,
      reorder_level,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!name || !unit || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Name, Unit, and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Optimistic locking update query
    const { data: updatedMaterial, error } = await supabase
      .from("raw_material_types")
      .update({
        name,
        description: description || null,
        category: category || null,
        unit,
        image_url: image_url || null,
        default_supplier_id: default_supplier_id || null,
        reorder_level: Number(reorder_level || 0),
        is_active: is_active !== false,
      })
      .eq("id", materialId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedMaterial || updatedMaterial.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Raw Material Type was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ materialType: updatedMaterial[0] });
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
  const materialId = params.id;

  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Soft delete: update deleted_at
    const { error } = await supabase
      .from("raw_material_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", materialId)
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
