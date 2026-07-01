import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Call RPC
    const { data: stats, error } = await supabase.rpc("get_finished_stock_stats", {
      p_business_id: businessId,
    });

    if (error) {
      console.warn("RPC get_finished_stock_stats failed, falling back to manual queries:", error.message);
      
      // Fallback: Query finished_stock. If table doesn't exist, we return empty stats
      const { data: stockEntries, error: dbErr } = await supabase
        .from("finished_stock")
        .select("total_quantity, total_value, design_id, colour_id, godown_id, size_quantities")
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (dbErr || !stockEntries) {
        return NextResponse.json({
          stats: {
            total_stock: 0,
            total_designs: 0,
            total_colours: 0,
            total_sizes: 0,
            total_value: 0,
            active_godowns: 0,
            godown_breakdown: [],
            size_breakdown: [],
            top_designs: [],
          }
        });
      }

      let totalStock = 0;
      let totalValue = 0;
      const designs = new Set();
      const colours = new Set();
      const godowns = new Set();
      const sizes = new Set();

      stockEntries.forEach((row) => {
        totalStock += row.total_quantity || 0;
        totalValue += Number(row.total_value || 0);
        if (row.design_id) designs.add(row.design_id);
        if (row.colour_id) colours.add(row.colour_id);
        if (row.godown_id) godowns.add(row.godown_id);
        
        if (row.size_quantities) {
          Object.keys(row.size_quantities).forEach((sz) => {
            if (Number(row.size_quantities[sz]) !== 0) {
              sizes.add(sz);
            }
          });
        }
      });

      const fallbackStats = {
        total_stock: totalStock,
        total_designs: designs.size,
        total_colours: colours.size,
        total_sizes: sizes.size,
        total_value: totalValue,
        active_godowns: godowns.size,
        godown_breakdown: [],
        size_breakdown: [],
        top_designs: [],
      };

      return NextResponse.json({ stats: fallbackStats });
    }

    return NextResponse.json({ stats });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
