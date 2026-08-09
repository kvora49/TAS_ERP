import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Run ground-truth finished stock reconciliation for current net stock
    await reconcileFinishedStock(supabase, businessId);
    // Fetch raw material stock with cost
    const { data: rmStock } = await supabase
      .from("raw_material_current_stock")
      .select(`
        id,
        current_stock,
        unit_cost,
        stock_value,
        material_type:raw_material_types(id, name, unit)
      `)
      .eq("business_id", businessId);

    // Fetch finished goods inventory with cost
    const { data: fgStock } = await supabase
      .from("finished_stock")
      .select(`
        id,
        total_quantity,
        cost_per_piece,
        total_value,
        design:designs(id, name, sale_price)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const rawMaterials = (rmStock || []).map((r: any) => {
      const materialType = Array.isArray(r.material_type) ? r.material_type[0] : r.material_type;
      const qty = Number(r.current_stock || 0);
      const unitCost = Number(r.unit_cost || 0);
      const totalVal = Number(r.stock_value || 0) > 0 ? Number(r.stock_value) : qty * unitCost;
      return {
        id: r.id,
        name: materialType?.name || "Unknown RM",
        unit: materialType?.unit || "Pcs",
        quantity: qty,
        unit_cost: unitCost,
        total_value: totalVal,
        category: "Raw Material",
      };
    });

    const finishedGoods = (fgStock || []).map((p: any) => {
      const design = Array.isArray(p.design) ? p.design[0] : p.design;
      const qty = Number(p.total_quantity || 0);
      const costPerPiece = Number(p.cost_per_piece || 0);
      const salePrice = Number(design?.sale_price || 0);
      const unitCost = costPerPiece > 0 ? costPerPiece : (salePrice > 0 ? Math.round(salePrice * 0.6) : 0);
      const totalVal = Number(p.total_value || 0) > 0 ? Number(p.total_value) : qty * unitCost;

      return {
        id: p.id,
        name: design?.name || "Unknown FG",
        unit: "Pcs",
        quantity: qty,
        unit_cost: unitCost,
        total_value: totalVal,
        category: "Finished Goods",
      };
    });

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
