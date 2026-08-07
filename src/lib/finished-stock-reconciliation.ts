import { SupabaseClient } from "@supabase/supabase-js";

interface FinishedStockAcc {
  godownId: string;
  designId: string;
  colourId: string | null;
  sizeQuantities: Record<string, number>;
  totalQuantity: number;
  totalValue: number;
  costPerPiece: number;
}

export async function reconcileFinishedStock(
  supabase: any,
  businessId: string,
  targetDesignId?: string
): Promise<{ success: boolean; message: string; updatedCount: number }> {
  if (!businessId) {
    return { success: false, message: "Business ID missing", updatedCount: 0 };
  }

  try {
    // 1. Fetch active godowns for business
    const { data: godowns } = await supabase
      .from("godowns")
      .select("id, name")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const defaultGodownId = godowns && godowns.length > 0 ? godowns[0].id : null;

    // 2. Fetch active/completed production lots with size quantities
    let lotQuery = supabase
      .from("production_lots")
      .select("id, design_id, colour_id, status, accessory_cost, other_cost, lot_size_quantities(*)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .neq("status", "cancelled");

    if (targetDesignId) {
      lotQuery = lotQuery.eq("design_id", targetDesignId);
    }
    const { data: productionLots, error: lotErr } = await lotQuery;
    if (lotErr) {
      console.error("[reconcileFinishedStock] Production lots query error:", lotErr);
    }

    // 3. Fetch finished goods purchases
    let fgPurchaseQuery = supabase
      .from("raw_material_purchase_items")
      .select("id, purchase_id, design_id, colour_id, size_quantities, quantity, rate, amount, taxable_value, item_type, purchase:raw_material_purchases(godown_id, status)")
      .eq("business_id", businessId)
      .eq("item_type", "finished_goods");

    if (targetDesignId) {
      fgPurchaseQuery = fgPurchaseQuery.eq("design_id", targetDesignId);
    }
    const { data: fgPurchases, error: fgErr } = await fgPurchaseQuery;
    if (fgErr) {
      console.error("[reconcileFinishedStock] FG purchases query error:", fgErr);
    }

    // 4. Fetch finished goods purchase returns
    let fgReturnQuery = supabase
      .from("purchase_return_items")
      .select("id, return_id, design_id, colour_id, size_quantities, returned_qty, rate, taxable_value, item_type, purchase_return:purchase_returns(godown_id, purchase_id, status)")
      .eq("business_id", businessId)
      .eq("item_type", "finished_goods");

    if (targetDesignId) {
      fgReturnQuery = fgReturnQuery.eq("design_id", targetDesignId);
    }
    const { data: fgReturns, error: fgrErr } = await fgReturnQuery;
    if (fgrErr) {
      console.error("[reconcileFinishedStock] FG returns query error:", fgrErr);
    }

    // 5. Fetch active sale bill items (correct table: sale_bill_items & sale_bills)
    let salesBillQuery = supabase
      .from("sale_bill_items")
      .select("id, bill_id, design_id, colour_id, size, size_quantities, quantity, rate, amount, bill:sale_bills(status, deleted_at)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      salesBillQuery = salesBillQuery.eq("design_id", targetDesignId);
    }
    const { data: salesBills, error: sbErr } = await salesBillQuery;
    if (sbErr) {
      console.error("[reconcileFinishedStock] Sale bills query error:", sbErr);
    }

    // 6. Fetch active sale return items (correct table: sale_return_items & sale_returns)
    let salesReturnQuery = supabase
      .from("sale_return_items")
      .select("id, return_id, design_id, colour_id, size, size_quantities, returned_qty, quantity, rate, amount, sales_return:sale_returns(status)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      salesReturnQuery = salesReturnQuery.eq("design_id", targetDesignId);
    }
    const { data: salesReturns, error: srErr } = await salesReturnQuery;
    if (srErr) {
      console.error("[reconcileFinishedStock] Sale returns query error:", srErr);
    }

    // 7. Fetch stock adjustments
    let adjustmentQuery = supabase
      .from("stock_adjustments")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (targetDesignId) {
      adjustmentQuery = adjustmentQuery.eq("design_id", targetDesignId);
    }
    const { data: adjustments, error: adjErr } = await adjustmentQuery;
    if (adjErr) {
      console.error("[reconcileFinishedStock] Stock adjustments query error:", adjErr);
    }

    // Build key map: `${godown_id}:${design_id}:${colour_id || 'null'}`
    const stockMap = new Map<string, FinishedStockAcc>();
    const getKey = (gId: string, dId: string, cId: string | null) => `${gId}:${dId}:${cId || "null"}`;

    const getOrCreate = (gId: string, dId: string, cId: string | null, rate: number = 0): FinishedStockAcc => {
      const key = getKey(gId, dId, cId);
      const found = stockMap.get(key);
      if (found) return found;
      const created: FinishedStockAcc = {
        godownId: gId,
        designId: dId,
        colourId: cId,
        sizeQuantities: {},
        totalQuantity: 0,
        totalValue: 0,
        costPerPiece: rate,
      };
      stockMap.set(key, created);
      return created;
    };

    // A. Seed from Production Lots (+)
    (productionLots || []).forEach((lot: any) => {
      if (lot.status === "cancelled") return;
      const gId = defaultGodownId;
      const dId = lot.design_id;
      if (!gId || !dId) return;

      const sizeRows = lot.lot_size_quantities || [];
      if (sizeRows.length === 0) return;

      // Group lot sizes by colour_id
      const colMap = new Map<string | null, any[]>();
      sizeRows.forEach((sr: any) => {
        const cId = sr.colour_id || lot.colour_id || null;
        if (!colMap.has(cId)) colMap.set(cId, []);
        colMap.get(cId)!.push(sr);
      });

      colMap.forEach((sizes, cId) => {
        const existing = getOrCreate(gId, dId, cId);
        sizes.forEach((sr) => {
          const sz = sr.size;
          const q = Number(sr.quantity || 0);
          if (q > 0) {
            existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + q;
            existing.totalQuantity += q;
          }
        });
      });
    });

    // B. Add FG Purchases (+)
    (fgPurchases || []).forEach((item: any) => {
      if (item.purchase?.status === "cancelled") return;
      const gId = item.purchase?.godown_id || defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
      const sq = item.size_quantities || {};
      Object.entries(sq).forEach(([sz, q]) => {
        const numQ = Number(q || 0);
        existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + numQ;
      });
      const qty = Number(item.quantity || 0);
      const val = Number(item.taxable_value || (qty * Number(item.rate || 0)));
      existing.totalQuantity += qty;
      existing.totalValue += val;
    });

    // C. Add/Deduct Stock Adjustments (+/-)
    (adjustments || []).forEach((adj: any) => {
      const gId = adj.godown_id || defaultGodownId;
      const dId = adj.design_id;
      const cId = adj.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(adj.unit_cost || 0));
      const sz = adj.size;
      const change = Number(adj.quantity_change || 0);

      if (sz && sz !== "all" && sz !== "—") {
        existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) + change);
      }
      existing.totalQuantity = Math.max(0, existing.totalQuantity + change);
      existing.totalValue = Math.max(0, existing.totalValue + Number(adj.value_impact || 0));
    });

    // D. Deduct FG Purchase Returns (-)
    (fgReturns || []).forEach((item: any) => {
      if (item.purchase_return?.status === "cancelled") return;
      const gId = item.purchase_return?.godown_id || defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
      const sq = item.size_quantities || {};
      Object.entries(sq).forEach(([sz, q]) => {
        const numQ = Math.abs(Number(q || 0));
        existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - numQ);
      });
      const qty = Math.abs(Number(item.returned_qty || 0));
      existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
    });

    // E. Deduct Active Sales Bills (-)
    (salesBills || []).forEach((item: any) => {
      if (item.bill?.status === "cancelled" || item.bill?.deleted_at) return;
      const gId = defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
      const qty = Math.abs(Number(item.quantity || 0));

      const sz = item.size;
      if (sz && sz !== "all" && sz !== "—") {
        existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - qty);
      } else if (item.size_quantities && typeof item.size_quantities === "object") {
        Object.entries(item.size_quantities).forEach(([sKey, q]) => {
          const numQ = Math.abs(Number(q || 0));
          existing.sizeQuantities[sKey] = Math.max(0, (existing.sizeQuantities[sKey] || 0) - numQ);
        });
      }
      existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
    });

    // F. Add Active Sales Returns (+)
    (salesReturns || []).forEach((item: any) => {
      if (item.sales_return?.status === "cancelled") return;
      const gId = defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));
      const qty = Math.abs(Number(item.returned_qty || item.quantity || 0));

      const sz = item.size;
      if (sz && sz !== "all" && sz !== "—") {
        existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + qty;
      } else if (item.size_quantities && typeof item.size_quantities === "object") {
        Object.entries(item.size_quantities).forEach(([sKey, q]) => {
          const numQ = Math.abs(Number(q || 0));
          existing.sizeQuantities[sKey] = (existing.sizeQuantities[sKey] || 0) + numQ;
        });
      }
      existing.totalQuantity += qty;
    });

    // 8. Clear ALL existing finished_stock rows for target design (or all) to remove duplicates & stale mutated entries
    let deleteStockQuery = supabase
      .from("finished_stock")
      .delete()
      .eq("business_id", businessId);

    if (targetDesignId) {
      deleteStockQuery = deleteStockQuery.eq("design_id", targetDesignId);
    }
    await deleteStockQuery;

    // 9. Insert fresh single ground-truth consolidated rows
    let updatedCount = 0;
    const entriesArray = Array.from(stockMap.entries());

    for (const [_, stockData] of entriesArray) {
      if (stockData.totalQuantity <= 0 && stockData.totalValue <= 0) {
        continue;
      }
      await supabase
        .from("finished_stock")
        .insert({
          business_id: businessId,
          design_id: stockData.designId,
          colour_id: stockData.colourId,
          godown_id: stockData.godownId,
          entry_type: "manual",
          size_quantities: stockData.sizeQuantities,
          total_quantity: Math.max(0, Math.round(stockData.totalQuantity)),
          cost_per_piece: stockData.costPerPiece,
          total_value: Math.max(0, stockData.totalValue),
        });
      updatedCount++;
    }

    return {
      success: true,
      message: `Successfully reconciled ground-truth finished stock`,
      updatedCount,
    };
  } catch (err: any) {
    console.error("[reconcileFinishedStock] ERROR:", err);
    return {
      success: false,
      message: err.message || "Failed to reconcile finished stock",
      updatedCount: 0,
    };
  }
}
