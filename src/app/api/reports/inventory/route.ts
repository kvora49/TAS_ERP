import { NextRequest, NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { readReportRows, requireReportResults } from "@/lib/report-data";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") ?? "valuation";
  const category = searchParams.get("category") ?? "all"; // 'all' | 'finished_goods' | 'raw_material' | 'accessory'
  const billType = searchParams.get("bill_type"); // 'kacha' | 'pakka' | null
  const godownId = searchParams.get("godown_id");
  const brandId = searchParams.get("brand_id");
  const stockStatus = searchParams.get("stock_status");
  const bid = businessId;

  try {
    const [brandsResult, godownsResult, finishedRawResult, rawMaterialsRawResult] = await Promise.all([
      readReportRows(supabase
      .from("brands")
      .select("id, name")
      .eq("business_id", bid).order("id")),
      readReportRows(supabase
      .from("godowns")
      .select("id, name, address, code")
      .eq("business_id", bid).order("id")),
      readReportRows(supabase
      .from("finished_stock")
      .select(`
        id, godown_id, total_quantity, total_value, cost_per_piece, size_quantities, design_id, colour_id,
        design:designs(id, name, design_number, sale_price, brand_id),
        colour:design_colours(id, colour_name),
        godown:godowns(id, name)
      `)
      .eq("business_id", bid).order("id")),
      readReportRows(supabase
      .from("raw_material_current_stock")
      .select(`
        id, godown_id, current_stock, unit_cost, stock_value,
        godown:godowns(id, name),
        material_type:raw_material_types(id, name, category, unit, reorder_level)
      `)
      .eq("business_id", bid).order("id")),
    ]);
    requireReportResults([brandsResult, godownsResult, finishedRawResult, rawMaterialsRawResult]);
    // Reports read recorded stock only; reconciliation is a separate controlled operation.
    // 1. Master Brands (to map brand names safely without nested PostgREST join failures)
    
    const brandsData = brandsResult.data;

    const brandMap: Record<string, string> = {};
    (brandsData ?? []).forEach((b: any) => {
      brandMap[b.id] = b.name;
    });

    // 2. Master Godowns (Correct column: address, code)
    
    const godownsData = godownsResult.data;
    const godownsErr = godownsResult.error;

    if (godownsErr) {
      console.error("[reports/inventory] Godowns query error:", godownsErr);
    }

    const godownsList = godownsData ?? [];

    // 3. Finished Stock with Design Prices (Correct column: sale_price without non-existent sample_cost)
    
    const finishedRawData = finishedRawResult.data;
    const fgErr = finishedRawResult.error;

    if (fgErr) {
      console.error("[reports/inventory] Finished stock query error:", fgErr);
    }

    // 4. Raw Material Current Stock with Unit Cost
    
    const rawMaterialsRawData = rawMaterialsRawResult.data;
    const rmErr = rawMaterialsRawResult.error;

    if (rmErr) {
      console.error("[reports/inventory] Raw material stock query error:", rmErr);
    }

    let finishedRaw = finishedRawData ?? [];
    let rawMaterialsRaw = rawMaterialsRawData ?? [];

    // Apply godown filtering
    if (godownId && godownId !== "all") {
      finishedRaw = finishedRaw.filter((s: any) => s.godown_id === godownId);
      rawMaterialsRaw = rawMaterialsRaw.filter((r: any) => r.godown_id === godownId);
    }

    // Apply brand filtering
    if (brandId && brandId !== "all") {
      finishedRaw = finishedRaw.filter((s: any) => s.design?.brand_id === brandId);
      rawMaterialsRaw = []; // Raw stock has no supported brand attribution.
    }

    // Apply stock status filtering
    if (stockStatus && stockStatus !== "all") {
      if (stockStatus === "out_of_stock") {
        finishedRaw = finishedRaw.filter((s: any) => Number(s.total_quantity ?? 0) <= 0);
        rawMaterialsRaw = rawMaterialsRaw.filter((r: any) => Number(r.current_stock ?? 0) <= 0);
      } else if (stockStatus === "low_stock") {
        finishedRaw = []; // Finished-goods reorder thresholds are not recorded.
        rawMaterialsRaw = rawMaterialsRaw.filter((r: any) => {
          const stock = Number(r.current_stock ?? 0);
          const reorder = Number(r.material_type?.reorder_level ?? 0);
          return reorder > 0 && stock <= reorder;
        });
      } else if (stockStatus === "in_stock") {
        finishedRaw = finishedRaw.filter((s: any) => Number(s.total_quantity ?? 0) > 0);
        rawMaterialsRaw = rawMaterialsRaw.filter((r: any) => Number(r.current_stock ?? 0) > 0);
      }
    }

    // Compute Finished Goods items with valuation fallback
    let finishedItems = finishedRaw.map((s: any) => {
      const qty = Number(s.total_quantity ?? 0);
      const costPerPiece = Number(s.cost_per_piece || 0);
      const salePrice = Number(s.design?.sale_price || 0);
      const unitCost = costPerPiece;
      const val = Number(s.total_value || 0) > 0 ? Number(s.total_value) : qty * unitCost;
      const brandName = s.design?.brand_id ? (brandMap[s.design.brand_id] ?? "Default") : "Default";
      return {
        ...s,
        qty,
        unitCost,
        val,
        brandName,
      };
    });

    // Compute Raw Material items with valuation fallback
    let rawItems = rawMaterialsRaw.map((r: any) => {
      const qty = Number(r.current_stock ?? 0);
      const unitCost = Number(r.unit_cost ?? 0);
      const val = Number(r.stock_value ?? 0) > 0 ? Number(r.stock_value) : qty * unitCost;
      const cat = (r.material_type?.category || "").toLowerCase();
      const isAcc = cat.includes("access") || cat.includes("trim") || cat.includes("button") || cat.includes("zipper") || cat.includes("label") || cat.includes("pack");
      return {
        ...r,
        qty,
        unitCost,
        val,
        isAcc,
      };
    });

    if (category === "finished_goods") rawItems = [];
    if (category === "raw_material") { finishedItems = []; rawItems = rawItems.filter(r => !r.isAcc); }
    if (category === "accessory") { finishedItems = []; rawItems = rawItems.filter(r => r.isAcc); }
    const units: Record<string, number> = {};
    for (const item of finishedItems) units.pcs = (units.pcs || 0) + item.qty;
    for (const item of rawItems) { const unit = (item.material_type?.unit || "Unknown unit").trim().toLowerCase(); units[unit] = (units[unit] || 0) + item.qty; }
    const quantitiesByCategory: Record<string, Record<string, number>> = { finished_goods: { pcs: finishedItems.reduce((sum, item) => sum + item.qty, 0) }, raw_material: {}, accessory: {} };
    for (const item of rawItems) { const bucket = quantitiesByCategory[item.isAcc ? "accessory" : "raw_material"], unit = (item.material_type?.unit || "Unknown unit").trim().toLowerCase(); bucket[unit] = (bucket[unit] || 0) + item.qty; }
    const metadata = { quantitiesByCategory, basis: "Current recorded stock snapshot", asOf: new Date().toISOString(), historical: false, quantitiesByUnit: units, missingCostCount: [...finishedItems, ...rawItems].filter(r => r.qty > 0 && r.val <= 0).length, note: "Missing costs are excluded from recorded value. Bill-type ownership is unavailable. Brand filters exclude unattributed raw stock; low-stock scope uses recorded raw reorder thresholds only." };
    const totalFGQty = finishedItems.reduce((s, r) => s + r.qty, 0);
    const totalFGValue = finishedItems.reduce((s, r) => s + r.val, 0);

    const totalRMQty = rawItems.filter(r => !r.isAcc).reduce((s, r) => s + r.qty, 0);
    const totalRMValue = rawItems.filter(r => !r.isAcc).reduce((s, r) => s + r.val, 0);

    const totalAccQty = rawItems.filter(r => r.isAcc).reduce((s, r) => s + r.qty, 0);
    const totalAccValue = rawItems.filter(r => r.isAcc).reduce((s, r) => s + r.val, 0);

    const grandTotalQty = Object.keys(units).length === 1 ? Object.values(units)[0] : null;
    const grandTotalValue = totalFGValue + totalRMValue + totalAccValue;

    // ── TAB: VALUATION ──
    if (tab === "valuation") {
      const designMap: Record<string, {
        design_id: string; design_name: string; design_number: string;
        brand: string; total_qty: number; total_value: number; item_type: string;
      }> = {};

      // FG items by design
      finishedItems.forEach((s: any) => {
        const d = s.design;
        const did = d?.id ?? "unknown";
        if (!designMap[did]) {
          designMap[did] = {
            design_id: did,
            design_name: d?.name ?? "—",
            design_number: d?.design_number ?? "—",
            brand: s.brandName,
            total_qty: 0,
            total_value: 0,
            item_type: "Finished Goods",
          };
        }
        designMap[did].total_qty += s.qty;
        designMap[did].total_value += s.val;
      });

      const fgRows = Object.values(designMap).sort((a, b) => b.total_value - a.total_value);

      // Raw Material / Accessory items by material_type
      const rmMap: Record<string, {
        id: string; name: string; category: string; unit: string; total_qty: number; total_value: number; item_type: string;
      }> = {};

      rawItems.forEach((r: any) => {
        const mt = r.material_type;
        const mtid = mt?.id ?? "unknown_rm";
        if (!rmMap[mtid]) {
          rmMap[mtid] = {
            id: mtid,
            name: mt?.name ?? "Raw Material",
            category: mt?.category ?? "General",
            unit: mt?.unit ?? "Pcs",
            total_qty: 0,
            total_value: 0,
            item_type: r.isAcc ? "Accessory & Trim" : "Raw Material",
          };
        }
        rmMap[mtid].total_qty += r.qty;
        rmMap[mtid].total_value += r.val;
      });

      const rmRows = Object.values(rmMap).sort((a, b) => b.total_value - a.total_value);

      const brandBreakdown = fgRows.reduce<Record<string, { qty: number; value: number }>>((acc, r) => {
        if (!acc[r.brand]) acc[r.brand] = { qty: 0, value: 0 };
        acc[r.brand].qty += r.total_qty;
        acc[r.brand].value += r.total_value;
        return acc;
      }, {});

      // Stock ownership cannot be inferred from unrelated invoice proportions.
      const kachaStockValue = null, pakkaStockValue = null;
      const effectiveTotalValue = grandTotalValue;
      return NextResponse.json({
        metadata,
        tab,
        category,
        bill_type: billType ?? "all",
        fgRows,
        rmRows,
        rows: fgRows, // fallback for legacy table binding
        summary: {
          totalQty: grandTotalQty,
          totalValue: effectiveTotalValue,
          grandTotalValue,
          pakkaStockValue,
          kachaStockValue,
          totalFGQty,
          totalFGValue,
          totalRMQty,
          totalRMValue,
          totalAccQty,
          totalAccValue,
          totalDesigns: fgRows.length,
          totalRMTypes: rmRows.length,
        },
        brandBreakdown,
      });
    }

    // ── TAB: WAREHOUSE ──
    if (tab === "warehouse") {
      const godownMap: Record<string, {
        id: string; name: string; address?: string; code?: string;
        fg_qty: number; fg_value: number;
        rm_qty: number; rm_value: number;
        acc_qty: number; acc_value: number;
        qty: number; value: number; raw_quantities?: Record<string, number>; accessory_quantities?: Record<string, number>;
      }> = {};

      // Seed all active godowns from Master Data
      godownsList.forEach((g: any) => {
        godownMap[g.id] = {
          id: g.id,
          name: g.name,
          address: g.address ?? "Main Facility",
          code: g.code ?? "GDW",
          fg_qty: 0, fg_value: 0,
          rm_qty: 0, rm_value: 0,
          acc_qty: 0, acc_value: 0,
          qty: 0, value: 0,
        };
      });

      // Add finished goods stock to godown map
      finishedItems.forEach((s: any) => {
        const gid = s.godown_id ?? "no_godown";
        const gName = s.godown?.name ?? "Main Godown";
        if (!godownMap[gid]) {
          godownMap[gid] = {
            id: gid, name: gName, address: "Facility", code: "GDW",
            fg_qty: 0, fg_value: 0, rm_qty: 0, rm_value: 0, acc_qty: 0, acc_value: 0, qty: 0, value: 0,
          };
        }
        godownMap[gid].fg_qty += s.qty;
        godownMap[gid].fg_value += s.val;
        godownMap[gid].qty += s.qty;
        godownMap[gid].value += s.val;
      });

      // Add raw material stock to godown map
      rawItems.forEach((r: any) => {
        const gid = r.godown_id ?? "no_godown";
        const gName = r.godown?.name ?? "Main Godown";
        if (!godownMap[gid]) {
          godownMap[gid] = {
            id: gid, name: gName, address: "Facility", code: "GDW",
            fg_qty: 0, fg_value: 0, rm_qty: 0, rm_value: 0, acc_qty: 0, acc_value: 0, qty: 0, value: 0,
          };
        }
        if (r.isAcc) {
          godownMap[gid].acc_qty += r.qty;
          godownMap[gid].acc_value += r.val;
        } else {
          godownMap[gid].rm_qty += r.qty;
          godownMap[gid].rm_value += r.val;
        }
        const unit = (r.material_type?.unit || "Unknown unit").trim().toLowerCase();
        const quantities = r.isAcc ? (godownMap[gid].accessory_quantities ||= {}) : (godownMap[gid].raw_quantities ||= {});
        quantities[unit] = (quantities[unit] || 0) + r.qty;
        godownMap[gid].qty += r.qty;
        godownMap[gid].value += r.val;
      });

      const rows = Object.values(godownMap).map(row => ({ ...row, rm_qty: Object.keys(row.raw_quantities || {}).length > 1 ? null : row.rm_qty, acc_qty: Object.keys(row.accessory_quantities || {}).length > 1 ? null : row.acc_qty, qty: null })).sort((a, b) => b.value - a.value);

      return NextResponse.json({
        metadata,
        tab,
        category,
        rows,
        summary: {
          totalQty: grandTotalQty,
          totalValue: grandTotalValue,
          totalGodowns: rows.length,
          totalFGQty,
          totalRMQty,
          totalAccQty,
        },
      });
    }

    // ── TAB: DESIGN ──
    if (tab === "design") {
      const rows = finishedItems.map((s: any) => ({
        id: s.id,
        design_id: s.design_id,
        design_name: s.design?.name ?? "—",
        design_number: s.design?.design_number ?? "—",
        brand: s.brandName,
        colour: s.colour?.colour_name ?? "—",
        godown: s.godown?.name ?? "Main Godown",
        quantity: s.qty,
        cost_per_piece: s.unitCost,
        value: s.val,
        size_quantities: s.size_quantities,
        valuation_status: s.qty > 0 && s.val <= 0 ? "Missing cost" : "Recorded",
      }));

      return NextResponse.json({
        metadata,
        tab,
        category,
        rows,
        summary: {
          totalQty: totalFGQty,
          totalValue: totalFGValue,
          totalItems: rows.length,
        },
      });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (err: any) {
    console.error("[reports/inventory]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
