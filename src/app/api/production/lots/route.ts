import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { onProductionLotCreated } from "@/lib/calendar-integration";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const brandId = searchParams.get("brand_id");
  const designId = searchParams.get("design_id");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const workerId = searchParams.get("worker_id");
  const workerLotStatus = searchParams.get("worker_lot_status"); // 'all' | 'working' | 'completed'
  const paymentStatus = searchParams.get("payment_status"); // 'all' | 'paid' | 'unpaid'
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("production_lots")
      .select(`
        *,
        brand:brands(id, name),
        design:designs(id, name, code:design_number),
        colour:design_colours(id, colour_name, hex_code:colour_hex),
        size_set:size_sets(id, name, sizes)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (brandId && brandId !== "all") {
      query = query.eq("brand_id", brandId);
    }
    if (designId && designId !== "all") {
      query = query.eq("design_id", designId);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("lot_date", startDate);
    }
    if (endDate) {
      query = query.lte("lot_date", endDate);
    }

    if (search) {
      query = query.or(`lot_number.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    const { data: lots, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let allLots = lots || [];

    // Load related data for lot calculation & worker/payment filtering across all lots
    const allLotIds = allLots.map((l) => l.id);
    let stageEntriesMap = new Map<string, any[]>();
    let lotStagesMap = new Map<string, any[]>();
    let lotStageWorkersMap = new Map<string, any[]>(); // lot_stage_id -> workerIds

    if (allLotIds.length > 0) {
      const [{ data: seData }, { data: lpsData }] = await Promise.all([
        supabase
          .from("stage_entries")
          .select("id, lot_id, lot_stage_id, worker_id, status, payment_status, total_job_work_amount, paid_amount, entry_date, created_at")
          .in("lot_id", allLotIds)
          .eq("business_id", businessId),
        supabase
          .from("lot_production_stages")
          .select("id, lot_id, status, started_at, completed_at, created_at")
          .in("lot_id", allLotIds)
          .eq("business_id", businessId),
      ]);

      (seData || []).forEach((se) => {
        if (!stageEntriesMap.has(se.lot_id)) stageEntriesMap.set(se.lot_id, []);
        stageEntriesMap.get(se.lot_id)!.push(se);
      });

      const allStageIds: string[] = [];
      (lpsData || []).forEach((lps) => {
        if (!lotStagesMap.has(lps.lot_id)) lotStagesMap.set(lps.lot_id, []);
        lotStagesMap.get(lps.lot_id)!.push(lps);
        allStageIds.push(lps.id);
      });

      if (allStageIds.length > 0) {
        const { data: lswData } = await supabase
          .from("lot_stage_workers")
          .select("lot_stage_id, worker_id")
          .in("lot_stage_id", allStageIds)
          .eq("business_id", businessId);

        (lswData || []).forEach((lsw) => {
          if (!lotStageWorkersMap.has(lsw.lot_stage_id)) lotStageWorkersMap.set(lsw.lot_stage_id, []);
          lotStageWorkersMap.get(lsw.lot_stage_id)!.push(lsw.worker_id);
        });
      }
    }

    // Attach calculated duration metrics & payment status to each lot
    const lotsWithCalculations = allLots.map((lot) => {
      const entries = stageEntriesMap.get(lot.id) || [];
      const stages = lotStagesMap.get(lot.id) || [];

      // Workers associated with this lot
      const workerIdsSet = new Set<string>();
      entries.forEach((e) => { if (e.worker_id) workerIdsSet.add(e.worker_id); });
      stages.forEach((s) => {
        const sws = lotStageWorkersMap.get(s.id) || [];
        sws.forEach((wId) => workerIdsSet.add(wId));
      });

      // 1. Payment status calculation
      const totalLaborCost = entries.reduce((sum, e) => sum + (Number(e.total_job_work_amount) || 0), 0);
      const totalPaidAmount = entries.reduce((sum, e) => sum + (Number(e.paid_amount) || 0), 0);

      let lotPaymentStatus: "paid" | "unpaid" | "partial" | "none" = "none";
      if (entries.length > 0 && totalLaborCost > 0) {
        if (totalPaidAmount >= totalLaborCost) {
          lotPaymentStatus = "paid";
        } else if (totalPaidAmount > 0) {
          lotPaymentStatus = "partial";
        } else {
          lotPaymentStatus = "unpaid";
        }
      }

      // 2. Duration Tracking Calculation
      // Find work start timestamp
      let startTimestamps: number[] = [];
      stages.forEach((s) => {
        if (s.started_at) startTimestamps.push(new Date(s.started_at).getTime());
        if (s.created_at) startTimestamps.push(new Date(s.created_at).getTime());
      });
      entries.forEach((e) => {
        if (e.entry_date) startTimestamps.push(new Date(e.entry_date).getTime());
        else if (e.created_at) startTimestamps.push(new Date(e.created_at).getTime());
      });
      if (lot.target_start_date) startTimestamps.push(new Date(lot.target_start_date).getTime());
      if (lot.lot_date) startTimestamps.push(new Date(lot.lot_date).getTime());
      if (lot.created_at) startTimestamps.push(new Date(lot.created_at).getTime());

      const earliestStart = startTimestamps.length > 0 ? Math.min(...startTimestamps) : new Date(lot.created_at).getTime();

      let daysInWorkingStage = 0;
      let daysTakenToComplete: number | null = null;

      const msPerDay = 1000 * 60 * 60 * 24;

      if (lot.status === "in_progress" || lot.status === "on_hold") {
        const diffMs = Math.max(0, Date.now() - earliestStart);
        daysInWorkingStage = Math.max(1, Math.ceil(diffMs / msPerDay));
      } else if (lot.status === "completed") {
        let endTimestamps: number[] = [];
        if (lot.completed_at) endTimestamps.push(new Date(lot.completed_at).getTime());
        stages.forEach((s) => {
          if (s.completed_at) endTimestamps.push(new Date(s.completed_at).getTime());
        });
        entries.forEach((e) => {
          if (e.created_at) endTimestamps.push(new Date(e.created_at).getTime());
        });
        const completionTime = endTimestamps.length > 0 ? Math.max(...endTimestamps) : Date.now();
        const diffMs = Math.max(0, completionTime - earliestStart);
        const days = Math.max(1, Math.ceil(diffMs / msPerDay));
        daysInWorkingStage = days;
        daysTakenToComplete = days;
      }

      return {
        ...lot,
        days_in_working_stage: daysInWorkingStage,
        days_taken_to_complete: daysTakenToComplete,
        lot_payment_status: lotPaymentStatus,
        total_labor_cost: totalLaborCost,
        total_paid_amount: totalPaidAmount,
        worker_ids: Array.from(workerIdsSet),
        entries_summary: entries,
        stages_summary: stages,
      };
    });

    // Apply search filter
    let filteredLots = lotsWithCalculations;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLots = filteredLots.filter(
        (lot) =>
          lot.lot_number.toLowerCase().includes(searchLower) ||
          (lot.design?.name && lot.design.name.toLowerCase().includes(searchLower)) ||
          (lot.design?.code && lot.design.code.toLowerCase().includes(searchLower))
      );
    }

    // Apply Worker Filter
    if (workerId && workerId !== "all") {
      filteredLots = filteredLots.filter((lot) => lot.worker_ids.includes(workerId));
    }

    // Apply Worker Lot Status Filter
    if (workerLotStatus && workerLotStatus !== "all") {
      if (workerLotStatus === "working") {
        filteredLots = filteredLots.filter((lot) => {
          if (lot.status !== "in_progress") return false;
          if (!workerId || workerId === "all") return true;
          // Check if selected worker is actively working
          const activeEntry = lot.entries_summary.some((e: any) => e.worker_id === workerId && e.status !== "completed");
          const activeStage = lot.stages_summary.some((s: any) => {
            const sws = lotStageWorkersMap.get(s.id) || [];
            return sws.includes(workerId) && s.status !== "completed";
          });
          return activeEntry || activeStage || lot.worker_ids.includes(workerId);
        });
      } else if (workerLotStatus === "completed") {
        filteredLots = filteredLots.filter((lot) => {
          if (!workerId || workerId === "all") return lot.status === "completed";
          const workerCompletedEntry = lot.entries_summary.some((e: any) => e.worker_id === workerId && e.status === "completed");
          const workerCompletedStage = lot.stages_summary.some((s: any) => {
            const sws = lotStageWorkersMap.get(s.id) || [];
            return sws.includes(workerId) && s.status === "completed";
          });
          return lot.status === "completed" || workerCompletedEntry || workerCompletedStage;
        });
      }
    }

    // Apply Payment Status Filter
    if (paymentStatus && paymentStatus !== "all") {
      if (paymentStatus === "paid") {
        filteredLots = filteredLots.filter((lot) => lot.lot_payment_status === "paid");
      } else if (paymentStatus === "unpaid") {
        filteredLots = filteredLots.filter((lot) => lot.lot_payment_status === "unpaid" || lot.lot_payment_status === "partial");
      }
    }

    const total = filteredLots.length;
    const paginatedLots = filteredLots.slice(offset, offset + limit);

    // For each lot, load its size quantities and unique colours
    const lotIds = paginatedLots.map((l) => l.id);
    let sizeQuantities: any[] = [];
    const finishedStockLotIds = new Set<string>();
    if (lotIds.length > 0) {
      const { data: sqData } = await supabase
        .from("lot_size_quantities")
        .select("*, colour:design_colours(id, colour_name, hex_code:colour_hex)")
        .in("lot_id", lotIds)
        .eq("business_id", businessId);
      sizeQuantities = sqData || [];

      const { data: fsData } = await supabase
        .from("finished_stock")
        .select("lot_id")
        .in("lot_id", lotIds)
        .eq("business_id", businessId);
      if (fsData) {
        fsData.forEach((f) => { if (f.lot_id) finishedStockLotIds.add(f.lot_id); });
      }
    }

    const lotsWithSizes = paginatedLots.map((lot) => {
      const sizes = sizeQuantities.filter((sq) => sq.lot_id === lot.id);
      const colourMap = new Map();
      if (lot.colour) colourMap.set(lot.colour.id || "default", lot.colour);
      sizes.forEach((sq: any) => {
        if (sq.colour) colourMap.set(sq.colour.id, sq.colour);
      });
      const colours = Array.from(colourMap.values());
      const effectiveSizeSet = lot.size_set || lot.design?.size_set || null;

      const effectiveCompletedQty =
        lot.status === "completed"
          ? (lot.completed_quantity || lot.total_quantity || 0)
          : (lot.completed_quantity || 0);

      const { entries_summary, stages_summary, worker_ids, ...lotClean } = lot;

      return {
        ...lotClean,
        completed_quantity: effectiveCompletedQty,
        size_set: effectiveSizeSet,
        colours,
        sizes,
        is_moved_to_stock: finishedStockLotIds.has(lot.id),
      };
    });

    return NextResponse.json({
      data: lotsWithSizes,
      meta: {
        page,
        limit,
        total
      }
    });
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
      lot_number,
      brand_id,
      design_id,
      colour_id,
      size_set_id,
      lot_date,
      season,
      buyer_order_ref,
      target_start_date,
      target_dispatch_date,
      target_due_date,
      priority,
      notes,
      internal_notes,
      customer_ref,
      po_date,
      total_quantity,
      allow_rework,
      garment_type_id,
      design_type,
      lot_name,
      allocated_rolls,       // array of { purchase_roll_id, allocated_meters }
      allocated_accessories, // array of { purchase_item_id, allocated_qty } — OPTIONAL
      specifications,        // object of { additional_details, design_reference_text, design_reference_photos, custom_qa }
      spec_sheet,            // object of { template_id, spec_values }
      sizes,   // array of { size, quantity, colour_id }
      stages,  // array of { stage_id, stage_name, stage_type, sequence_no, is_mandatory, worker_ids }
    } = body;

    if (!lot_number || !brand_id || !design_id || !lot_date || !total_quantity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { getBusinessServerSettings } = await import("@/lib/settings/serverSettings");
    const serverSettings = await getBusinessServerSettings(supabase, businessId);

    if (!serverSettings.allow_back_date_production) {
      const inputDate = new Date(lot_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (inputDate < today) {
        return NextResponse.json(
          { error: "Back-dated production entries are disabled in system settings." },
          { status: 400 }
        );
      }
    }

    // Default stage flow from business settings if no custom stages provided
    let effectiveStages = stages;
    if (!effectiveStages || !Array.isArray(effectiveStages) || effectiveStages.length === 0) {
      const { data: dbStages } = await supabase
        .from("production_stages")
        .select("id, name, is_active")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (dbStages && dbStages.length > 0) {
        effectiveStages = dbStages.map((s, idx) => ({
          stage_id: s.id,
          stage_name: s.name,
          sequence_no: idx + 1,
          is_mandatory: true,
        }));
      }
    }

    // Check if lot_number already exists
    let finalLotNumber = lot_number;
    let isUnique = false;
    let increment = 0;

    while (!isUnique && increment < 100) {
      const { data: check } = await supabase
        .from("production_lots")
        .select("id")
        .eq("business_id", businessId)
        .eq("lot_number", finalLotNumber)
        .maybeSingle();

      if (!check) {
        isUnique = true;
      } else {
        const now = new Date();
        const yy = String(now.getFullYear()).substring(2);
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const prefix = `LOT-${yy}-${mm}`;

        const { data: lots } = await supabase
          .from("production_lots")
          .select("lot_number")
          .eq("business_id", businessId)
          .like("lot_number", `${prefix}-%`);

        let nextNum = 1;
        if (lots && lots.length > 0) {
          const nums = lots.map((l) => {
            if (!l.lot_number) return 0;
            const numPart = l.lot_number.substring(prefix.length + 1);
            const parsed = parseInt(numPart, 10);
            return isNaN(parsed) ? 0 : parsed;
          });
          const maxNum = Math.max(...nums, 0);
          nextNum = maxNum + 1 + increment;
        } else {
          nextNum = 1 + increment;
        }
        finalLotNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`;
        increment++;
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    let finalSizeSetId = size_set_id || null;
    if (!finalSizeSetId && design_id) {
      const { data: d } = await supabase
        .from("designs")
        .select("size_set_id")
        .eq("id", design_id)
        .maybeSingle();
      if (d?.size_set_id) {
        finalSizeSetId = d.size_set_id;
      }
    }

    // 1. Create the production lot
    const { data: lot, error: lotError } = await supabase
      .from("production_lots")
      .insert({
        business_id: businessId,
        lot_number: finalLotNumber.toLowerCase(),
        brand_id,
        design_id,
        colour_id: colour_id || null,
        size_set_id: finalSizeSetId,
        lot_date,
        season: season || null,
        buyer_order_ref: buyer_order_ref || null,
        target_start_date: target_start_date || null,
        target_dispatch_date: target_dispatch_date || null,
        target_due_date: target_due_date || null,
        priority: priority || "normal",
        total_quantity: parseInt(total_quantity, 10),
        completed_quantity: 0,
        status: "draft",
        allow_rework: !!allow_rework,
        notes: notes || null,
        internal_notes: internal_notes || null,
        customer_ref: customer_ref || null,
        po_date: po_date || null,
        created_by: userId,
        garment_type_id: garment_type_id || null,
        design_type: design_type || null,
        lot_name: lot_name || null,
      })
      .select("*")
      .single();

    if (lotError) {
      return NextResponse.json({ error: lotError.message }, { status: 400 });
    }

    // Force update the lot_number to finalLotNumber to override trigger behavior
    if (lot && lot.lot_number !== finalLotNumber) {
      await supabase
        .from("production_lots")
        .update({ lot_number: finalLotNumber })
        .eq("id", lot.id);
      lot.lot_number = finalLotNumber;
    }

    // 2. Insert size quantities
    if (sizes && sizes.length > 0) {
      const sizesToInsert = sizes.map((s: any) => ({
        business_id: businessId,
        lot_id: lot.id,
        size: s.size,
        quantity: parseInt(s.quantity, 10) || 0,
        colour_id: s.colour_id || null,
      }));

      const { error: sizesError } = await supabase
        .from("lot_size_quantities")
        .insert(sizesToInsert);

      if (sizesError) {
        return NextResponse.json({ error: `Lot created, but sizes failed: ${sizesError.message}` }, { status: 400 });
      }
    }

    // 3. Insert lot production stages
    if (stages && stages.length > 0) {
      const stagesToInsert = stages.map((s: any) => ({
        business_id: businessId,
        lot_id: lot.id,
        stage_id: s.stage_id,
        stage_name: s.stage_name,
        stage_type: s.stage_type || "in_house",
        sequence_no: parseInt(s.sequence_no, 10),
        is_mandatory: s.is_mandatory !== false,
        status: "pending",
      }));

      const { data: dbStages, error: stagesError } = await supabase
        .from("lot_production_stages")
        .insert(stagesToInsert)
        .select();

      if (stagesError || !dbStages) {
        return NextResponse.json({ error: `Lot created, but stages failed: ${stagesError?.message || "No data returned"}` }, { status: 400 });
      }

      // Insert assigned workers into lot_stage_workers join table
      const workersToInsert: any[] = [];
      dbStages.forEach((dbStage) => {
        const inputStage = stages.find((s: any) => s.stage_id === dbStage.stage_id);
        if (inputStage && Array.isArray(inputStage.worker_ids) && inputStage.worker_ids.length > 0) {
          inputStage.worker_ids.forEach((workerId: string) => {
            workersToInsert.push({
              business_id: businessId,
              lot_stage_id: dbStage.id,
              worker_id: workerId,
            });
          });
        }
      });

      if (workersToInsert.length > 0) {
        const { error: workersError } = await supabase
          .from("lot_stage_workers")
          .insert(workersToInsert);
        if (workersError) {
          return NextResponse.json({ error: `Lot created, but stage workers assignment failed: ${workersError.message}` }, { status: 400 });
        }
      }

      // Automatically set current_stage_id of lot to the first stage
      const firstStage = stages.find((s: any) => s.sequence_no === 1);
      if (firstStage) {
        const dbFirstStage = dbStages.find((s: any) => s.sequence_no === 1);
        if (dbFirstStage) {
          await supabase
            .from("production_lots")
            .update({
              current_stage_id: firstStage.stage_id,
              status: "in_progress",
            })
            .eq("id", lot.id);
            
          await supabase
            .from("lot_production_stages")
            .update({
              status: "in_progress",
              started_at: new Date().toISOString(),
            })
            .eq("id", dbFirstStage.id);
        }
      }
    }

    // 4. Insert lot rolls allocation & deduct remaining meters
    if (allocated_rolls && allocated_rolls.length > 0) {
      const lotRollsToInsert = allocated_rolls.map((r: any) => ({
        business_id: businessId,
        lot_id: lot.id,
        purchase_roll_id: r.purchase_roll_id,
        allocated_meters: Number(r.allocated_meters),
        colour_id: r.colour_id || null,
      }));

      let { error: lrError } = await supabase
        .from("lot_rolls")
        .insert(lotRollsToInsert);

      if (lrError && lrError.message?.includes("colour_id")) {
        const lotRollsFallback = allocated_rolls.map((r: any) => ({
          business_id: businessId,
          lot_id: lot.id,
          purchase_roll_id: r.purchase_roll_id,
          allocated_meters: Number(r.allocated_meters),
        }));
        const { error: fbError } = await supabase
          .from("lot_rolls")
          .insert(lotRollsFallback);
        lrError = fbError;
      }

      if (lrError) {
        return NextResponse.json({ error: `Lot created, but roll allocation mapping failed: ${lrError.message}` }, { status: 400 });
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Loop over allocations to update database and stock ledger
      for (const r of allocated_rolls) {
        const { purchase_roll_id, allocated_meters } = r;

        // Fetch original roll details
        const { data: roll, error: rollError } = await supabase
          .from("purchase_rolls")
          .select(`
            *,
            item:raw_material_purchase_items (
              material_type_id,
              rate,
              purchase:raw_material_purchases (godown_id)
            )
          `)
          .eq("id", purchase_roll_id)
          .eq("business_id", businessId)
          .single();

        if (rollError || !roll) {
          throw new Error(`Failed to find roll ${purchase_roll_id}: ${rollError?.message || "Not found"}`);
        }

        const nextRemaining = Math.max(0, Number(roll.remaining_meters || 0) - Number(allocated_meters));

        // Update purchase roll remaining meters
        const { error: updateError } = await supabase
          .from("purchase_rolls")
          .update({ remaining_meters: nextRemaining })
          .eq("id", purchase_roll_id);

        if (updateError) {
          throw new Error(`Failed to update roll ${purchase_roll_id}: ${updateError.message}`);
        }

        // Write negative stock delta to stock_ledger
        const rate = Number(roll.item?.rate || 0);
        const valDelta = Number(allocated_meters) * rate;

        const { error: ledgerError } = await supabase
          .from("stock_ledger")
          .insert({
            business_id: businessId,
            item_type: 'raw_material',
            item_id: roll.item?.material_type_id,
            godown_id: roll.item?.purchase?.godown_id,
            transaction_type: 'production_lot_allocation',
            quantity_delta: -Number(allocated_meters),
            value_delta: -valDelta,
            reference_table: 'production_lots',
            reference_id: lot.id,
            created_by: user?.id || null,
          });

        if (ledgerError) {
          throw new Error(`Failed to write stock ledger for roll ${purchase_roll_id}: ${ledgerError.message}`);
        }

        // Deduct from raw_material_current_stock
        const godownId = roll.item?.purchase?.godown_id;
        const matTypeId = roll.item?.material_type_id;
        if (godownId && matTypeId) {
          const { data: stockEntry } = await supabase
            .from("raw_material_current_stock")
            .select("*")
            .eq("business_id", businessId)
            .eq("material_type_id", matTypeId)
            .eq("godown_id", godownId)
            .maybeSingle();

          if (stockEntry) {
            const updatedQty = Math.max(0, Number(stockEntry.current_stock || 0) - Number(allocated_meters));
            const updatedValue = Math.max(0, Number(stockEntry.stock_value || 0) - valDelta);
            const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stockEntry.unit_cost || 0);

            await supabase
              .from("raw_material_current_stock")
              .update({
                current_stock: updatedQty,
                stock_value: updatedValue,
                unit_cost: updatedUnitCost,
                last_updated_at: new Date().toISOString(),
              })
              .eq("id", stockEntry.id);
          }
        }
      }

      try {
        const { reconcileRawMaterialStock } = await import("@/lib/stock-reconciliation");
        await reconcileRawMaterialStock(supabase, businessId);
      } catch (recErr) {
        console.warn("Reconciliation on roll allocation warning:", recErr);
      }
    }

    // 5. Insert accessory allocations (optional)
    if (allocated_accessories && Array.isArray(allocated_accessories) && allocated_accessories.length > 0) {
      const { data: { user: accUser } } = await supabase.auth.getUser();

      for (const acc of allocated_accessories) {
        const { purchase_item_id, allocated_qty } = acc;
        if (!purchase_item_id || !allocated_qty || Number(allocated_qty) <= 0) continue;

        // a. Fetch purchase item details (name, unit, rate, godown)
        const { data: purchaseItem, error: itemErr } = await supabase
          .from("raw_material_purchase_items")
          .select(`
            id,
            item_type,
            other_item_name,
            unit,
            rate,
            material_type_id,
            material_type:raw_material_types (id, name, unit),
            purchase:raw_material_purchases (id, godown_id)
          `)
          .eq("id", purchase_item_id)
          .eq("item_type", "accessory")
          .maybeSingle();

        if (itemErr || !purchaseItem) {
          throw new Error(`Accessory item not found: ${purchase_item_id}`);
        }

        const godownId = (purchaseItem as any).purchase?.godown_id;
        const matTypeId = (purchaseItem as any).material_type_id;
        const itemName = (purchaseItem as any).other_item_name
          || (purchaseItem as any).material_type?.name
          || "Unnamed Accessory";
        const unit = (purchaseItem as any).unit
          || (purchaseItem as any).material_type?.unit
          || "Pcs";
        const rate = Number((purchaseItem as any).rate || 0);

        // b. Validate stock availability
        if (godownId && matTypeId) {
          const { data: stock } = await supabase
            .from("raw_material_current_stock")
            .select("current_stock, stock_value, unit_cost")
            .eq("business_id", businessId)
            .eq("material_type_id", matTypeId)
            .eq("godown_id", godownId)
            .maybeSingle();

          if (!stock || Number(stock.current_stock) < Number(allocated_qty)) {
            throw new Error(
              `Insufficient stock for accessory "${itemName}". ` +
              `Available: ${stock?.current_stock || 0} ${unit}, Requested: ${allocated_qty} ${unit}.`
            );
          }

          // c. Insert into production_lot_accessories
          const { data: lotAcc, error: lotAccErr } = await supabase
            .from("production_lot_accessories")
            .insert({
              business_id: businessId,
              lot_id: lot.id,
              purchase_item_id,
              item_name: itemName,
              unit,
              godown_id: godownId,
              allocated_qty: Number(allocated_qty),
              unit_rate: rate,
              total_issued_qty: 0,
              created_by: accUser?.id || null,
            })
            .select()
            .single();

          if (lotAccErr || !lotAcc) {
            throw new Error(`Failed to record accessory allocation: ${lotAccErr?.message}`);
          }

          // d. Deduct from raw_material_current_stock
          const valDelta = Number(allocated_qty) * rate;
          const updatedQty = Math.max(0, Number(stock.current_stock) - Number(allocated_qty));
          const updatedValue = Math.max(0, Number(stock.stock_value || 0) - valDelta);
          const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stock.unit_cost || 0);

          await supabase
            .from("raw_material_current_stock")
            .update({
              current_stock: updatedQty,
              stock_value: updatedValue,
              unit_cost: Number(updatedUnitCost.toFixed(4)),
              updated_at: new Date().toISOString(),
            })
            .eq("business_id", businessId)
            .eq("material_type_id", matTypeId)
            .eq("godown_id", godownId);

          // e. Write stock_ledger entry
          await supabase
            .from("stock_ledger")
            .insert({
              business_id: businessId,
              item_type: "raw_material",
              item_id: matTypeId,
              godown_id: godownId,
              transaction_type: "production_lot_allocation",
              quantity_delta: -Number(allocated_qty),
              value_delta: -valDelta,
              reference_table: "production_lot_accessories",
              reference_id: lotAcc.id,
              created_by: accUser?.id || null,
            });

          // f. Write stock-out voucher (raw_material_stock_entries)
          const entryNumber = `STK-OUT-ACC-${lot.lot_number}-${purchase_item_id.slice(0, 6)}`;
          const { data: seVoucher } = await supabase
            .from("raw_material_stock_entries")
            .insert({
              business_id: businessId,
              stock_entry_number: entryNumber,
              entry_type: "stock_out",
              posting_date: new Date().toISOString().split("T")[0],
              godown_id: godownId,
              reference_type: "production",
              reference_id: lot.id,
              remarks: `Production Lot Accessory Allocation (Lot ${lot.lot_number}, Item: ${itemName})`,
              total_items_value: valDelta,
              grand_total: valDelta,
              status: "active",
            })
            .select()
            .single();

          if (seVoucher) {
            await supabase.from("raw_material_stock_entry_items").insert({
              business_id: businessId,
              stock_entry_id: seVoucher.id,
              material_type_id: matTypeId,
              unit,
              quantity: Number(allocated_qty),
              rate,
              amount: valDelta,
            });
          }
        }
      }

      // Run reconciliation after all accessory allocations
      try {
        const { reconcileRawMaterialStock } = await import("@/lib/stock-reconciliation");
        await reconcileRawMaterialStock(supabase, businessId);
      } catch (recErr) {
        console.warn("Reconciliation on accessory allocation warning:", recErr);
      }
    }

    // 6. Insert lot specifications
    if (specifications) {
      const { additional_details, design_reference_text, design_reference_photos, custom_qa } = specifications;
      await supabase
        .from("lot_specifications")
        .insert({
          business_id: businessId,
          lot_id: lot.id,
          additional_details: additional_details || null,
          design_reference_text: design_reference_text || null,
          design_reference_photos: design_reference_photos || [],
          custom_qa: custom_qa || [],
        });
    }

    // 6. Insert lot spec sheet
    if (spec_sheet && spec_sheet.template_id) {
      const { template_id, spec_values } = spec_sheet;
      await supabase
        .from("lot_spec_sheet")
        .insert({
          business_id: businessId,
          lot_id: lot.id,
          template_id,
          spec_values: spec_values || {},
        });
    }

    // Log audit trail
    await logAudit(businessId, "create", "production_lots", lot.id, lot, {}, request);

    // Fire-and-forget calendar integration — auto-create lot events
    const { data: { user: lotUser } } = await supabase.auth.getUser();
    void onProductionLotCreated(supabase, {
      businessId,
      lotId: lot.id,
      lotNumber: lot.lot_number,
      lotName: lot_name || undefined,
      startDate: lot.lot_date || lot_date,
      targetCompletionDate: target_dispatch_date || target_due_date || undefined,
      createdBy: lotUser?.id || null,
    });

    return NextResponse.json({ lot });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
