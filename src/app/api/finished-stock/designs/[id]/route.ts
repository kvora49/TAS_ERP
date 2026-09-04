import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const designId = params.id;

  try {
    // 0. Trigger ground-truth reconciliation for this design
    await reconcileFinishedStock(supabase, businessId, designId);
    // 1. Fetch design profile details
    const { data: design, error: designErr } = await supabase
      .from("designs")
      .select("*, brand:brands(name), size_set:size_sets(name, sizes)")
      .eq("id", designId)
      .eq("business_id", businessId)
      .single();

    if (designErr || !design) {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    // 2. Fetch colours for this design
    const { data: colours, error: coloursErr } = await supabase
      .from("design_colours")
      .select("*")
      .eq("design_id", designId);

    // 3. Fetch godowns
    const { data: godowns, error: godownsErr } = await supabase
      .from("godowns")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    // 4. Fetch all finished stock and B-grade stock entries for this design in parallel
    const [fsRes, bgRes] = await Promise.all([
      supabase
        .from("finished_stock")
        .select("*")
        .eq("design_id", designId)
        .eq("business_id", businessId)
        .is("deleted_at", null),
      supabase
        .from("b_grade_stock")
        .select(`
          *,
          colour:design_colours (id, colour_name, colour_hex),
          godown:godowns (id, name)
        `)
        .eq("design_id", designId)
        .eq("business_id", businessId)
        .eq("status", "available")
        .is("deleted_at", null),
    ]);

    const ledger = fsRes.data || [];
    const bgStockEntries = bgRes.data || [];
    let bGradeStockQty = 0;
    let bGradeStockValue = 0;

    bgStockEntries.forEach((bg: any) => {
      bGradeStockQty += Number(bg.total_quantity || 0);
      bGradeStockValue += Number(bg.total_value || 0);
    });

    // 5. Aggregate stock by colour_id, godown_id, and size
    const matrix: Record<string, Record<string, Record<string, number>>> = {};
    const colourTotals: Record<string, { total_value: number; total_qty: number }> = {};
    let totalDesignStockQty = 0;
    let totalDesignStockValue = 0;

    if (ledger) {
      ledger.forEach((entry) => {
        const cId = entry.colour_id || "default";
        const gId = entry.godown_id;
        
        if (!matrix[cId]) matrix[cId] = {};
        if (!matrix[cId][gId]) matrix[cId][gId] = {};

        let entryQty = 0;
        if (entry.size_quantities) {
          Object.keys(entry.size_quantities).forEach((size) => {
            const qty = Number(entry.size_quantities[size] || 0);
            matrix[cId][gId][size] = (matrix[cId][gId][size] || 0) + qty;
            entryQty += qty;
          });
        } else {
          entryQty = Number(entry.total_quantity || 0);
        }

        const unitCost = Number(entry.cost_per_piece || 0);
        let entryVal = Number(entry.total_value || 0);
        if (entryVal === 0 && unitCost > 0) {
          entryVal = entryQty * unitCost;
        }

        if (!colourTotals[cId]) {
          colourTotals[cId] = { total_value: 0, total_qty: 0 };
        }
        colourTotals[cId].total_value += entryVal;
        colourTotals[cId].total_qty += entryQty;

        totalDesignStockQty += entryQty;
        totalDesignStockValue += entryVal;
      });
    }

    // Fetch connected production lots and calculate production cost per piece
    const { data: productionLots } = await supabase
      .from("production_lots")
      .select("id, lot_number, total_quantity, completed_quantity, status, created_at, accessory_cost, other_cost")
      .eq("design_id", designId)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    let lotDerivedUnitCost = 0;
    if (productionLots && productionLots.length > 0) {
      const lotIds = productionLots.map((l) => l.id);
      const totalLotQty = productionLots.reduce((acc, l) => acc + Number(l.total_quantity || 0), 0);

      if (totalLotQty > 0) {
        const { data: lotRolls } = await supabase
          .from("lot_rolls")
          .select(`
            allocated_meters,
            purchase_roll:purchase_rolls (
              item:raw_material_purchase_items (rate)
            )
          `)
          .in("lot_id", lotIds)
          .eq("business_id", businessId);

        const totalFabricCost = (lotRolls || []).reduce((acc: number, curr: any) => {
          const rate = Number(curr.purchase_roll?.item?.rate || 0);
          return acc + (Number(curr.allocated_meters || 0) * rate);
        }, 0);

        const { data: stageEntries } = await supabase
          .from("stage_entries")
          .select("qty_out, job_work_rate, total_job_work_amount")
          .in("lot_id", lotIds)
          .eq("business_id", businessId);

        const totalLaborCost = (stageEntries || []).reduce((acc: number, curr: any) => {
          return acc + Number(curr.total_job_work_amount || (Number(curr.qty_out || 0) * Number(curr.job_work_rate || 0)));
        }, 0);

        const totalAccCost = productionLots.reduce((acc, l) => acc + Number(l.accessory_cost || 0), 0);
        const totalOtherCost = productionLots.reduce((acc, l) => acc + Number(l.other_cost || 0), 0);

        const grandLotCost = totalFabricCost + totalLaborCost + totalAccCost + totalOtherCost;
        lotDerivedUnitCost = Number((grandLotCost / totalLotQty).toFixed(2));
      }
    }

    // Fetch active design BOM costing fallback if any
    const { data: savedCosting } = await supabase
      .from("design_costings")
      .select("total_cost_per_piece")
      .eq("design_id", designId)
      .eq("business_id", businessId)
      .eq("is_active", true)
      .maybeSingle();

    const fallbackBomCost = savedCosting?.total_cost_per_piece
      ? Number(savedCosting.total_cost_per_piece)
      : (lotDerivedUnitCost > 0 ? lotDerivedUnitCost : (Number(design.sale_price || 0) * 0.6));

    // Fallback valuation if stock exists but ledger entries had 0 cost
    if (totalDesignStockValue === 0 && totalDesignStockQty > 0 && fallbackBomCost > 0) {
      totalDesignStockValue = totalDesignStockQty * fallbackBomCost;
    }

    const overallAvgCost = totalDesignStockQty > 0
      ? Number((totalDesignStockValue / totalDesignStockQty).toFixed(2))
      : Number(fallbackBomCost.toFixed(2));

    // Build colour weighted average costs map
    const colourCosts: Record<string, number> = {};
    if (colours && colours.length > 0) {
      colours.forEach((c) => {
        const totals = colourTotals[c.id] || (colours.length === 1 ? colourTotals["default"] : null);
        if (totals && totals.total_qty > 0 && totals.total_value > 0) {
          colourCosts[c.id] = Number((totals.total_value / totals.total_qty).toFixed(2));
        } else if (totals && totals.total_qty > 0 && fallbackBomCost > 0) {
          colourCosts[c.id] = Number(fallbackBomCost.toFixed(2));
        } else {
          colourCosts[c.id] = Number(fallbackBomCost.toFixed(2));
        }
      });
    } else {
      colourCosts["default"] = Number(overallAvgCost.toFixed(2));
    }

    return NextResponse.json({
      design,
      colours: colours || [],
      godowns: godowns || [],
      matrix,
      colourCosts,
      totalDesignStockQty,
      totalDesignStockValue,
      overallAvgCost,
      bGradeStock: bgStockEntries,
      bGradeStockQty,
      bGradeStockValue,
      productionLots: productionLots || [],
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

  const designId = params.id;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "check";
    const targetDesignId = searchParams.get("target_design_id");

    // 1. Fetch design
    const { data: design, error: designErr } = await supabase
      .from("designs")
      .select("id, name, design_number")
      .eq("id", designId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (designErr || !design) {
      return NextResponse.json({ error: "Design not found" }, { status: 404 });
    }

    // 2. Query finished stock entries for this design
    const { data: stockItems } = await supabase
      .from("finished_stock")
      .select("id, godown_id, total_quantity, total_value")
      .eq("design_id", designId)
      .eq("business_id", businessId)
      .gt("total_quantity", 0);

    // 3. Query production lots linked to this design
    const { data: lots } = await supabase
      .from("production_lots")
      .select("id, lot_number")
      .eq("design_id", designId)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    const totalStockQty = (stockItems || []).reduce((acc, curr) => acc + Number(curr.total_quantity || 0), 0);
    const hasStockOrLots = (stockItems && stockItems.length > 0) || (lots && lots.length > 0);

    // ACTION: Check status
    if (action === "check") {
      return NextResponse.json({
        hasStock: hasStockOrLots,
        stockCount: stockItems?.length || 0,
        totalQuantity: totalStockQty,
        lotsCount: lots?.length || 0,
      });
    }

    // ACTION: Transfer stock & production lots to target design
    if (action === "transfer") {
      if (!targetDesignId) {
        return NextResponse.json({ error: "Target design is required for transfer" }, { status: 400 });
      }

      if (targetDesignId === designId) {
        return NextResponse.json({ error: "Target design must be different from source design" }, { status: 400 });
      }

      const { data: targetDesign } = await supabase
        .from("designs")
        .select("id, name, design_number")
        .eq("id", targetDesignId)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .single();

      if (!targetDesign) {
        return NextResponse.json({ error: "Target design not found" }, { status: 404 });
      }

      // Transfer finished stock records
      if (stockItems && stockItems.length > 0) {
        for (const item of stockItems) {
          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "finished_good",
            item_id: targetDesignId,
            godown_id: item.godown_id,
            transaction_type: "design_transfer",
            quantity_delta: Number(item.total_quantity),
            value_delta: Number(item.total_value),
            reference_table: "designs",
            reference_id: designId,
          });

          await supabase
            .from("finished_stock")
            .update({ design_id: targetDesignId, updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      }

      // Re-link production lots to target design
      if (lots && lots.length > 0) {
        const lotIds = lots.map((l) => l.id);
        await supabase
          .from("production_lots")
          .update({ design_id: targetDesignId, updated_at: new Date().toISOString() })
          .in("id", lotIds)
          .eq("business_id", businessId);
      }

      // Soft-delete design
      const { error: deleteErr } = await supabase
        .from("designs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", designId)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Design '${design.design_number} - ${design.name}' deleted. Transferred stock and lots to '${targetDesign.design_number} - ${targetDesign.name}'.`,
      });
    }

    // ACTION: Force delete (Write-off finished stock)
    if (action === "force") {
      if (stockItems && stockItems.length > 0) {
        for (const item of stockItems) {
          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "finished_good",
            item_id: designId,
            godown_id: item.godown_id,
            transaction_type: "design_deletion_writeoff",
            quantity_delta: -Number(item.total_quantity),
            value_delta: -Number(item.total_value),
            reference_table: "designs",
            reference_id: designId,
          });

          await supabase
            .from("finished_stock")
            .update({ total_quantity: 0, total_value: 0, updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      }

      // Soft-delete design
      const { error: deleteErr } = await supabase
        .from("designs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", designId)
        .eq("business_id", businessId);

      if (deleteErr) throw new Error(deleteErr.message);

      return NextResponse.json({
        success: true,
        message: `Design '${design.design_number} - ${design.name}' soft-deleted. Active stock written off. Past invoices and cost history preserved.`,
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
