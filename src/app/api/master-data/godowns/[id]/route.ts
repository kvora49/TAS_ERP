import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const handlerStart = Date.now();
  const supabase = createClient();
  const godownId = params.id;

  const authStart = Date.now();
  const businessId = await getSessionBusinessId();
  const authDuration = Date.now() - authStart;

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      address,
      contact_person,
      phone,
      is_primary,
      is_active,
      updated_at: lastKnownUpdatedAt,
    } = body;

    if (!name || !lastKnownUpdatedAt) {
      return NextResponse.json(
        { error: "Name and last known updated_at timestamp are required" },
        { status: 400 }
      );
    }

    // Reset others if set to primary
    if (is_primary) {
      await supabase
        .from("godowns")
        .update({ is_primary: false })
        .eq("business_id", businessId);
    }

    const dbStart = Date.now();
    // Optimistic locking update query
    const { data: updatedGodown, error } = await supabase
      .from("godowns")
      .update({
        name,
        address: address || null,
        contact_person: contact_person || null,
        phone: phone || null,
        is_primary: !!is_primary,
        is_active: is_active !== false,
      })
      .eq("id", godownId)
      .eq("business_id", businessId)
      .eq("updated_at", lastKnownUpdatedAt) // Optimistic Lock Check!
      .select();
    const dbDuration = Date.now() - dbStart;


    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updatedGodown || updatedGodown.length === 0) {
      return NextResponse.json(
        { error: "Conflict: Godown was modified by another transaction. Please reload." },
        { status: 409 }
      );
    }

    return NextResponse.json({ godown: updatedGodown[0] });
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
  const handlerStart = Date.now();
  const supabase = createClient();
  const godownId = params.id;

  const authStart = Date.now();
  const businessId = await getSessionBusinessId();
  const authDuration = Date.now() - authStart;

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dbStart = Date.now();
    // Soft delete: update deleted_at
    const { error } = await supabase
      .from("godowns")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", godownId)
      .eq("business_id", businessId);
    const dbDuration = Date.now() - dbStart;


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
