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
    // Soft delete: update deleted_at instead of deleting row
    const { error } = await supabase
      .from("size_sets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sizeSetId)
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
