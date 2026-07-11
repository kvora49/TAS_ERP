import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const garmentTypeId = searchParams.get("garment_type_id");
  const sizeSetId = searchParams.get("size_set_id");

  if (!garmentTypeId || !sizeSetId) {
    return NextResponse.json({ avg_meters: 0 });
  }

  try {
    // Run SQL query using supabase client
    // Since PostgREST does not support joins with aggregations on arbitrary tables, we can do a query
    // Let's use RPC if available or a raw direct query if we have to, or we can fetch lots and compute it
    // Wait, let's fetch lots with garment_type_id and size_set_id and their lot_rolls
    const { data: lots, error: lotsError } = await supabase
      .from("production_lots")
      .select(`
        id,
        total_quantity,
        lot_rolls (allocated_meters)
      `)
      .eq("business_id", businessId)
      .eq("garment_type_id", garmentTypeId)
      .eq("size_set_id", sizeSetId);

    if (lotsError) {
      return NextResponse.json({ error: lotsError.message }, { status: 500 });
    }

    let totalMeters = 0;
    let totalQty = 0;

    (lots || []).forEach((lot: any) => {
      const lotMeters = (lot.lot_rolls || []).reduce((acc: number, curr: any) => acc + Number(curr.allocated_meters || 0), 0);
      if (lotMeters > 0 && lot.total_quantity > 0) {
        totalMeters += lotMeters;
        totalQty += Number(lot.total_quantity);
      }
    });

    const avgMeters = totalQty > 0 ? (totalMeters / totalQty) : 0;

    return NextResponse.json({ avg_meters: Number(avgMeters.toFixed(4)) });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
