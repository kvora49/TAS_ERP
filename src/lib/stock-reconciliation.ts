import { SupabaseClient } from "@supabase/supabase-js";

export async function reconcileRawMaterialStock(
  supabase: any,
  businessId: string,
  targetMaterialTypeId?: string
): Promise<{ success: boolean; message: string; updatedCount: number }> {
  if (!businessId) {
    return { success: false, message: "Business ID missing", updatedCount: 0 };
  }

  // 1. Fetch real godowns for this business
  const { data: godowns, error: gError } = await supabase
    .from("godowns")
    .select("id, name")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  if (gError) {
    console.error("[reconcileRawMaterialStock] Error fetching godowns:", gError);
  }

  const defaultGodownId = godowns && godowns.length > 0 ? godowns[0].id : null;

  // 2. Fetch raw material types (all active or specific single material)
  let matQuery = supabase
    .from("raw_material_types")
    .select("id, name, unit, category, reorder_level")
    .eq("business_id", businessId)
    .is("deleted_at", null);

  if (targetMaterialTypeId) {
    matQuery = matQuery.eq("id", targetMaterialTypeId);
  }

  const { data: rawMaterialTypes, error: mError } = await matQuery;

  if (mError || !rawMaterialTypes || rawMaterialTypes.length === 0) {
    return { success: true, message: "No active raw material types found", updatedCount: 0 };
  }

  let updatedCount = 0;

  for (const mat of rawMaterialTypes) {
    // Fetch all parent purchases for this business to ensure complete godown & status mapping
    const { data: rawPurchases } = await supabase
      .from("raw_material_purchases")
      .select("id, godown_id, status")
      .eq("business_id", businessId);
    const purchaseDict = new Map<string, any>((rawPurchases || []).map((p: any) => [p.id, p]));

    // A. Fetch purchase items for this material
    const { data: pItems } = await supabase
      .from("raw_material_purchase_items")
      .select("id, purchase_id, quantity, rate, amount, taxable_value, purchase:raw_material_purchases(id, godown_id, status)")
      .eq("material_type_id", mat.id)
      .eq("business_id", businessId);

    const validPItems = (pItems || []).filter((pi: any) => {
      const p = pi.purchase || purchaseDict.get(pi.purchase_id);
      return p?.status !== "cancelled";
    });
    const pItemIds = validPItems.map((pi: any) => pi.id);

    const pItemGodownMap = new Map<string, { godownId: string; rate: number }>();
    validPItems.forEach((pi: any) => {
      const p = pi.purchase || purchaseDict.get(pi.purchase_id);
      const gId = p?.godown_id || defaultGodownId;
      if (gId) {
        pItemGodownMap.set(pi.id, { godownId: gId, rate: Number(pi.rate || 0) });
      }
    });

    // B. Fetch rolls for purchase items
    let rolls: any[] = [];
    if (pItemIds.length > 0) {
      const { data: rawRolls } = await supabase
        .from("purchase_rolls")
        .select("*")
        .eq("business_id", businessId)
        .in("purchase_item_id", pItemIds);
      // Filter out cancelled rolls if status column exists
      rolls = (rawRolls || []).filter((r: any) => r.status !== "cancelled");
    }

    // Map to accumulate stock per godown
    const godownStockMap = new Map<string, { currentStock: number; totalValue: number; totalCostSum: number; costCount: number }>();

    if (rolls.length > 0) {
      // Roll-based materials: Stock per godown is exact sum of purchase_rolls.remaining_meters
      rolls.forEach((r: any) => {
        const info = pItemGodownMap.get(r.purchase_item_id);
        const gId = info?.godownId || defaultGodownId;
        const rate = info?.rate || 0;
        if (!gId) return;

        const remMeters = Math.max(0, Number(r.remaining_meters || 0));
        const val = remMeters * rate;

        const existing = godownStockMap.get(gId) || { currentStock: 0, totalValue: 0, totalCostSum: 0, costCount: 0 };
        existing.currentStock += remMeters;
        existing.totalValue += val;
        if (rate > 0) {
          existing.totalCostSum += rate;
          existing.costCount += 1;
        }
        godownStockMap.set(gId, existing);
      });
    } else {
      // Non-roll materials: Sum of Purchased Qty
      validPItems.forEach((pi: any) => {
        const p = pi.purchase || purchaseDict.get(pi.purchase_id);
        const gId = p?.godown_id || defaultGodownId;
        const rate = Number(pi.rate || 0);
        const qty = Number(pi.quantity || 0);
        const taxableVal = Number(pi.taxable_value || (qty * rate));
        if (!gId) return;

        const existing = godownStockMap.get(gId) || { currentStock: 0, totalValue: 0, totalCostSum: 0, costCount: 0 };
        existing.currentStock += qty;
        existing.totalValue += taxableVal;
        if (rate > 0) {
          existing.totalCostSum += rate;
          existing.costCount += 1;
        }
        godownStockMap.set(gId, existing);
      });

      // Deduct purchase returns for non-roll materials
      const { data: returnItems } = await supabase
        .from("purchase_return_items")
        .select("id, return_id, returned_qty, rate, taxable_value, purchase_return:purchase_returns(godown_id, purchase_id, status)")
        .eq("material_type_id", mat.id)
        .eq("business_id", businessId);

      const { data: rawReturns } = await supabase
        .from("purchase_returns")
        .select("id, godown_id, purchase_id, status")
        .eq("business_id", businessId);
      const returnDict = new Map<string, any>((rawReturns || []).map((r: any) => [r.id, r]));

      for (const retItem of returnItems || []) {
        const parentRet = retItem.purchase_return || returnDict.get(retItem.return_id);
        if (parentRet?.status === "cancelled") continue;
        let gId = parentRet?.godown_id;
        if (!gId && parentRet?.purchase_id) {
          const parentP = purchaseDict.get(parentRet.purchase_id);
          gId = parentP?.godown_id;
        }
        gId = gId || defaultGodownId;
        if (!gId) continue;

        const retQty = Number(retItem.returned_qty || 0);
        const retRate = Number(retItem.rate || 0);
        const retTaxableVal = Number(retItem.taxable_value || (retQty * retRate));

        const existing = godownStockMap.get(gId) || { currentStock: 0, totalValue: 0, totalCostSum: 0, costCount: 0 };
        existing.currentStock = Math.max(0, existing.currentStock - retQty);
        existing.totalValue = Math.max(0, existing.totalValue - retTaxableVal);
        godownStockMap.set(gId, existing);
      }
    }

    // C. Add/Deduct manual stock adjustments (`raw_material_stock_entries`)
    // (Ignore auto-generated vouchers from purchases/returns to avoid double-counting)
    const { data: stockEntryItems } = await supabase
      .from("raw_material_stock_entry_items")
      .select("id, quantity, rate, amount, stock_entry:raw_material_stock_entries(godown_id, entry_type, reference_type, status)")
      .eq("material_type_id", mat.id)
      .eq("business_id", businessId);

    (stockEntryItems || []).forEach((sei: any) => {
      if (sei.stock_entry?.status === "cancelled") return;
      if (sei.stock_entry?.reference_type === "purchase" || sei.stock_entry?.reference_type === "return") return;
      const gId = sei.stock_entry?.godown_id || defaultGodownId;
      const type = sei.stock_entry?.entry_type;
      const qty = Number(sei.quantity || 0);
      const rate = Number(sei.rate || 0);
      const val = Number(sei.amount || (qty * rate));
      if (!gId) return;

      const existing = godownStockMap.get(gId) || { currentStock: 0, totalValue: 0, totalCostSum: 0, costCount: 0 };
      if (type === "stock_in") {
        existing.currentStock += qty;
        existing.totalValue += val;
      } else if (type === "stock_out" || type === "issue" || type === "damage") {
        existing.currentStock = Math.max(0, existing.currentStock - qty);
        existing.totalValue = Math.max(0, existing.totalValue - val);
      }
      godownStockMap.set(gId, existing);
    });

    if (godownStockMap.size === 0 && defaultGodownId) {
      godownStockMap.set(defaultGodownId, { currentStock: 0, totalValue: 0, totalCostSum: 0, costCount: 0 });
    }

    // D. Synchronize `raw_material_current_stock` table
    for (const [gId, stockData] of Array.from(godownStockMap.entries())) {
      const finalQty = Math.max(0, Number(stockData.currentStock.toFixed(2)));
      const finalValue = Math.max(0, Number(stockData.totalValue.toFixed(2)));
      const avgCost = finalQty > 0
        ? Number((finalValue / finalQty).toFixed(2))
        : (stockData.costCount > 0 ? Number((stockData.totalCostSum / stockData.costCount).toFixed(2)) : 0);

      const { data: existingRows } = await supabase
        .from("raw_material_current_stock")
        .select("id")
        .eq("business_id", businessId)
        .eq("material_type_id", mat.id)
        .eq("godown_id", gId);

      if (existingRows && existingRows.length > 0) {
        const primaryId = existingRows[0].id;
        await supabase
          .from("raw_material_current_stock")
          .update({
            current_stock: finalQty,
            unit_cost: avgCost,
            stock_value: finalValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", primaryId);

        // Delete duplicate records if any exist
        if (existingRows.length > 1) {
          const extraIds = existingRows.slice(1).map((r: any) => r.id);
          await supabase.from("raw_material_current_stock").delete().in("id", extraIds);
        }
      } else {
        await supabase
          .from("raw_material_current_stock")
          .insert({
            business_id: businessId,
            material_type_id: mat.id,
            godown_id: gId,
            current_stock: finalQty,
            unit_cost: avgCost,
            stock_value: finalValue,
          });
      }
      updatedCount++;
    }
  }

  return {
    success: true,
    message: "Ground-truth inventory reconciliation completed successfully",
    updatedCount,
  };
}
