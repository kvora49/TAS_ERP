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

    // 4. Fetch finished stock in this godown
    const { data: finishedStockItems } = await supabase
      .from("finished_stock")
      .select(`
        id,
        total_quantity,
        cost_per_piece,
        total_value,
        size_quantities,
        design:designs(id, name, code:design_number),
        colour:design_colours(id, colour_name)
      `)
      .eq("godown_id", id)
      .eq("business_id", businessId)
      .gt("total_quantity", 0);

    return NextResponse.json({
      godown,
      stock: resolvedStock,
      movements: resolvedMovements,
      finishedStock: finishedStockItems || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetGodownId = searchParams.get("target_godown_id");

    // 1. Fetch godown
    const { data: godown, error: godownError } = await supabase
      .from("godowns")
      .select("id, name")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (godownError || !godown) {
      return NextResponse.json({ error: "Godown not found" }, { status: 404 });
    }

    // 2. Fetch raw material current stock in this godown
    const { data: rawStockItems } = await supabase
      .from("raw_material_current_stock")
      .select("id, material_type_id, current_stock, stock_value")
      .eq("godown_id", id)
      .eq("business_id", businessId)
      .gt("current_stock", 0);

    // 3. Fetch finished stock in this godown
    const { data: finishedStockItems } = await supabase
      .from("finished_stock")
      .select("id, design_id, colour_id, total_quantity, cost_per_piece, total_value, size_quantities")
      .eq("godown_id", id)
      .eq("business_id", businessId)
      .gt("total_quantity", 0);

    const totalRawQty = (rawStockItems || []).reduce((acc, curr) => acc + Number(curr.current_stock || 0), 0);
    const totalFinishedQty = (finishedStockItems || []).reduce((acc, curr) => acc + Number(curr.total_quantity || 0), 0);
    const totalStockQty = totalRawQty + totalFinishedQty;
    const hasStock = totalStockQty > 0 || (rawStockItems && rawStockItems.length > 0) || (finishedStockItems && finishedStockItems.length > 0);

    // ACTION: Check stock status
    if (action === "check") {
      return NextResponse.json({
        hasStock,
        rawStockCount: rawStockItems?.length || 0,
        finishedStockCount: finishedStockItems?.length || 0,
        totalQuantity: totalStockQty,
      });
    }

    // ACTION: Transfer stock to target godown
    if (action === "transfer") {
      if (!targetGodownId) {
        return NextResponse.json({ error: "Target godown is required for transfer" }, { status: 400 });
      }

      if (targetGodownId === id) {
        return NextResponse.json({ error: "Target godown must be different from source godown" }, { status: 400 });
      }

      const { data: targetGodown } = await supabase
        .from("godowns")
        .select("id, name")
        .eq("id", targetGodownId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetGodown) {
        return NextResponse.json({ error: "Target godown not found" }, { status: 404 });
      }

      // Transfer raw material stock
      if (rawStockItems && rawStockItems.length > 0) {
        for (const item of rawStockItems) {
          // Log ledger entries for transfer out & transfer in
          await supabase.from("stock_ledger").insert([
            {
              business_id: businessId,
              item_type: "raw_material",
              item_id: item.material_type_id,
              godown_id: id,
              transaction_type: "transfer_out",
              quantity_delta: -Number(item.current_stock),
              value_delta: -Number(item.stock_value),
              reference_table: "godowns",
              reference_id: targetGodownId,
            },
            {
              business_id: businessId,
              item_type: "raw_material",
              item_id: item.material_type_id,
              godown_id: targetGodownId,
              transaction_type: "transfer_in",
              quantity_delta: Number(item.current_stock),
              value_delta: Number(item.stock_value),
              reference_table: "godowns",
              reference_id: id,
            },
          ]);

          // Move current stock record to target godown (upsert logic if exists)
          const { data: existingTargetStock } = await supabase
            .from("raw_material_current_stock")
            .select("id, current_stock, stock_value")
            .eq("godown_id", targetGodownId)
            .eq("material_type_id", item.material_type_id)
            .eq("business_id", businessId)
            .single();

          if (existingTargetStock) {
            await supabase
              .from("raw_material_current_stock")
              .update({
                current_stock: Number(existingTargetStock.current_stock) + Number(item.current_stock),
                stock_value: Number(existingTargetStock.stock_value) + Number(item.stock_value),
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingTargetStock.id);

            await supabase
              .from("raw_material_current_stock")
              .update({ current_stock: 0, stock_value: 0, updated_at: new Date().toISOString() })
              .eq("id", item.id);
          } else {
            await supabase
              .from("raw_material_current_stock")
              .update({ godown_id: targetGodownId, updated_at: new Date().toISOString() })
              .eq("id", item.id);
          }
        }
      }

      // Transfer finished stock
      if (finishedStockItems && finishedStockItems.length > 0) {
        for (const item of finishedStockItems) {
          // Log ledger entries for transfer out & transfer in
          await supabase.from("stock_ledger").insert([
            {
              business_id: businessId,
              item_type: "finished_good",
              item_id: item.design_id,
              godown_id: id,
              transaction_type: "transfer_out",
              quantity_delta: -Number(item.total_quantity),
              value_delta: -Number(item.total_value),
              reference_table: "godowns",
              reference_id: targetGodownId,
            },
            {
              business_id: businessId,
              item_type: "finished_good",
              item_id: item.design_id,
              godown_id: targetGodownId,
              transaction_type: "transfer_in",
              quantity_delta: Number(item.total_quantity),
              value_delta: Number(item.total_value),
              reference_table: "godowns",
              reference_id: id,
            },
          ]);

          // Re-assign finished_stock godown_id
          await supabase
            .from("finished_stock")
            .update({ godown_id: targetGodownId, updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      }

      // Re-assign default godowns in settings / parties if applicable
      await supabase
        .from("inventory_settings")
        .update({ default_godown_id: targetGodownId })
        .eq("default_godown_id", id)
        .eq("business_id", businessId);

      await supabase
        .from("production_settings")
        .update({ default_godown_id: targetGodownId })
        .eq("default_godown_id", id)
        .eq("business_id", businessId);

      await supabase
        .from("parties")
        .update({ default_godown_id: targetGodownId })
        .eq("default_godown_id", id)
        .eq("business_id", businessId);

      // Soft-delete source godown
      const { error: deleteErr } = await supabase
        .from("godowns")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Godown '${godown.name}' deleted. Transferred stock to '${targetGodown.name}'.`,
      });
    }

    // ACTION: Force delete (Write-off active stock)
    if (action === "force") {
      // 1. Write-off raw material stock
      if (rawStockItems && rawStockItems.length > 0) {
        for (const item of rawStockItems) {
          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "raw_material",
            item_id: item.material_type_id,
            godown_id: id,
            transaction_type: "godown_deletion_writeoff",
            quantity_delta: -Number(item.current_stock),
            value_delta: -Number(item.stock_value),
            reference_table: "godowns",
            reference_id: id,
          });

          await supabase
            .from("raw_material_current_stock")
            .update({ current_stock: 0, stock_value: 0, updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      }

      // 2. Write-off finished stock
      if (finishedStockItems && finishedStockItems.length > 0) {
        for (const item of finishedStockItems) {
          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "finished_good",
            item_id: item.design_id,
            godown_id: id,
            transaction_type: "godown_deletion_writeoff",
            quantity_delta: -Number(item.total_quantity),
            value_delta: -Number(item.total_value),
            reference_table: "godowns",
            reference_id: id,
          });

          await supabase
            .from("finished_stock")
            .update({ total_quantity: 0, total_value: 0, updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      }

      // 3. Soft-delete godown
      const { error: deleteErr } = await supabase
        .from("godowns")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Godown '${godown.name}' deleted. Active stock written off. Historical transaction records preserved.`,
      });
    }

    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
