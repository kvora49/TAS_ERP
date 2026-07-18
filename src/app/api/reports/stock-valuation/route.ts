import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch raw material stock with cost
    const { data: rmStock } = await supabase
      .from("raw_materials")
      .select("id, name, unit, current_stock, purchase_price")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    // Fetch finished goods inventory with cost
    const { data: fgStock } = await supabase
      .from("products")
      .select("id, name, unit, current_stock, cost_price")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const rawMaterials = (rmStock || []).map((r: any) => ({
      id: r.id, name: r.name, unit: r.unit,
      quantity: Number(r.current_stock || 0),
      unit_cost: Number(r.purchase_price || 0),
      total_value: Number(r.current_stock || 0) * Number(r.purchase_price || 0),
      category: "Raw Material",
    }));

    const finishedGoods = (fgStock || []).map((p: any) => ({
      id: p.id, name: p.name, unit: p.unit,
      quantity: Number(p.current_stock || 0),
      unit_cost: Number(p.cost_price || 0),
      total_value: Number(p.current_stock || 0) * Number(p.cost_price || 0),
      category: "Finished Goods",
    }));

    const items = [...rawMaterials, ...finishedGoods];
    const totalValue = items.reduce((s, i) => s + i.total_value, 0);
    const totalRMValue = rawMaterials.reduce((s, i) => s + i.total_value, 0);
    const totalFGValue = finishedGoods.reduce((s, i) => s + i.total_value, 0);

    return NextResponse.json({
      items, totalValue, totalRMValue, totalFGValue,
      asOf: new Date().toISOString().split("T")[0],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
