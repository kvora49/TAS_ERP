import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch all designs with brand and size set info
    const { data: designs, error: designsErr } = await supabase
      .from("designs")
      .select("*, brand:brands(name), size_set:size_sets(name, sizes)")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (designsErr) {
      return NextResponse.json({ error: designsErr.message }, { status: 500 });
    }

    // 2. Fetch stock levels aggregated by design_id
    const { data: stockLevels, error: stockErr } = await supabase
      .from("finished_stock")
      .select("design_id, total_quantity, total_value")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    // Aggregate stock by design
    const stockMap: Record<string, { quantity: number; value: number }> = {};
    if (stockLevels) {
      stockLevels.forEach((row) => {
        if (!stockMap[row.design_id]) {
          stockMap[row.design_id] = { quantity: 0, value: 0 };
        }
        stockMap[row.design_id].quantity += row.total_quantity || 0;
        stockMap[row.design_id].value += Number(row.total_value || 0);
      });
    }

    // Map stocks to designs
    const designsWithStock = designs.map((d) => {
      const stock = stockMap[d.id] || { quantity: 0, value: 0 };
      return {
        ...d,
        total_quantity: stock.quantity,
        total_value: stock.value,
      };
    });

    return NextResponse.json({ designs: designsWithStock });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
