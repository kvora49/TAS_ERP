import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const designId = searchParams.get("design_id");

  if (!designId) {
    return NextResponse.json({ error: "design_id parameter is required" }, { status: 400 });
  }

  try {
    // Fetch design details for sale_price
    const { data: design } = await supabase
      .from("designs")
      .select("id, sale_price")
      .eq("id", designId)
      .eq("business_id", businessId)
      .single();

    // 1. Fetch all production lots for this design
    const { data: lots, error: lotErr } = await supabase
      .from("production_lots")
      .select("id, lot_number, total_quantity, status, other_cost, accessory_cost")
      .eq("design_id", designId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (lotErr) {
      return NextResponse.json({ error: lotErr.message }, { status: 500 });
    }

    if (!lots || lots.length === 0) {
      // Fallback template if no lots exist yet
      return NextResponse.json({
        has_lots: false,
        fabric_items: [],
        trims_items: [],
        process_items: [],
        overheads: { wastage_percent: 0, freight_per_piece: 0, overhead_percent: 0 },
        profit_margin_percent: design?.sale_price ? 20 : 0,
      });
    }

    const lotIds = lots.map((l) => l.id);
    const totalLotQty = lots.reduce((sum, l) => sum + Number(l.total_quantity || 0), 0) || 1;
    const totalOtherCost = lots.reduce((sum, l) => sum + Number(l.other_cost || 0), 0);
    const derivedFreightPerPiece = (totalLotQty > 0 && totalOtherCost > 0)
      ? Number((totalOtherCost / totalLotQty).toFixed(2))
      : 0;

    // 2. Fetch Fabric allocations from lot_rolls
    const { data: lotRolls } = await supabase
      .from("lot_rolls")
      .select(`
        allocated_meters,
        purchase_roll:purchase_rolls (
          id,
          purchase_item:raw_material_purchase_items (
            rate,
            material_type:raw_material_types (id, name, unit)
          )
        )
      `)
      .in("lot_id", lotIds)
      .eq("business_id", businessId);

    const fabricMap = new Map<string, { fabric_name: string; consumption: number; unit: string; rate: number }>();
    (lotRolls || []).forEach((lr: any) => {
      const pItem = lr.purchase_roll?.purchase_item;
      const matType = pItem?.material_type;
      const matName = matType?.name || "Main Body Fabric";
      const unit = matType?.unit || "mtr";
      const rate = Number(pItem?.rate || 0);
      const allocated = Number(lr.allocated_meters || 0);

      const existing = fabricMap.get(matName) || { fabric_name: matName, consumption: 0, unit, rate };
      existing.consumption += allocated;
      if (rate > 0) existing.rate = rate;
      fabricMap.set(matName, existing);
    });

    const fabric_items = Array.from(fabricMap.values()).map((f, idx) => {
      const consumptionPerPiece = Number((f.consumption / totalLotQty).toFixed(2)) || 1;
      const rate = f.rate || 150;
      return {
        id: (idx + 1).toString(),
        fabric_name: f.fabric_name,
        consumption: consumptionPerPiece,
        unit: f.unit,
        rate,
        total: Number((consumptionPerPiece * rate).toFixed(2)),
      };
    });

    // 3. Fetch Accessories allocations from production_lot_accessories
    const { data: lotAccessories } = await supabase
      .from("production_lot_accessories")
      .select("item_name, unit, allocated_qty, unit_rate")
      .in("lot_id", lotIds)
      .eq("business_id", businessId);

    const trimMap = new Map<string, { trim_name: string; quantity: number; rate: number }>();
    (lotAccessories || []).forEach((acc: any) => {
      const trimName = acc.item_name || "Accessory Item";
      const qty = Number(acc.allocated_qty || 0);
      const rate = Number(acc.unit_rate || 0);

      const existing = trimMap.get(trimName) || { trim_name: trimName, quantity: 0, rate };
      existing.quantity += qty;
      if (rate > 0) existing.rate = rate;
      trimMap.set(trimName, existing);
    });

    const trims_items = Array.from(trimMap.values()).map((t, idx) => {
      const qtyPerPiece = Number((t.quantity / totalLotQty).toFixed(2)) || 1;
      const rate = t.rate || 10;
      return {
        id: (idx + 1).toString(),
        trim_name: t.trim_name,
        quantity: qtyPerPiece,
        rate,
        total: Number((qtyPerPiece * rate).toFixed(2)),
      };
    });

    // 4. Fetch Labor Operations & Stage Entries with Wastage Tracking
    const { data: lotStages } = await supabase
      .from("lot_production_stages")
      .select("id, stage_name, stage_type, sequence_no")
      .in("lot_id", lotIds)
      .eq("business_id", businessId)
      .order("sequence_no", { ascending: true });

    const { data: stageEntries } = await supabase
      .from("stage_entries")
      .select("lot_stage_id, job_work_rate, worker_type, qty_in, qty_out, wastage_qty, wastage_percent, total_job_work_amount")
      .in("lot_id", lotIds)
      .eq("business_id", businessId);

    let totalWastageQty = 0;
    let totalQtyIn = 0;
    let recordedWastagePercents: number[] = [];

    (stageEntries || []).forEach((se: any) => {
      const wQty = Number(se.wastage_qty || 0);
      const qIn = Number(se.qty_in || 0);
      const wPct = Number(se.wastage_percent || 0);

      if (wQty > 0) totalWastageQty += wQty;
      if (qIn > 0) totalQtyIn += qIn;
      if (wPct > 0) recordedWastagePercents.push(wPct);
    });

    let derivedWastagePercent = 0;
    if (totalQtyIn > 0 && totalWastageQty > 0) {
      derivedWastagePercent = Number(((totalWastageQty / totalQtyIn) * 100).toFixed(2));
    } else if (recordedWastagePercents.length > 0) {
      derivedWastagePercent = Number((recordedWastagePercents.reduce((a, b) => a + b, 0) / recordedWastagePercents.length).toFixed(2));
    }

    const normalizeStageName = (name: string) => name.trim().toLowerCase();
    const formatStageDisplay = (name: string) => {
      const trimmed = name.trim();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    };

    const stageIdToKeyMap = new Map<string, string>();
    const normalizedStageMap = new Map<
      string,
      {
        display_name: string;
        worker_type: string;
        total_amount: number;
        total_qty_out: number;
        rates: number[];
        min_sequence: number;
      }
    >();

    (lotStages || []).forEach((stg: any) => {
      const rawName = stg.stage_name || "Unassigned";
      const key = normalizeStageName(rawName);
      stageIdToKeyMap.set(stg.id, key);

      if (!normalizedStageMap.has(key)) {
        normalizedStageMap.set(key, {
          display_name: formatStageDisplay(rawName),
          worker_type: stg.stage_type === "in_house" ? "In-House" : "Contractor",
          total_amount: 0,
          total_qty_out: 0,
          rates: [],
          min_sequence: stg.sequence_no ?? 999,
        });
      }
    });

    (stageEntries || []).forEach((se: any) => {
      const key = se.lot_stage_id ? stageIdToKeyMap.get(se.lot_stage_id) : null;
      if (key && normalizedStageMap.has(key)) {
        const info = normalizedStageMap.get(key)!;
        const rate = Number(se.job_work_rate || 0);
        const qtyOut = Number(se.qty_out || 0);
        const laborAmount = Number(se.total_job_work_amount || (qtyOut * rate));

        info.total_amount += laborAmount;
        info.total_qty_out += qtyOut;
        if (rate > 0) info.rates.push(rate);
        if (se.worker_type) info.worker_type = se.worker_type;
      }
    });

    const sortedOperations = Array.from(normalizedStageMap.values()).sort(
      (a, b) => a.min_sequence - b.min_sequence
    );

    const process_items = sortedOperations.map((p, idx) => {
      let weightedRate = 0;
      if (p.total_qty_out > 0 && p.total_amount > 0) {
        weightedRate = p.total_amount / p.total_qty_out;
      } else if (p.rates.length > 0) {
        weightedRate = p.rates.reduce((a, b) => a + b, 0) / p.rates.length;
      } else {
        weightedRate = 15;
      }
      const rate_per_piece = Number(weightedRate.toFixed(2));
      return {
        id: (idx + 1).toString(),
        process_name: p.display_name,
        worker_type: p.worker_type,
        rate_per_piece,
        total: rate_per_piece,
      };
    });

    // Compute derived profit margin from sale_price and calculated BOM cost
    const totalFabric = fabric_items.reduce((acc, i) => acc + i.total, 0);
    const totalTrims = trims_items.reduce((acc, i) => acc + i.total, 0);
    const totalLabor = process_items.reduce((acc, i) => acc + i.total, 0);
    const rawSubtotal = totalFabric + totalTrims + totalLabor;
    const wastageAmt = (rawSubtotal * derivedWastagePercent) / 100;
    const overheadAmt = (rawSubtotal * 5) / 100;
    const estimatedTotalBomCost = rawSubtotal + wastageAmt + overheadAmt + derivedFreightPerPiece;

    let derivedProfitMarginPercent = 30;
    if (design?.sale_price && design.sale_price > estimatedTotalBomCost) {
      derivedProfitMarginPercent = Number((((design.sale_price - estimatedTotalBomCost) / design.sale_price) * 100).toFixed(2));
    }

    return NextResponse.json({
      has_lots: true,
      lot_count: lots.length,
      fabric_items,
      trims_items,
      process_items,
      overheads: {
        wastage_percent: derivedWastagePercent,
        freight_per_piece: derivedFreightPerPiece,
        overhead_percent: 5,
      },
      profit_margin_percent: derivedProfitMarginPercent,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}
