import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/production/lots/available-accessories
 * Returns accessory purchase items that have available stock.
 * Only returns items with item_type = 'accessory' and current_stock > 0.
 * Used by Step 1 of the Create Production Lot wizard.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  try {
    // 1. Fetch accessory purchase items with stock > 0
    //    Join to purchase → supplier, and resolve godown from current stock
    let query = supabase
      .from("raw_material_purchase_items")
      .select(`
        id,
        item_type,
        other_item_name,
        material_type_id,
        unit,
        rate,
        quantity,
        purchase:raw_material_purchases!inner (
          id,
          godown_id,
          supplier:parties (id, name, company_name)
        ),
        material_type:raw_material_types (id, name, unit)
      `)
      .eq("item_type", "accessory")
      .eq("purchase.business_id", businessId);

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ accessories: [] });
    }

    // 2. Gather unique material_type_ids and godown_ids to check current stock
    const matTypeIds = Array.from(new Set(items.map((i: any) => i.material_type_id).filter(Boolean)));
    const godownIds = Array.from(new Set(
      items.map((i: any) => i.purchase?.godown_id).filter(Boolean)
    ));

    // 3. Fetch current stock for these materials
    const { data: stockEntries } = matTypeIds.length > 0
      ? await supabase
          .from("raw_material_current_stock")
          .select("material_type_id, godown_id, current_stock, unit_cost")
          .eq("business_id", businessId)
          .in("material_type_id", matTypeIds)
          .gt("current_stock", 0)
      : { data: [] };

    // 4. Build a map: material_type_id+godown_id → stock info
    const stockMap = new Map<string, { current_stock: number; unit_cost: number }>();
    (stockEntries || []).forEach((s: any) => {
      const key = `${s.material_type_id}__${s.godown_id}`;
      stockMap.set(key, { current_stock: Number(s.current_stock), unit_cost: Number(s.unit_cost) });
    });

    // 5. Fetch godown details
    const { data: godownsList } = godownIds.length > 0
      ? await supabase.from("godowns").select("id, name").in("id", godownIds)
      : { data: [] };
    const godownsMap = new Map((godownsList || []).map((g: any) => [g.id, g.name]));

    // 6. Build response — filter to only items with available stock
    const accessories: any[] = [];
    for (const item of items as any[]) {
      const matTypeId = item.material_type_id;
      const godownId = item.purchase?.godown_id;

      if (!matTypeId || !godownId) continue;

      const stockKey = `${matTypeId}__${godownId}`;
      const stock = stockMap.get(stockKey);
      if (!stock || stock.current_stock <= 0) continue;

      const itemName = item.other_item_name
        || item.material_type?.name
        || "Unnamed Accessory";

      const unit = item.unit || item.material_type?.unit || "Pcs";
      const rate = Number(item.rate || stock.unit_cost || 0);
      const supplier = item.purchase?.supplier;
      const supplierName = supplier?.company_name || supplier?.name || "—";
      const godownName = godownsMap.get(godownId) || "Main Godown";

      // Apply search filter
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const matchName = itemName.toLowerCase().includes(term);
        const matchSupplier = supplierName.toLowerCase().includes(term);
        const matchGodown = godownName.toLowerCase().includes(term);
        const matchUnit = unit.toLowerCase().includes(term);
        if (!matchName && !matchSupplier && !matchGodown && !matchUnit) continue;
      }

      accessories.push({
        id: item.id,
        item_name: itemName,
        unit,
        godown_id: godownId,
        godown_name: godownName,
        supplier_name: supplierName,
        available_qty: stock.current_stock,
        unit_rate: rate,
        material_type_id: matTypeId,
        purchase_id: item.purchase?.id,
      });
    }

    return NextResponse.json({ accessories });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
