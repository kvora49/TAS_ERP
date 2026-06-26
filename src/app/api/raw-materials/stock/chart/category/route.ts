import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: stock, error } = await supabase
      .from("raw_material_current_stock")
      .select("stock_value, current_stock, material_type:raw_material_types(category)")
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const categoriesMap: Record<string, { value: number; count: number }> = {};

    if (stock) {
      stock.forEach((s) => {
        const materialType = s.material_type as any;
        const cat = (Array.isArray(materialType) ? materialType[0]?.category : materialType?.category) || "Other";
        const val = Number(s.stock_value || 0);
        
        if (!categoriesMap[cat]) {
          categoriesMap[cat] = { value: 0, count: 0 };
        }
        categoriesMap[cat].value += val;
        categoriesMap[cat].count += 1;
      });
    }

    const chartData = Object.keys(categoriesMap).map((cat) => ({
      name: cat.replace("_", " ").toUpperCase(),
      value: Number(categoriesMap[cat].value.toFixed(2)),
      count: categoriesMap[cat].count,
    }));

    return NextResponse.json({ chartData });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
