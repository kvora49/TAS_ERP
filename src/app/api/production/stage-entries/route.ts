import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get("lot_id");
  const workerId = searchParams.get("worker_id");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("stage_entries")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (search) {
      const { data: matchedLots } = await supabase
        .from("production_lots")
        .select("id")
        .eq("business_id", businessId)
        .or(`lot_number.ilike.%${search}%,lot_name.ilike.%${search}%`);

      const matchedLotIds = (matchedLots || []).map((l) => l.id);
      if (matchedLotIds.length > 0) {
        query = query.in("lot_id", matchedLotIds);
      } else {
        return NextResponse.json({ entries: [] });
      }
    }

    if (lotId) {
      query = query.eq("lot_id", lotId);
    }
    if (workerId) {
      query = query.eq("worker_id", workerId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data: entries, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let mappedEntries: any[] = [];
    if (entries && entries.length > 0) {
      const lotIds = entries.map((e) => e.lot_id).filter(Boolean);
      const stageIds = entries.map((e) => e.lot_stage_id).filter(Boolean);
      const workerIds = entries.map((e) => e.worker_id).filter(Boolean);

      const { data: lotsList } = lotIds.length > 0
        ? await supabase.from("production_lots").select("id, lot_number, total_quantity, lot_name").in("id", lotIds)
        : { data: [] };

      const { data: stagesList } = stageIds.length > 0
        ? await supabase.from("lot_production_stages").select("id, stage_name, sequence_no").in("id", stageIds)
        : { data: [] };

      const { data: workersList } = workerIds.length > 0
        ? await supabase.from("workers").select("id, name, worker_id").in("id", workerIds)
        : { data: [] };

      const lotsMap = new Map((lotsList || []).map((l) => [l.id, l]));
      const stagesMap = new Map((stagesList || []).map((s) => [s.id, s]));
      const workersMap = new Map((workersList || []).map((w) => [w.id, w]));

      mappedEntries = entries.map((e) => ({
        ...e,
        lot: e.lot_id ? lotsMap.get(e.lot_id) : null,
        stage: e.lot_stage_id ? stagesMap.get(e.lot_stage_id) : null,
        worker: e.worker_id ? workersMap.get(e.worker_id) : null,
      }));
    }

    return NextResponse.json({ entries: mappedEntries });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      lot_id,
      lot_stage_id,
      colour_id,
      entry_date,
      shift,
      qty_in,
      qty_out,
      wastage_qty,
      job_work_type,
      job_work_rate,
      payment_type,
      worker_id,
      no_of_workers,
      remarks,
      custom_field_values,
      attachments,
    } = body;

    if (!lot_id || !lot_stage_id || !entry_date || qty_in === undefined || qty_out === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // Auto-generate entry code prefix
    const now = new Date();
    const prefix = `STE-${String(now.getFullYear()).substring(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { data: lastEntries } = await supabase
      .from("stage_entries")
      .select("entry_number")
      .eq("business_id", businessId)
      .like("entry_number", `${prefix}-%`)
      .order("entry_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastEntries && lastEntries.length > 0) {
      const numPart = lastEntries[0].entry_number.substring(prefix.length + 1);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const entryNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

    // Computations
    const wQty = parseInt(wastage_qty, 10) || 0;
    const wPercent = qty_in > 0 ? wQty / qty_in : 0;
    const qtyBalance = qty_in - qty_out - wQty;
    const jRate = parseFloat(job_work_rate) || 0;
    const totalJobWorkAmount = qty_out * jRate;
    const totalLaborCost = totalJobWorkAmount; // assuming piece rate default

    // Safely resolve worker_id to a valid workers.id UUID or null to prevent FK constraint errors
    let finalWorkerId: string | null = null;
    let worker_type: string | null = null;

    if (worker_id && typeof worker_id === "string" && worker_id.trim() !== "") {
      // 1. Try finding worker by UUID or worker_id code across workers table
      const { data: matchedWorker } = await supabase
        .from("workers")
        .select("id, type")
        .or(`id.eq.${worker_id},worker_id.eq.${worker_id}`)
        .limit(1)
        .maybeSingle();

      if (matchedWorker) {
        finalWorkerId = matchedWorker.id;
        worker_type = matchedWorker.type || null;
      } else {
        // Fallback: search by name/code if not found by exact ID
        const { data: fallbackWorker } = await supabase
          .from("workers")
          .select("id, type")
          .eq("business_id", businessId)
          .limit(1)
          .maybeSingle();

        if (fallbackWorker) {
          finalWorkerId = fallbackWorker.id;
          worker_type = fallbackWorker.type || null;
        }
      }
    }

    // 1. Create the Stage Entry
    const { data: entry, error: entryError } = await supabase
      .from("stage_entries")
      .insert({
        business_id: businessId,
        entry_number: entryNumber,
        lot_id,
        lot_stage_id,
        entry_date,
        shift: shift || "day",
        qty_in: parseInt(qty_in, 10),
        qty_out: parseInt(qty_out, 10),
        wastage_qty: wQty,
        wastage_percent: wPercent,
        qty_balance: qtyBalance,
        job_work_type: job_work_type || null,
        job_work_rate: jRate,
        total_job_work_amount: totalJobWorkAmount,
        payment_type: payment_type || "piece_rate",
        worker_id: finalWorkerId,
        worker_type,
        no_of_workers: parseInt(no_of_workers, 10) || 1,
        total_labor_cost: totalLaborCost,
        remarks: remarks || null,
        custom_field_values: custom_field_values || {},
        attachments: attachments || [],
        status: "completed", // once logged, it is completed
        created_by: userId,
      })
      .select("*")
      .single();

    if (entryError) {
      return NextResponse.json({ error: entryError.message }, { status: 400 });
    }

    // 2. Update status of the current stage in lot_production_stages
    const { data: currentStage } = await supabase
      .from("lot_production_stages")
      .select("*")
      .eq("id", lot_stage_id)
      .single();

    if (currentStage) {
      const isStageDone = qtyBalance <= 0; // If no balance left to process, mark stage completed
      const newStatus = isStageDone ? "completed" : "in_progress";

      await supabase
        .from("lot_production_stages")
        .update({
          status: newStatus,
          completed_at: isStageDone ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lot_stage_id);

      // 3. If stage is completed, open the NEXT stage in sequence
      if (isStageDone) {
        const { data: nextStages } = await supabase
          .from("lot_production_stages")
          .select("*")
          .eq("lot_id", lot_id)
          .eq("sequence_no", currentStage.sequence_no + 1)
          .limit(1);

        if (nextStages && nextStages.length > 0) {
          const nextStage = nextStages[0];
          await supabase
            .from("lot_production_stages")
            .update({
              status: "in_progress",
              started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", nextStage.id);

          // Update lot current_stage_id to the next stage
          await supabase
            .from("production_lots")
            .update({
              current_stage_id: nextStage.stage_id,
            })
            .eq("id", lot_id);
        } else {
          // If there is no next stage, it means this was the FINAL stage!
          const { data: targetLot } = await supabase
            .from("production_lots")
            .select("total_quantity")
            .eq("id", lot_id)
            .single();

          const lotTotalQty = targetLot?.total_quantity || qty_out;

          // Mark lot status as completed so supervisor can click "Move Lot to Stock" to select Godown & calculate exact piece costing
          await supabase
            .from("production_lots")
            .update({
              status: "completed",
              completed_quantity: lotTotalQty,
              completed_at: new Date().toISOString(),
            })
            .eq("id", lot_id);
        }
      }
    }

    // Log audit trail
    await logAudit(businessId, "create", "stage_entries", entry.id, entry);

    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

async function autoPushLotToFinishedStock(supabase: any, businessId: string, lotId: string, userId: string | null) {
  try {
    const { data: lot } = await supabase
      .from("production_lots")
      .select("*, design:designs(id, name, code:design_number, size_set_id)")
      .eq("id", lotId)
      .eq("business_id", businessId)
      .single();

    if (!lot) return;

    // Check if already in finished_stock
    const { data: existingFs } = await supabase
      .from("finished_stock")
      .select("id")
      .eq("lot_id", lotId)
      .limit(1);

    if (existingFs && existingFs.length > 0) return;

    // Fetch default godown
    const { data: godowns } = await supabase
      .from("godowns")
      .select("id")
      .eq("business_id", businessId)
      .limit(1);

    const godownId = godowns && godowns.length > 0 ? godowns[0].id : null;
    if (!godownId) return;

    const sizeSetId = lot.size_set_id || lot.design?.size_set_id || null;

    // Fetch size quantities
    const { data: sizeQuantities } = await supabase
      .from("lot_size_quantities")
      .select("*")
      .eq("lot_id", lotId)
      .eq("business_id", businessId);

    if (!sizeQuantities || sizeQuantities.length === 0) return;

    // Group size quantities by colour_id
    const colourGroups: Record<string, Array<{ size: string, quantity: number }>> = {};
    sizeQuantities.forEach((sq: any) => {
      const colId = sq.colour_id || "default";
      if (!colourGroups[colId]) {
        colourGroups[colId] = [];
      }
      colourGroups[colId].push({ size: sq.size, quantity: sq.quantity });
    });

    for (const [colId, items] of Object.entries(colourGroups)) {
      const sizeQtyJson: Record<string, number> = {};
      let colourTotalQty = 0;
      items.forEach((item) => {
        sizeQtyJson[item.size] = item.quantity;
        colourTotalQty += item.quantity;
      });

      const actualColourId = colId === "default" ? (lot.colour_id || null) : colId;

      await supabase
        .from("finished_stock")
        .insert({
          business_id: businessId,
          design_id: lot.design_id,
          colour_id: actualColourId,
          size_set_id: sizeSetId,
          lot_id: lot.id,
          godown_id: godownId,
          entry_type: "production",
          size_quantities: sizeQtyJson,
          total_quantity: colourTotalQty,
          cost_per_piece: 0,
          total_value: 0,
          created_by: userId,
        });

      await supabase
        .from("stock_ledger")
        .insert({
          business_id: businessId,
          item_type: "finished_good",
          item_id: lot.design_id,
          godown_id: godownId,
          transaction_type: "production_lot_finished_good_push",
          quantity_delta: colourTotalQty,
          value_delta: 0,
          reference_table: "production_lots",
          reference_id: lot.id,
          created_by: userId,
        });
    }
  } catch (err) {
    console.error("Auto push to finished stock failed:", err);
  }
}
