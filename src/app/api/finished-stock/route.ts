import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const gradeFilter = searchParams.get("grade"); // 'all' | 'A' | 'B'

  try {
    // 1. Query finished_stock (Grade A)
    let fsEntries: any[] = [];
    if (gradeFilter !== "B") {
      const { data, error } = await supabase
        .from("finished_stock")
        .select(`
          id,
          total_quantity,
          total_value,
          cost_per_piece,
          entry_type,
          design_id,
          colour_id,
          godown_id,
          size_quantities,
          design:designs(id, name, design_number, sale_price),
          colour:design_colours(id, colour_name, colour_hex),
          godown:godowns(id, name)
        `)
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (error) throw error;
      fsEntries = (data || []).map((row: any) => ({ ...row, stock_grade: "A" }));
    }

    // 2. Query b_grade_stock (Grade B - BUG 7/8 FIX)
    let bgEntries: any[] = [];
    if (gradeFilter !== "A") {
      const { data, error } = await supabase
        .from("b_grade_stock")
        .select(`
          id,
          total_quantity,
          total_value,
          cost_per_piece,
          design_id,
          colour_id,
          godown_id,
          size_quantities,
          design:designs(id, name, design_number, sale_price),
          colour:design_colours(id, colour_name, colour_hex),
          godown:godowns(id, name)
        `)
        .eq("business_id", businessId)
        .eq("status", "available")
        .is("deleted_at", null);

      if (error) throw error;
      bgEntries = (data || []).map((row: any) => ({ ...row, stock_grade: "B" }));
    }

    const stockEntries = [...fsEntries, ...bgEntries];

    let totalStock = 0;
    let gradeAStock = 0;
    let gradeBStock = 0;
    let totalValue = 0;
    const designsMap: Record<string, any> = {};
    const godownsMap: Record<string, any> = {};
    const sizesMap: Record<string, number> = {};

    stockEntries.forEach((row: any) => {
      const qty = Number(row.total_quantity || 0);
      const costPerPiece = Number(row.cost_per_piece || 0);
      const salePrice = Number(row.design?.sale_price || 0);
      const unitCost = costPerPiece > 0 ? costPerPiece : salePrice > 0 ? Math.round(salePrice * 0.6) : 0;
      const val = Number(row.total_value || 0) > 0 ? Number(row.total_value) : qty * unitCost;

      totalStock += qty;
      if (row.stock_grade === "B") {
        gradeBStock += qty;
      } else {
        gradeAStock += qty;
      }
      totalValue += val;

      // Godown Breakdown (with A vs B split)
      const gName = row.godown?.name || "Unknown Godown";
      if (!godownsMap[gName]) {
        godownsMap[gName] = {
          godown_name: gName,
          quantity: 0,
          grade_a_quantity: 0,
          grade_b_quantity: 0,
          value: 0,
        };
      }
      godownsMap[gName].quantity += qty;
      if (row.stock_grade === "B") {
        godownsMap[gName].grade_b_quantity += qty;
      } else {
        godownsMap[gName].grade_a_quantity += qty;
      }
      godownsMap[gName].value += val;

      // Size Breakdown
      if (row.size_quantities) {
        Object.entries(row.size_quantities).forEach(([sz, q]) => {
          const sizeQty = Number(q || 0);
          if (sizeQty > 0) {
            sizesMap[sz] = (sizesMap[sz] || 0) + sizeQty;
          }
        });
      }

      // Top Designs Breakdown
      if (row.design_id && row.design) {
        const dId = row.design_id;
        if (!designsMap[dId]) {
          designsMap[dId] = {
            design_id: dId,
            design_code: row.design.design_number || "N/A",
            design_name: row.design.name || "Unknown",
            total_quantity: 0,
            grade_a_quantity: 0,
            grade_b_quantity: 0,
            total_value: 0,
            colours: new Set<string>(),
            sizes: new Set<string>(),
            godowns: new Set<string>(),
            godown_name: "",
          };
        }

        designsMap[dId].total_quantity += qty;
        if (row.stock_grade === "B") {
          designsMap[dId].grade_b_quantity += qty;
        } else {
          designsMap[dId].grade_a_quantity += qty;
        }
        designsMap[dId].total_value += val;

        if (row.colour?.colour_hex) {
          designsMap[dId].colours.add(row.colour.colour_hex);
        }
        if (row.godown?.name) {
          designsMap[dId].godowns.add(row.godown.name);
        }
        if (row.size_quantities) {
          Object.entries(row.size_quantities).forEach(([sz, q]) => {
            if (Number(q || 0) > 0) {
              designsMap[dId].sizes.add(sz);
            }
          });
        }
      }
    });

    // Construct arrays
    const godown_breakdown = Object.values(godownsMap);
    const size_breakdown = Object.entries(sizesMap).map(([size, quantity]) => ({ size, quantity }));
    const top_designs = Object.values(designsMap)
      .map((d) => {
        const godownList = Array.from(d.godowns);
        return {
          design_id: d.design_id,
          design_code: d.design_code,
          design_name: d.design_name,
          total_quantity: d.total_quantity,
          grade_a_quantity: d.grade_a_quantity,
          grade_b_quantity: d.grade_b_quantity,
          total_value: d.total_value,
          colours: Array.from(d.colours),
          sizes: Array.from(d.sizes),
          godown_count: godownList.length,
          godown_name: godownList.length === 1 ? godownList[0] : `All (${godownList.length})`,
        };
      })
      .sort((a: any, b: any) => b.total_quantity - a.total_quantity)
      .slice(0, 10);

    const calculatedStats = {
      total_stock: totalStock,
      grade_a_stock: gradeAStock,
      grade_b_stock: gradeBStock,
      total_designs: Object.keys(designsMap).length,
      total_colours: Array.from(new Set(stockEntries.map((r: any) => r.colour_id).filter(Boolean))).length,
      total_sizes: size_breakdown.length,
      total_value: totalValue,
      active_godowns: godown_breakdown.length,
      godown_breakdown,
      size_breakdown,
      top_designs,
    };

    return NextResponse.json({ stats: calculatedStats });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
