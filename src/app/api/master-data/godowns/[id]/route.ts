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
    // 1. Parallelize initial queries
    const [godownRes, stockItemsRes, movementsRes, finishedStockItemsRes] = await Promise.all([
      supabase
        .from("godowns")
        .select("*")
        .eq("id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("raw_material_current_stock")
        .select(`
          id,
          current_stock,
          stock_value,
          material_type_id
        `)
        .eq("godown_id", id)
        .eq("business_id", businessId)
        .gt("current_stock", 0),
      supabase
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
        .limit(500),
      supabase
        .from("finished_stock")
        .select(`
          id,
          total_quantity,
          cost_per_piece,
          total_value,
          size_quantities,
          design:designs(id, name, code:design_number, sale_price),
          colour:design_colours(id, colour_name)
        `)
        .eq("godown_id", id)
        .eq("business_id", businessId)
        .gt("total_quantity", 0),
    ]);

    const godown = godownRes.data;
    if (godownRes.error || !godown) {
      return NextResponse.json({ error: "Godown not found" }, { status: 404 });
    }

    const stockItems = stockItemsRes.data || [];
    const movements = movementsRes.data || [];
    const finishedStockItems = finishedStockItemsRes.data || [];

    // 2. Resolve polymorphic references for raw material stock
    const materialIds = stockItems.map((item) => item.material_type_id);
    const rawMaterialIds = movements
      .filter((m) => m.item_type === "raw_material")
      .map((m) => m.item_id);
    const allMaterialIds = Array.from(new Set([...materialIds, ...rawMaterialIds]));

    const finishedGoodIds = Array.from(
      new Set(
        movements
          .filter((m) => m.item_type === "finished_good")
          .map((m) => m.item_id)
      )
    );

    const [materialsRes, designsRes] = await Promise.all([
      allMaterialIds.length > 0
        ? supabase
            .from("raw_material_types")
            .select("id, name, category, unit")
            .in("id", allMaterialIds)
        : Promise.resolve({ data: [] }),
      finishedGoodIds.length > 0
        ? supabase
            .from("designs")
            .select("id, name, code:design_number")
            .in("id", finishedGoodIds)
        : Promise.resolve({ data: [] }),
    ]);

    const materialsLookup = (materialsRes.data || []).reduce((acc: any, curr: any) => {
      acc[curr.id] = curr;
      return acc;
    }, {});

    const designsLookup = (designsRes.data || []).reduce((acc: any, curr: any) => {
      acc[curr.id] = curr;
      return acc;
    }, {});

    // Resolve stock
    const resolvedStock = stockItems.map((item) => ({
      id: item.id,
      current_stock: Number(item.current_stock),
      stock_value: Number(item.stock_value),
      material_type: materialsLookup[item.material_type_id] || {
        name: "Unknown Material",
        category: "Other",
        unit: "Pieces",
      },
    }));

    // Resolve movements
    const resolvedMovements = movements.map((m) => {
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

    // Resolve finished stock
    const resolvedFinishedStock = finishedStockItems.map((item: any) => {
      const qty = Number(item.total_quantity || 0);
      const costPerPiece = Number(item.cost_per_piece || 0);
      const salePrice = Number(item.design?.sale_price || 0);
      const unitCost = costPerPiece > 0 ? costPerPiece : (salePrice > 0 ? Math.round(salePrice * 0.6) : 0);
      const totalVal = Number(item.total_value || 0) > 0 ? Number(item.total_value) : (qty * unitCost);
      return {
        ...item,
        cost_per_piece: unitCost,
        total_value: totalVal,
      };
    });

    return NextResponse.json({
      godown,
      stock: resolvedStock,
      movements: resolvedMovements,
      finishedStock: resolvedFinishedStock,
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

export async function PUT(
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
    const body = await request.json();
    const { name, code, address, contact_person, phone, description, is_primary, is_active } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Godown Name is required" },
        { status: 400 }
      );
    }

    const finalCode = (code && code.trim().length > 0)
      ? code.trim().toUpperCase()
      : `GDN-${name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) || "001"}`;

    if (is_primary) {
      await supabase
        .from("godowns")
        .update({ is_primary: false })
        .eq("business_id", businessId);
    }

    const { data: godown, error } = await supabase
      .from("godowns")
      .update({
        name,
        code: finalCode,
        address: address || null,
        contact_person: contact_person || null,
        phone: phone || null,
        description: description || null,
        is_primary: !!is_primary,
        is_active: is_active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ godown });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

