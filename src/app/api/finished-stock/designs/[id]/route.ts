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

  const designId = params.id;

  try {
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

    // 4. Fetch all finished stock entries for this design
    const { data: ledger, error: ledgerErr } = await supabase
      .from("finished_stock")
      .select("*")
      .eq("design_id", designId)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    // 5. Aggregate stock by colour_id, godown_id, and size
    const matrix: Record<string, Record<string, Record<string, number>>> = {};
    const costs: Record<string, { total_cost: number; count: number }> = {};

    if (ledger) {
      ledger.forEach((entry) => {
        const cId = entry.colour_id;
        const gId = entry.godown_id;
        
        if (!matrix[cId]) matrix[cId] = {};
        if (!matrix[cId][gId]) matrix[cId][gId] = {};

        // Aggregate sizes
        if (entry.size_quantities) {
          Object.keys(entry.size_quantities).forEach((size) => {
            const qty = Number(entry.size_quantities[size] || 0);
            matrix[cId][gId][size] = (matrix[cId][gId][size] || 0) + qty;
          });
        }

        // Track costs for average cost
        if (entry.cost_per_piece) {
          const cost = Number(entry.cost_per_piece);
          if (cost > 0) {
            if (!costs[cId]) costs[cId] = { total_cost: 0, count: 0 };
            costs[cId].total_cost += cost;
            costs[cId].count += 1;
          }
        }
      });
    }

    // Build colour average costs map
    const colourCosts: Record<string, number> = {};
    if (colours) {
      colours.forEach((c) => {
        const costInfo = costs[c.id];
        colourCosts[c.id] = costInfo && costInfo.count > 0 
          ? Number((costInfo.total_cost / costInfo.count).toFixed(2))
          : Number(design.sale_price || 0) * 0.6; // Default to 60% of sale price if no cost recorded
      });
    }

    return NextResponse.json({
      design,
      colours: colours || [],
      godowns: godowns || [],
      matrix,
      colourCosts
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
