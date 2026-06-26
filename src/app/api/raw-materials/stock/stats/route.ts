import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch current stock to calculate items, value, low stock, out of stock
    const { data: stock, error: stockErr } = await supabase
      .from("raw_material_current_stock")
      .select("*, material_type:raw_material_types(min_stock_level)")
      .eq("business_id", businessId);

    if (stockErr) {
      return NextResponse.json({ error: stockErr.message }, { status: 500 });
    }

    let totalItems = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const uniqueItemTypes = new Set<string>();

    if (stock) {
      stock.forEach((s) => {
        uniqueItemTypes.add(s.material_type_id);
        const qty = Number(s.current_stock || 0);
        const val = Number(s.stock_value || 0);
        totalValue += val;

        const minLevel = Number(s.material_type?.min_stock_level || 0);
        if (qty <= 0) {
          outOfStockCount++;
        } else if (qty < minLevel) {
          lowStockCount++;
        }
      });
      totalItems = uniqueItemTypes.size;
    }

    // 2. Fetch stock movements this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: movementCount, error: countErr } = await supabase
      .from("raw_material_stock_entries")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .gte("posting_date", startOfMonth.toISOString().split("T")[0]);

    return NextResponse.json({
      stats: {
        totalItems,
        totalValue,
        lowStockCount,
        outOfStockCount,
        movementCount: movementCount || 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
