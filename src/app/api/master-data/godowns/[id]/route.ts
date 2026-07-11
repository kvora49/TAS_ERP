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
    // 1. Fetch godown details
    const { data: godown, error: godownError } = await supabase
      .from("godowns")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (godownError || !godown) {
      return NextResponse.json({ error: "Godown not found" }, { status: 404 });
    }

    // 2. Fetch live stock summary of raw materials in this godown
    const { data: stockItems, error: stockError } = await supabase
      .from("raw_material_current_stock")
      .select(`
        id,
        current_stock,
        stock_value,
        material_type_id
      `)
      .eq("godown_id", id)
      .eq("business_id", businessId)
      .gt("current_stock", 0);

    // Resolve material details for current stock
    let resolvedStock: any[] = [];
    if (stockItems && stockItems.length > 0) {
      const materialIds = stockItems.map((item) => item.material_type_id);
      const { data: rawMaterials } = await supabase
        .from("raw_material_types")
        .select("id, name, category, unit")
        .in("id", materialIds);

      const materialsLookup = (rawMaterials || []).reduce((acc: any, curr) => {
        acc[curr.id] = curr;
        return acc;
      }, {});

      resolvedStock = stockItems.map((item) => ({
        id: item.id,
        current_stock: Number(item.current_stock),
        stock_value: Number(item.stock_value),
        material_type: materialsLookup[item.material_type_id] || {
          name: "Unknown Material",
          category: "Other",
          unit: "Pieces",
        },
      }));
    }

    // 3. Fetch recent 50 movements from stock_ledger for this godown
    const { data: movements, error: movementsError } = await supabase
      .from("stock_ledger")
      .select(`
        id,
        item_type,
        item_id,
        transaction_type,
        quantity_delta,
        value_delta,
        created_at
      `)
      .eq("godown_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    // Resolve item names for movements polymorphic references
    let resolvedMovements: any[] = [];
    if (movements && movements.length > 0) {
      const rawMaterialIds = movements
        .filter((m) => m.item_type === "raw_material")
        .map((m) => m.item_id);

      const finishedGoodIds = movements
        .filter((m) => m.item_type === "finished_good")
        .map((m) => m.item_id);

      // Query raw material details
      let materialsLookup: any = {};
      if (rawMaterialIds.length > 0) {
        const { data: rawMaterials } = await supabase
          .from("raw_material_types")
          .select("id, name, unit")
          .in("id", rawMaterialIds);
        materialsLookup = (rawMaterials || []).reduce((acc: any, curr) => {
          acc[curr.id] = curr;
          return acc;
        }, {});
      }

      // Query finished goods (designs) details
      let designsLookup: any = {};
      if (finishedGoodIds.length > 0) {
        const { data: designs } = await supabase
          .from("designs")
          .select("id, name, code")
          .in("id", finishedGoodIds);
        designsLookup = (designs || []).reduce((acc: any, curr) => {
          acc[curr.id] = curr;
          return acc;
        }, {});
      }

      resolvedMovements = movements.map((m) => {
        let itemName = "Unknown Item";
        let unit = "pcs";

        if (m.item_type === "raw_material") {
          const mat = materialsLookup[m.item_id];
          if (mat) {
            itemName = mat.name;
            unit = mat.unit || "Meters";
          }
        } else if (m.item_type === "finished_good") {
          const des = designsLookup[m.item_id];
          if (des) {
            itemName = des.code ? `${des.code} - ${des.name}` : des.name;
          }
        }

        return {
          id: m.id,
          item_type: m.item_type,
          transaction_type: m.transaction_type,
          quantity_delta: Number(m.quantity_delta),
          value_delta: Number(m.value_delta),
          created_at: m.created_at,
          itemName,
          unit,
        };
      });
    }

    return NextResponse.json({
      godown,
      stock: resolvedStock,
      movements: resolvedMovements,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
