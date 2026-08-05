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

    // 1b. Delete all auto-generated reconciliation rows so we start clean.
    // We delete ALL 'manual' entry_type rows since reconciliation owns them.
    // Production/adjustment/transfer rows are preserved (real ledger entries).
    {
      let deleteManualQuery = supabase
        .from("finished_stock")
        .delete()
        .eq("business_id", businessId)
        .eq("entry_type", "manual");

      if (targetDesignId) {
        deleteManualQuery = deleteManualQuery.eq("design_id", targetDesignId);
      }
      const { error: delErr } = await deleteManualQuery;
      if (delErr) {
        console.error("[reconcileFinishedStock] Error deleting manual rows:", delErr);
      }
    }

    // 2. Fetch raw material purchases (finished goods items)
    let fgPurchaseQuery = supabase
      .from("raw_material_purchase_items")
      .select("id, purchase_id, design_id, colour_id, size_quantities, quantity, rate, amount, taxable_value, item_type, purchase:raw_material_purchases(godown_id, status)")
      .eq("business_id", businessId)
      .eq("item_type", "finished_goods");

    if (targetDesignId) {
      fgPurchaseQuery = fgPurchaseQuery.eq("design_id", targetDesignId);
    }

    const { data: fgPurchases } = await fgPurchaseQuery;

    // 3. Fetch finished goods purchase returns
    let fgReturnQuery = supabase
      .from("purchase_return_items")
      .select("id, return_id, design_id, colour_id, size_quantities, returned_qty, rate, taxable_value, item_type, purchase_return:purchase_returns(godown_id, purchase_id, status)")
      .eq("business_id", businessId)
      .eq("item_type", "finished_goods");

    if (targetDesignId) {
      fgReturnQuery = fgReturnQuery.eq("design_id", targetDesignId);
    }

    const { data: fgReturns } = await fgReturnQuery;

    // 4. Fetch sales bills
    let salesBillQuery = supabase
      .from("sales_bill_items")
      .select("id, bill_id, design_id, colour_id, size_quantities, quantity, rate, amount, bill:sales_bills(godown_id, status)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      salesBillQuery = salesBillQuery.eq("design_id", targetDesignId);
    }

    const { data: salesBills } = await salesBillQuery;

    // 5. Fetch sales returns
    let salesReturnQuery = supabase
      .from("sales_return_items")
      .select("id, return_id, design_id, colour_id, size_quantities, returned_qty, quantity, rate, amount, sales_return:sales_returns(godown_id, status)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      salesReturnQuery = salesReturnQuery.eq("design_id", targetDesignId);
    }

    const { data: salesReturns } = await salesReturnQuery;

    // 6. Fetch existing manual/production entries from finished_stock
    let existingStockQuery = supabase
      .from("finished_stock")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (targetDesignId) {
      existingStockQuery = existingStockQuery.eq("design_id", targetDesignId);
    }

    const { data: existingStocks } = await existingStockQuery;

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

    // A. Seed from production & true manual entries in finished_stock
    // (auto-generated rows were already deleted above, so all remaining rows are real)
    (existingStocks || []).forEach((row: any) => {
      const gId = row.godown_id || defaultGodownId;
      const dId = row.design_id;
      const cId = row.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(row.cost_per_piece || 0));

      const sq = row.size_quantities || {};
      Object.entries(sq).forEach(([sz, q]) => {
        const numQ = Number(q || 0);
        existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + numQ;
      });

      const qty = Number(row.total_quantity || 0);
      const val = Number(row.total_value || (qty * Number(row.cost_per_piece || 0)));
      existing.totalQuantity += qty;
      existing.totalValue += val;
      if (existing.costPerPiece === 0 && Number(row.cost_per_piece || 0) > 0) {
        existing.costPerPiece = Number(row.cost_per_piece);
      }
    });

    // B. Add Finished Goods Purchases (+)
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
      if (existing.costPerPiece === 0 && Number(item.rate || 0) > 0) {
        existing.costPerPiece = Number(item.rate);
      }
    });

    // C. Deduct Finished Goods Purchase Returns (-)
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
      const val = Math.abs(Number(item.taxable_value || (qty * Number(item.rate || 0))));
      existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
      existing.totalValue = Math.max(0, existing.totalValue - val);
    });

    // D. Deduct Sales Bills (-)
    (salesBills || []).forEach((item: any) => {
      if (item.bill?.status === "cancelled") return;
      const gId = item.bill?.godown_id || defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));

      const sq = item.size_quantities || {};
      Object.entries(sq).forEach(([sz, q]) => {
        const numQ = Math.abs(Number(q || 0));
        existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - numQ);
      });

      const qty = Math.abs(Number(item.quantity || 0));
      const val = Math.abs(Number(item.amount || (qty * Number(item.rate || 0))));
      existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
      existing.totalValue = Math.max(0, existing.totalValue - val);
    });

    // E. Add Sales Returns (+)
    (salesReturns || []).forEach((item: any) => {
      if (item.sales_return?.status === "cancelled") return;
      const gId = item.sales_return?.godown_id || defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(item.rate || 0));

      const sq = item.size_quantities || {};
      Object.entries(sq).forEach(([sz, q]) => {
        const numQ = Math.abs(Number(q || 0));
        existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + numQ;
      });

      const qty = Math.abs(Number(item.returned_qty || item.quantity || 0));
      const val = Math.abs(Number(item.amount || (qty * Number(item.rate || 0))));
      existing.totalQuantity += qty;
      existing.totalValue += val;
    });

    // F. Insert fresh reconciled rows into finished_stock table.
    // All 'manual' rows were cleared above; we now insert fresh computed rows.
    let updatedCount = 0;
    const entriesArray = Array.from(stockMap.entries());

    for (let i = 0; i < entriesArray.length; i++) {
      const [_, stockData] = entriesArray[i];
      // Skip zero-stock entries to keep table clean
      if (stockData.totalQuantity <= 0 && stockData.totalValue <= 0) {
        updatedCount++;
        continue;
      }
      const { error: insErr } = await supabase
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
      if (insErr) {
        console.error("[reconcileFinishedStock] Error inserting reconciled row:", insErr, "data:", stockData);
      }
      updatedCount++;
    }

    return {
      success: true,
      message: `Successfully reconciled finished stock for ${stockMap.size} design/colour/godown combinations`,
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
