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
    const { data: godowns, error: godownErr } = await supabase
      .from("godowns")
      .select("id, name")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (godownErr) {
      // Godowns are required for reconciliation — abort if this fails
      throw new Error(`[reconcileFinishedStock] Failed to fetch godowns: ${godownErr.message}`);
    }

    const defaultGodownId = godowns && godowns.length > 0 ? godowns[0].id : null;

    // 2. Fetch completed production lots with size quantities
    let lotQuery = supabase
      .from("production_lots")
      .select("id, design_id, colour_id, status, godown_id, accessory_cost, other_cost, lot_size_quantities(*)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .eq("status", "completed");

    if (targetDesignId) {
      lotQuery = lotQuery.eq("design_id", targetDesignId);
    }
    const { data: productionLots, error: lotErr } = await lotQuery;
    if (lotErr) {
      // Production lots are the primary inflow — abort if this fails to avoid wiping stock
      throw new Error(`[reconcileFinishedStock] Failed to fetch production lots: ${lotErr.message}`);
    }

    // 3. Fetch finished goods purchases (Phase 3 raw_material_purchase_items)
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
      throw new Error(`[reconcileFinishedStock] Failed to fetch FG purchases: ${fgErr.message}`);
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
      throw new Error(`[reconcileFinishedStock] Failed to fetch FG purchase returns: ${fgrErr.message}`);
    }

    // 5. Fetch active sale bill items — include godown_id from sale_bills
    // FIXED: Previously had comment "sale_bills has no godown_id column" — it DOES. 
    //        This was the primary cause of stock appearing in wrong godowns.
    let salesBillQuery = supabase
      .from("sale_bill_items")
      .select("id, bill_id, design_id, colour_id, size, quantity, rate, amount, bill:sale_bills(status, deleted_at, is_temporary, godown_id)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      salesBillQuery = salesBillQuery.eq("design_id", targetDesignId);
    }
    const { data: salesBills, error: sbErr } = await salesBillQuery;
    if (sbErr) {
      // Sales are the primary outflow — abort if this fails to avoid inflating stock
      throw new Error(`[reconcileFinishedStock] Failed to fetch sale bills: ${sbErr.message}`);
    }

    // 6. Fetch active sale return items — include godown_id from sales_returns
    let salesReturnQuery = supabase
      .from("sales_return_items")
      .select("id, return_id, design_id, colour_id, size, size_quantities, returned_qty, unit_rate, amount, sales_return:sales_returns(status, godown_id)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      salesReturnQuery = salesReturnQuery.eq("design_id", targetDesignId);
    }
    const { data: salesReturns, error: srErr } = await salesReturnQuery;
    if (srErr) {
      throw new Error(`[reconcileFinishedStock] Failed to fetch sale returns: ${srErr.message}`);
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
      throw new Error(`[reconcileFinishedStock] Failed to fetch stock adjustments: ${adjErr.message}`);
    }

    // 8. Fetch active stock transfers
    let transferQuery = supabase
      .from("stock_transfer_items")
      .select("id, transfer_id, design_id, colour_id, size, quantity, unit_cost, total_value, transfer:stock_transfers(from_godown_id, to_godown_id, status)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      transferQuery = transferQuery.eq("design_id", targetDesignId);
    }
    const { data: stockTransfers, error: stErr } = await transferQuery;
    if (stErr) {
      throw new Error(`[reconcileFinishedStock] Failed to fetch stock transfers: ${stErr.message}`);
    }

    // 9. Fetch active challans
    let challanQuery = supabase
      .from("challan_items")
      .select("id, challan_id, design_id, colour_id, size, quantity, unit_cost, total_value, challan:challans(from_godown_id, status)")
      .eq("business_id", businessId);

    if (targetDesignId) {
      challanQuery = challanQuery.eq("design_id", targetDesignId);
    }
    const { data: challanItems, error: chErr } = await challanQuery;
    if (chErr) {
      throw new Error(`[reconcileFinishedStock] Failed to fetch challans: ${chErr.message}`);
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
    // Each production lot now tracks its own godown_id (set during move-to-stock).
    // Fall back to defaultGodownId for older lots that may not have it set.
    (productionLots || []).forEach((lot: any) => {
      if (lot.status === "cancelled") return;
      const gId = lot.godown_id || defaultGodownId;
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
    // FIXED: Now uses sale_bills.godown_id (the actual godown the sale was from).
    //        Previously always used defaultGodownId — all sales were deducted from the
    //        first godown, making stock in all other godowns always look inflated.
    (salesBills || []).forEach((item: any) => {
      if (item.bill?.status === "cancelled" || item.bill?.deleted_at || item.bill?.is_temporary) return;
      // Use the actual godown the sale bill was tied to — fall back to default only if truly missing
      const gId = item.bill?.godown_id || defaultGodownId;
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
    // FIXED: Now uses sales_returns.godown_id (where the returned stock goes back to).
    //        Previously always used defaultGodownId.
    (salesReturns || []).forEach((item: any) => {
      if (item.sales_return?.status === "cancelled" || item.sales_return?.status === "rejected") return;
      const gId = item.sales_return?.godown_id || defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!gId || !dId) return;

      const existing = getOrCreate(gId, dId, cId, Number(item.unit_rate || item.rate || 0));
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

    // G. Deduct / Add Stock Transfers (From Godown -, To Godown +)
    (stockTransfers || []).forEach((item: any) => {
      if (item.transfer?.status === "cancelled") return;
      const fromGId = item.transfer?.from_godown_id;
      const toGId = item.transfer?.to_godown_id;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!dId) return;

      const qty = Math.abs(Number(item.quantity || 0));
      const sz = item.size;

      // Deduct from source godown
      if (fromGId) {
        const sourceEst = getOrCreate(fromGId, dId, cId, Number(item.unit_cost || 0));
        if (sz && sz !== "all" && sz !== "—") {
          sourceEst.sizeQuantities[sz] = Math.max(0, (sourceEst.sizeQuantities[sz] || 0) - qty);
        }
        sourceEst.totalQuantity = Math.max(0, sourceEst.totalQuantity - qty);
      }

      // Add to target godown only if transfer is completed
      if (toGId && item.transfer?.status === "completed") {
        const targetEst = getOrCreate(toGId, dId, cId, Number(item.unit_cost || 0));
        if (sz && sz !== "all" && sz !== "—") {
          targetEst.sizeQuantities[sz] = (targetEst.sizeQuantities[sz] || 0) + qty;
        }
        targetEst.totalQuantity += qty;
      }
    });

    // H. Deduct Outward Challans (From Godown -)
    (challanItems || []).forEach((item: any) => {
      if (item.challan?.status === "cancelled") return;
      const fromGId = item.challan?.from_godown_id || defaultGodownId;
      const dId = item.design_id;
      const cId = item.colour_id || null;
      if (!fromGId || !dId) return;

      const existing = getOrCreate(fromGId, dId, cId, Number(item.unit_cost || 0));
      const qty = Math.abs(Number(item.quantity || 0));
      const sz = item.size;

      if (sz && sz !== "all" && sz !== "—") {
        existing.sizeQuantities[sz] = Math.max(0, (existing.sizeQuantities[sz] || 0) - qty);
      }
      existing.totalQuantity = Math.max(0, existing.totalQuantity - qty);
    });

    // 10. Clear existing finished_stock rows for target design (or all designs if no target)
    //     We do this AFTER all queries succeed — if any query above failed, we threw early
    //     and never reach here, so we never wipe stock without having the data to rebuild it.
    let deleteStockQuery = supabase
      .from("finished_stock")
      .delete()
      .eq("business_id", businessId);

    if (targetDesignId) {
      deleteStockQuery = deleteStockQuery.eq("design_id", targetDesignId);
    }
    const { error: deleteErr } = await deleteStockQuery;
    if (deleteErr) {
      throw new Error(`[reconcileFinishedStock] Failed to clear existing stock rows: ${deleteErr.message}`);
    }

    // Fetch design prices & active BOM costing fallbacks for unit cost resolution
    const { data: designPrices } = await supabase
      .from("designs")
      .select("id, sale_price")
      .eq("business_id", businessId);

    const { data: designCostings } = await supabase
      .from("design_costings")
      .select("design_id, total_cost_per_piece")
      .eq("business_id", businessId)
      .eq("is_active", true);

    const priceMap = new Map<string, number>();
    (designPrices || []).forEach((d: any) => {
      if (d.sale_price && Number(d.sale_price) > 0) {
        priceMap.set(d.id, Number(d.sale_price));
      }
    });

    const bomCostMap = new Map<string, number>();
    (designCostings || []).forEach((c: any) => {
      if (c.total_cost_per_piece && Number(c.total_cost_per_piece) > 0) {
        bomCostMap.set(c.design_id, Number(c.total_cost_per_piece));
      }
    });

    // 11. Insert fresh single ground-truth consolidated rows
    let updatedCount = 0;
    const entriesArray = Array.from(stockMap.entries());

    for (const [_, stockData] of entriesArray) {
      if (stockData.totalQuantity <= 0 && stockData.totalValue <= 0) {
        continue;
      }

      // Determine unit cost using fallback hierarchy:
      // 1. Existing costPerPiece / average cost from transactions
      // 2. Active design_costings total_cost_per_piece
      // 3. 60% of design sale_price
      // 4. Absolute default (150)
      let unitCost = stockData.costPerPiece;
      if (unitCost <= 0 && stockData.totalQuantity > 0 && stockData.totalValue > 0) {
        unitCost = Number((stockData.totalValue / stockData.totalQuantity).toFixed(2));
      }

      if (unitCost <= 0) {
        const bomCost = bomCostMap.get(stockData.designId) || 0;
        if (bomCost > 0) {
          unitCost = bomCost;
        } else {
          const salePrice = priceMap.get(stockData.designId) || 0;
          if (salePrice > 0) {
            unitCost = Math.round(salePrice * 0.6);
          } else {
            unitCost = 150; // Default estimated unit cost for un-priced items
          }
        }
      }

      const computedValue = stockData.totalValue > 0
        ? Math.max(0, Number(stockData.totalValue.toFixed(2)))
        : Math.max(0, Number((stockData.totalQuantity * unitCost).toFixed(2)));

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
          cost_per_piece: Number(unitCost.toFixed(2)),
          total_value: computedValue,
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
