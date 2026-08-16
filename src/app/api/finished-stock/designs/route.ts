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

    // 2. Fetch Grade A stock levels from finished_stock
    const { data: stockLevels, error: stockErr } = await supabase
      .from("finished_stock")
      .select("design_id, total_quantity, cost_per_piece, total_value")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (stockErr) {
      return NextResponse.json({ error: stockErr.message }, { status: 500 });
    }

    // 3. Fetch B-Grade stock levels from b_grade_stock (BUG 9 FIX)
    const { data: bGradeLevels, error: bgErr } = await supabase
      .from("b_grade_stock")
      .select("design_id, total_quantity, cost_per_piece, total_value")
      .eq("business_id", businessId)
      .eq("status", "available")
      .is("deleted_at", null);

    // Aggregate Grade A stock by design
    const stockMap: Record<string, { grade_a_quantity: number; grade_a_value: number }> = {};
    if (stockLevels) {
      stockLevels.forEach((row) => {
        if (!stockMap[row.design_id]) {
          stockMap[row.design_id] = { grade_a_quantity: 0, grade_a_value: 0 };
        }
        const qty = row.total_quantity || 0;
        const val = row.total_value ? Number(row.total_value) : (qty * Number(row.cost_per_piece || 0));
        stockMap[row.design_id].grade_a_quantity += qty;
        stockMap[row.design_id].grade_a_value += val;
      });
    }

    // Aggregate Grade B stock by design
    const bGradeMap: Record<string, { grade_b_quantity: number; grade_b_value: number }> = {};
    if (bGradeLevels) {
      bGradeLevels.forEach((row) => {
        if (!bGradeMap[row.design_id]) {
          bGradeMap[row.design_id] = { grade_b_quantity: 0, grade_b_value: 0 };
        }
        const qty = row.total_quantity || 0;
        const val = row.total_value ? Number(row.total_value) : (qty * Number(row.cost_per_piece || 0));
        bGradeMap[row.design_id].grade_b_quantity += qty;
        bGradeMap[row.design_id].grade_b_value += val;
      });
    }

    // 4. Fetch active BOM costings for fallback calculations
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

    // Map stocks to designs with distinct Grade A and Grade B splits
    const designsWithStock = designs.map((d) => {
      const aStock = stockMap[d.id] || { grade_a_quantity: 0, grade_a_value: 0 };
      const bStock = bGradeMap[d.id] || { grade_b_quantity: 0, grade_b_value: 0 };
      const salePrice = Number(d.sale_price || 0);
      const bomCost = bomCostMap.get(d.id) || 0;
      const estUnitCost = bomCost > 0 ? bomCost : (salePrice > 0 ? Math.round(salePrice * 0.6) : 150);

      const totalQty = aStock.grade_a_quantity + bStock.grade_b_quantity;
      const computedValue = (aStock.grade_a_value + bStock.grade_b_value) > 0
        ? (aStock.grade_a_value + bStock.grade_b_value)
        : (totalQty > 0 ? Math.round(totalQty * estUnitCost) : 0);

      return {
        ...d,
        grade_a_quantity: aStock.grade_a_quantity,
        grade_b_quantity: bStock.grade_b_quantity,
        total_quantity: totalQty,
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
