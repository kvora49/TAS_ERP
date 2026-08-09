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
      .select("design_id, total_quantity, cost_per_piece, total_value")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    // Aggregate stock by design
    const stockMap: Record<string, { quantity: number; value: number }> = {};
    if (stockLevels) {
      stockLevels.forEach((row) => {
        if (!stockMap[row.design_id]) {
          stockMap[row.design_id] = { quantity: 0, value: 0 };
        }
        const qty = row.total_quantity || 0;
        const val = row.total_value ? Number(row.total_value) : (qty * Number(row.cost_per_piece || 0));
        stockMap[row.design_id].quantity += qty;
        stockMap[row.design_id].value += val;
      });
    }

    // 3. Fetch active BOM costings for fallback calculations
    const { data: designCostings } = await supabase
      .from("design_costings")
      .select("design_id, total_cost_per_piece")
      .eq("business_id", businessId)
      .eq("is_active", true);

    const bomCostMap = new Map<string, number>();
    (designCostings || []).forEach((c: any) => {
      if (c.total_cost_per_piece && Number(c.total_cost_per_piece) > 0) {
        bomCostMap.set(c.design_id, Number(c.total_cost_per_piece));
      }
    });

    // Map stocks to designs
    const designsWithStock = designs.map((d) => {
      const stock = stockMap[d.id] || { quantity: 0, value: 0 };
      const salePrice = Number(d.sale_price || 0);
      const bomCost = bomCostMap.get(d.id) || 0;
      const estUnitCost = bomCost > 0 ? bomCost : (salePrice > 0 ? Math.round(salePrice * 0.6) : 150);

      const computedValue = stock.value > 0
        ? stock.value
        : (stock.quantity > 0 ? Math.round(stock.quantity * estUnitCost) : 0);

      return {
        ...d,
        total_quantity: stock.quantity,
        total_value: computedValue,
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
