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
