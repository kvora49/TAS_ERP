import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
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
    const { data: entry, error: entryErr } = await supabase
      .from("raw_material_stock_entries")
      .select("*, godown:godowns(*)")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (entryErr) {
      return NextResponse.json({ error: entryErr.message }, { status: 404 });
    }

    const { data: items, error: itemsErr } = await supabase
      .from("raw_material_stock_entry_items")
      .select("*, material_type:raw_material_types(name, category, uom)")
      .eq("stock_entry_id", id)
      .eq("business_id", businessId);

    return NextResponse.json({
      entry: {
        ...entry,
        items: items || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

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
    const { status } = body; // e.g. 'cancelled'

    if (status !== "cancelled") {
      return NextResponse.json({ error: "Only cancellation is supported on existing stock entries" }, { status: 400 });
    }

    const { data: entry, error: entryErr } = await supabase
      .from("raw_material_stock_entries")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (entryErr) {
      return NextResponse.json({ error: entryErr.message }, { status: 500 });
    }

    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
