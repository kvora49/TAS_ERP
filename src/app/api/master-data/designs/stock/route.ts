import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileFinishedStock } from "@/lib/finished-stock-reconciliation";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const godownId = searchParams.get("godown_id");
  const designId = searchParams.get("design_id");
  const designNumber = searchParams.get("design_number");
  const colourId = searchParams.get("colour_id");
  const size = searchParams.get("size");
  const stockType = searchParams.get("stock_type") || "all"; // 'all', 'latest', 'old'
  const movementType = searchParams.get("movement_type") || "all"; // 'all', 'stock_in', 'stock_out'
  const viewMode = searchParams.get("view_mode") || "design_wise"; // 'design_wise', 'item_wise'
  const lotId = searchParams.get("lot_id");
  const search = searchParams.get("search");

  try {
    // 0. Run ground-truth finished stock reconciliation
    await reconcileFinishedStock(supabase, businessId);

    // 1. Fetch Finished Stock entries
    let stockQuery = supabase
      .from("finished_stock")
      .select(`
        id,
        business_id,
        design_id,
        colour_id,
        size_set_id,
        lot_id,
        godown_id,
        entry_type,
        size_quantities,
        total_quantity,
        cost_per_piece,
        total_value,
        created_at,
        design:designs(id, name, design_number, category, brand:brands(name)),
        colour:design_colours(id, colour_name, colour_hex),
        godown:godowns(id, name),
        lot:production_lots(id, lot_number)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (godownId && godownId !== "all") {
      stockQuery = stockQuery.eq("godown_id", godownId);
    }
    if (designId && designId !== "all") {
      stockQuery = stockQuery.eq("design_id", designId);
    }
    if (colourId && colourId !== "all") {
      stockQuery = stockQuery.eq("colour_id", colourId);
    }
    if (lotId && lotId !== "all") {
      stockQuery = stockQuery.eq("lot_id", lotId);
    }

    if (movementType === "stock_in") {
      stockQuery = stockQuery.in("entry_type", ["production", "manual", "transfer_in", "challan_in"]);
    } else if (movementType === "stock_out") {
      stockQuery = stockQuery.in("entry_type", ["adjustment", "transfer_out", "challan_out"]);
    }

    const { data: rawEntries, error } = await stockQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = rawEntries || [];

    // Filter by design_number search or size filter if specified
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let filtered = entries.filter((item: any) => {
      // Design Number filter
      if (designNumber && designNumber !== "all") {
        if (!item.design?.design_number?.toLowerCase().includes(designNumber.toLowerCase())) {
          return false;
        }
      }

      // Search keyword
      if (search) {
        const q = search.toLowerCase();
        const dName = item.design?.name?.toLowerCase() || "";
        const dNum = item.design?.design_number?.toLowerCase() || "";
        const cName = item.colour?.colour_name?.toLowerCase() || "";
        const gName = item.godown?.name?.toLowerCase() || "";
        const lNum = item.lot?.lot_number?.toLowerCase() || "";
        if (!dName.includes(q) && !dNum.includes(q) && !cName.includes(q) && !gName.includes(q) && !lNum.includes(q)) {
          return false;
        }
      }

      // Size Filter
      if (size && size !== "all") {
        const sizeQty = item.size_quantities?.[size] || 0;
        if (Number(sizeQty) <= 0) return false;
      }

      // Aging / Stock Type filter
      const createdAt = new Date(item.created_at);
      if (stockType === "latest") {
        if (createdAt < fourteenDaysAgo) return false;
      } else if (stockType === "old") {
        if (createdAt > thirtyDaysAgo) return false;
      }

      return true;
    });

    // Aggregate metrics
    let totalQty = 0;
    let totalVal = 0;
    const godownBreakdown: Record<string, number> = {};
    const sizeBreakdown: Record<string, number> = {};
    const designMap: Record<string, any> = {};

    filtered.forEach((row: any) => {
      const q = Number(row.total_quantity || 0);
      const v = Number(row.total_value || 0);
      totalQty += q;
      totalVal += v;

      // Godown
      const gName = row.godown?.name || "Unassigned";
      godownBreakdown[gName] = (godownBreakdown[gName] || 0) + q;

      // Size
      if (row.size_quantities) {
        Object.entries(row.size_quantities).forEach(([sz, sq]) => {
          const numSq = Number(sq || 0);
          if (numSq > 0) {
            sizeBreakdown[sz] = (sizeBreakdown[sz] || 0) + numSq;
          }
        });
      }

      // Design Summary grouping
      const dKey = row.design_id || "unknown";
      if (!designMap[dKey]) {
        designMap[dKey] = {
          design_id: row.design_id,
          design_number: row.design?.design_number || "N/A",
          design_name: row.design?.name || "Unknown Design",
          category: row.design?.category || "Unassigned",
          brand_name: row.design?.brand?.name || "Unassigned",
          total_quantity: 0,
          total_value: 0,
          colours: new Set<string>(),
          godowns: new Set<string>(),
          lots: new Set<string>(),
          entry_count: 0,
          latest_date: row.created_at,
        };
      }

      designMap[dKey].total_quantity += q;
      designMap[dKey].total_value += v;
      designMap[dKey].entry_count += 1;
      if (row.colour?.colour_name) designMap[dKey].colours.add(row.colour.colour_name);
      if (row.godown?.name) designMap[dKey].godowns.add(row.godown.name);
      if (row.lot?.lot_number) designMap[dKey].lots.add(row.lot.lot_number);
    });

    const designSummaries = Object.values(designMap).map((d: any) => ({
      ...d,
      colours: Array.from(d.colours),
      godowns: Array.from(d.godowns),
      lots: Array.from(d.lots),
    }));

    return NextResponse.json({
      stock_entries: filtered,
      design_summaries: designSummaries,
      metrics: {
        total_items: filtered.length,
        total_quantity: totalQty,
        total_value: totalVal,
        godown_breakdown: godownBreakdown,
        size_breakdown: sizeBreakdown,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
