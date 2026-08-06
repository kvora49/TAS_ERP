import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    // 1. Fetch Lot detail
    const { data: lot, error: lotError } = await supabase
      .from("production_lots")
      .select(`
        *,
        brand:brands(id, name),
        design:designs(id, name, code:design_number, images, size_set:size_sets(id, name, sizes)),
        colour:design_colours(id, colour_name, hex_code:colour_hex),
        size_set:size_sets(id, name, sizes)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (lotError) {
      return NextResponse.json({ error: lotError.message }, { status: 404 });
    }

    // 2. Fetch Size Quantities with colour join
    const { data: sizeQuantities } = await supabase
      .from("lot_size_quantities")
      .select(`
        *,
        colour:design_colours(id, colour_name, hex_code:colour_hex)
      `)
      .eq("lot_id", id)
      .eq("business_id", businessId);

    // 3. Fetch Assigned Stages
    const { data: stages } = await supabase
      .from("lot_production_stages")
      .select("*")
      .eq("lot_id", id)
      .eq("business_id", businessId)
      .order("sequence_no", { ascending: true });

    // 4. Fetch Stage Entries completed for this lot
    const { data: rawStageEntries, error: entriesError } = await supabase
      .from("stage_entries")
      .select("*")
      .eq("lot_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    let stageEntries: any[] = [];
    if (!entriesError && rawStageEntries && rawStageEntries.length > 0) {
      const workerIds = rawStageEntries.map((e) => e.worker_id).filter(Boolean);
      const stageIds = rawStageEntries.map((e) => e.lot_stage_id).filter(Boolean);

      const workersMap = new Map();
      if (workerIds.length > 0) {
        const { data: workersList } = await supabase
          .from("workers")
          .select("id, name, worker_id")
          .in("id", workerIds);
        if (workersList) {
          workersList.forEach((w) => workersMap.set(w.id, w));
        }
      }

      const stagesMap = new Map();
      if (stageIds.length > 0) {
        const { data: stagesList } = await supabase
          .from("lot_production_stages")
          .select("id, stage_name")
          .in("id", stageIds);
        if (stagesList) {
          stagesList.forEach((s) => stagesMap.set(s.id, s));
        }
      }

      stageEntries = rawStageEntries.map((e) => ({
        ...e,
        worker: e.worker_id ? workersMap.get(e.worker_id) : null,
        stage: e.lot_stage_id ? stagesMap.get(e.lot_stage_id) : null,
      }));
    }

    // Extract unique colours from lot and lot_size_quantities
    const colourMap = new Map();
    if (lot.colour) colourMap.set(lot.colour.id || "default", lot.colour);
    (sizeQuantities || []).forEach((sq: any) => {
      if (sq.colour) colourMap.set(sq.colour.id, sq.colour);
    });
    const colours = Array.from(colourMap.values());
    const effectiveSizeSet = lot.size_set || lot.design?.size_set || null;

    // Extract first image as image_url
    const imageUrl = lot.design && Array.isArray((lot.design as any).images) && (lot.design as any).images.length > 0
      ? (lot.design as any).images[0]
      : null;

    const { data: fsEntries } = await supabase
      .from("finished_stock")
      .select("id")
      .eq("lot_id", id)
      .limit(1);

    const isMovedToStock = !!(fsEntries && fsEntries.length > 0);

    const effectiveCompletedQty =
      lot.status === "completed"
        ? (lot.completed_quantity || lot.total_quantity || 0)
        : (lot.completed_quantity || 0);

    // Calculate Payment & Duration metrics for detail response
    const totalLaborCost = (rawStageEntries || []).reduce((sum: number, e: any) => sum + (Number(e.total_job_work_amount) || 0), 0);
    const totalPaidAmount = (rawStageEntries || []).reduce((sum: number, e: any) => sum + (Number(e.paid_amount) || 0), 0);

    let lotPaymentStatus: "paid" | "unpaid" | "partial" | "none" = "none";
    if (rawStageEntries && rawStageEntries.length > 0 && totalLaborCost > 0) {
      if (totalPaidAmount >= totalLaborCost) {
        lotPaymentStatus = "paid";
      } else if (totalPaidAmount > 0) {
        lotPaymentStatus = "partial";
      } else {
        lotPaymentStatus = "unpaid";
      }
    }

    let startTimestamps: number[] = [];
    (stages || []).forEach((s: any) => {
      if (s.started_at) startTimestamps.push(new Date(s.started_at).getTime());
      if (s.created_at) startTimestamps.push(new Date(s.created_at).getTime());
    });
    (rawStageEntries || []).forEach((e: any) => {
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
      (stages || []).forEach((s: any) => {
        if (s.completed_at) endTimestamps.push(new Date(s.completed_at).getTime());
      });
      (rawStageEntries || []).forEach((e: any) => {
        if (e.created_at) endTimestamps.push(new Date(e.created_at).getTime());
      });
      const completionTime = endTimestamps.length > 0 ? Math.max(...endTimestamps) : Date.now();
      const diffMs = Math.max(0, completionTime - earliestStart);
      const days = Math.max(1, Math.ceil(diffMs / msPerDay));
      daysInWorkingStage = days;
      daysTakenToComplete = days;
    }

    const lotWithImageUrl = {
      ...lot,
      completed_quantity: effectiveCompletedQty,
      size_set: effectiveSizeSet,
      colours,
      is_moved_to_stock: isMovedToStock,
      days_in_working_stage: daysInWorkingStage,
      days_taken_to_complete: daysTakenToComplete,
      lot_payment_status: lotPaymentStatus,
      total_labor_cost: totalLaborCost,
      total_paid_amount: totalPaidAmount,
      design: lot.design ? {
        ...lot.design,
        image_url: imageUrl
      } : null
    };

    // 5. Fetch Lot Rolls
    const { data: rawLotRolls, error: lrError } = await supabase
      .from("lot_rolls")
      .select("*")
      .eq("lot_id", id)
      .eq("business_id", businessId);

    let lotRolls: any[] = [];
    if (!lrError && rawLotRolls && rawLotRolls.length > 0) {
      const rollIds = rawLotRolls.map((r) => r.purchase_roll_id).filter(Boolean);
      if (rollIds.length > 0) {
        const { data: rolls } = await supabase
          .from("purchase_rolls")
          .select("*")
          .in("id", rollIds);

        const itemIds = rolls?.map((r) => r.purchase_item_id).filter(Boolean) || [];
        const { data: items } = itemIds.length > 0
          ? await supabase
              .from("raw_material_purchase_items")
              .select("*")
              .in("id", itemIds)
          : { data: [] };

        const typeIds = items?.map((i) => i.material_type_id).filter(Boolean) || [];
        const { data: types } = typeIds.length > 0
          ? await supabase
              .from("raw_material_types")
              .select("id, name, unit")
              .in("id", typeIds)
          : { data: [] };

        const typesMap = new Map((types || []).map((t) => [t.id, t]));
        const itemsMap = new Map(
          (items || []).map((i) => [
            i.id,
            { ...i, material_type: i.material_type_id ? typesMap.get(i.material_type_id) : null },
          ])
        );
        const rollsMap = new Map(
          (rolls || []).map((r) => [
            r.id,
            { ...r, item: r.purchase_item_id ? itemsMap.get(r.purchase_item_id) : null },
          ])
        );

        lotRolls = rawLotRolls.map((r) => ({
          ...r,
          purchase_roll: r.purchase_roll_id ? rollsMap.get(r.purchase_roll_id) : null,
        }));
      }
    }

    // 6. Fetch Lot Specifications
    const { data: specifications } = await supabase
      .from("lot_specifications")
      .select("*")
      .eq("lot_id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    // 7. Fetch Lot Spec Sheet
    const { data: specSheet } = await supabase
      .from("lot_spec_sheet")
      .select(`
        *,
        template:design_spec_templates (*)
      `)
      .eq("lot_id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    // 8. Fetch Stage Workers
    const stageIds = (stages || []).map((s: any) => s.id);
    const { data: stageWorkers } = stageIds.length > 0
      ? await supabase
          .from("lot_stage_workers")
          .select(`
            *,
            worker:workers(id, name, worker_id)
          `)
          .in("lot_stage_id", stageIds)
          .eq("business_id", businessId)
      : { data: [] };

    // Map stageWorkers into stages
    const stageWorkersMap = new Map();
    if (stageWorkers && stageWorkers.length > 0) {
      stageWorkers.forEach((sw: any) => {
        if (!stageWorkersMap.has(sw.lot_stage_id)) {
          stageWorkersMap.set(sw.lot_stage_id, []);
        }
        if (sw.worker) {
          stageWorkersMap.get(sw.lot_stage_id).push(sw.worker);
        }
      });
    }

    const stagesWithWorkers = (stages || []).map((s: any) => ({
      ...s,
      workers: stageWorkersMap.get(s.id) || [],
    }));

    // 9. Fetch Lot Accessories with live available_qty
    const { data: rawLotAccessories } = await supabase
      .from("production_lot_accessories")
      .select(`
        *,
        godown:godowns (id, name)
      `)
      .eq("lot_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    let enrichedLotAccessories: any[] = [];
    if (rawLotAccessories && rawLotAccessories.length > 0) {
      const accIds = rawLotAccessories.map((a: any) => a.id);
      const { data: issuances } = await supabase
        .from("stage_entry_accessories")
        .select("lot_accessory_id, issued_qty")
        .eq("business_id", businessId)
        .in("lot_accessory_id", accIds);

      const issuedMap = new Map<string, number>();
      (issuances || []).forEach((iss: any) => {
        const prev = issuedMap.get(iss.lot_accessory_id) || 0;
        issuedMap.set(iss.lot_accessory_id, prev + Number(iss.issued_qty));
      });

      enrichedLotAccessories = rawLotAccessories.map((acc: any) => {
        const totalIssued = issuedMap.get(acc.id) || 0;
        return {
          ...acc,
          godown_name: acc.godown?.name || "—",
          total_issued_qty: totalIssued,
          available_qty: Math.max(0, Number(acc.allocated_qty) - totalIssued),
        };
      });
    }

    return NextResponse.json({
      lot: lotWithImageUrl,
      sizes: sizeQuantities || [],
      stages: stagesWithWorkers || [],
      stageEntries: stageEntries || [],
      lotRolls: lotRolls || [],
      specifications: specifications || null,
      specSheet: specSheet || null,
      stageWorkers: stageWorkers || [],
      lotAccessories: enrichedLotAccessories || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const {
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
      status,
      notes,
      internal_notes,
      customer_ref,
      po_date,
      allow_rework,
      completed_quantity,
      total_quantity,
      accessory_cost,
      other_cost,
      sizes,  // array of { size, quantity }
      stages, // array of { stage_id, stage_name, stage_type, sequence_no, is_mandatory, description }
    } = body;

    // Get old values for audit
    const { data: oldLot } = await supabase
      .from("production_lots")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (!oldLot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    const { getBusinessServerSettings } = await import("@/lib/settings/serverSettings");
    const serverSettings = await getBusinessServerSettings(supabase, businessId);

    if (oldLot.status === "completed" && serverSettings.lock_completed_lots) {
      return NextResponse.json(
        { error: "Completed production lots are locked and cannot be edited per system settings." },
        { status: 400 }
      );
    }

    if (lot_date && !serverSettings.allow_back_date_production) {
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

    const { data: lot, error } = await supabase
      .from("production_lots")
      .update({
        brand_id: brand_id || undefined,
        design_id: design_id || undefined,
        colour_id: colour_id || undefined,
        size_set_id: size_set_id || undefined,
        lot_date: lot_date || undefined,
        season: season || null,
        buyer_order_ref: buyer_order_ref || null,
        target_start_date: target_start_date || null,
        target_dispatch_date: target_dispatch_date || null,
        target_due_date: target_due_date || null,
        priority: priority || "normal",
        status: status || "draft",
        completed_at: status === "completed" ? (oldLot?.completed_at || new Date().toISOString()) : undefined,
        completed_quantity: completed_quantity !== undefined ? parseInt(completed_quantity, 10) : undefined,
        total_quantity: total_quantity !== undefined ? parseInt(total_quantity, 10) : undefined,
        allow_rework: allow_rework !== undefined ? !!allow_rework : undefined,
        notes: notes || null,
        internal_notes: internal_notes || null,
        customer_ref: customer_ref || null,
        po_date: po_date || null,
        accessory_cost: accessory_cost !== undefined ? Number(accessory_cost) : undefined,
        other_cost: other_cost !== undefined ? Number(other_cost) : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update sizes if provided
    if (sizes && Array.isArray(sizes)) {
      await supabase
        .from("lot_size_quantities")
        .delete()
        .eq("lot_id", id)
        .eq("business_id", businessId);

      const sizesToInsert = sizes.map((s: any) => ({
        business_id: businessId,
        lot_id: id,
        size: s.size,
        quantity: parseInt(s.quantity, 10) || 0,
      }));

      await supabase
        .from("lot_size_quantities")
        .insert(sizesToInsert);
    }

    // Update stages if provided
    if (stages && Array.isArray(stages)) {
      // Find which stages are already completed or in progress so we don't reset their status
      const { data: currentStages } = await supabase
        .from("lot_production_stages")
        .select("*")
        .eq("lot_id", id)
        .eq("business_id", businessId);

      await supabase
        .from("lot_production_stages")
        .delete()
        .eq("lot_id", id)
        .eq("business_id", businessId);

      const stagesToInsert = stages.map((s: any) => {
        // Carry over status if stage was already in lot
        const matched = currentStages?.find((cs) => cs.stage_id === s.stage_id);
        return {
          business_id: businessId,
          lot_id: id,
          stage_id: s.stage_id,
          stage_name: s.stage_name,
          stage_type: s.stage_type || "in_house",
          sequence_no: parseInt(s.sequence_no, 10),
          is_mandatory: s.is_mandatory !== false,
          description: s.description || null,
          status: matched?.status || "pending",
          started_at: matched?.started_at || null,
          completed_at: matched?.completed_at || null,
        };
      });

      await supabase
        .from("lot_production_stages")
        .insert(stagesToInsert);
    }

    // If lot status was changed to cancelled, release all fabric roll and accessory allocations
    if (status === "cancelled" && oldLot.status !== "cancelled") {
      const { data: { user } } = await supabase.auth.getUser();
      await releaseLotAllocations(supabase, businessId, id, user?.id || null);
    }

    // Log audit trail
    await logAudit(businessId, "update", "production_lots", id, lot, oldLot || {});

    return NextResponse.json({ lot });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// DELETE to cancel or soft-delete a production lot and release its allocated materials
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: oldLot } = await supabase
      .from("production_lots")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!oldLot) {
      return NextResponse.json({ error: "Production lot not found" }, { status: 404 });
    }

    // Check if lot has stage entries or output moved to finished stock
    const { data: finishedGoods } = await supabase
      .from("finished_stock")
      .select("id")
      .eq("lot_id", id)
      .limit(1);

    if (finishedGoods && finishedGoods.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete lot because it has already been moved to Finished Stock." },
        { status: 400 }
      );
    }

    // Release all allocated fabric rolls & accessories back to raw material stock
    await releaseLotAllocations(supabase, businessId, id, user?.id || null);

    // Update status to cancelled and soft delete
    const { error: deleteError } = await supabase
      .from("production_lots")
      .update({
        status: "cancelled",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    await logAudit(businessId, "delete", "production_lots", id, oldLot);

    return NextResponse.json({ success: true, message: "Production lot cancelled and allocated materials released back to stock." });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Release all allocated fabric rolls and accessories back to stock
// ──────────────────────────────────────────────────────────────────────────────
async function releaseLotAllocations(supabase: any, businessId: string, lotId: string, userId: string | null) {
  // 1. Release Allocated Fabric Rolls
  const { data: lotRolls } = await supabase
    .from("lot_rolls")
    .select("*")
    .eq("lot_id", lotId)
    .eq("business_id", businessId);

  if (lotRolls && lotRolls.length > 0) {
    for (const lr of lotRolls) {
      const allocated = Number(lr.allocated_meters || 0);
      if (allocated <= 0) continue;

      const { data: roll } = await supabase
        .from("purchase_rolls")
        .select(`
          *,
          item:raw_material_purchase_items (
            material_type_id,
            rate,
            purchase:raw_material_purchases (godown_id)
          )
        `)
        .eq("id", lr.purchase_roll_id)
        .maybeSingle();

      if (roll) {
        // Restore remaining_meters on purchase_rolls
        const updatedRemaining = Number(roll.remaining_meters || 0) + allocated;
        await supabase
          .from("purchase_rolls")
          .update({ remaining_meters: updatedRemaining })
          .eq("id", lr.purchase_roll_id);

        const godownId = roll.item?.purchase?.godown_id;
        const matTypeId = roll.item?.material_type_id;
        const rate = Number(roll.item?.rate || 0);
        const valDelta = allocated * rate;

        if (godownId && matTypeId) {
          const { data: stockEntry } = await supabase
            .from("raw_material_current_stock")
            .select("*")
            .eq("business_id", businessId)
            .eq("material_type_id", matTypeId)
            .eq("godown_id", godownId)
            .maybeSingle();

          if (stockEntry) {
            const updatedQty = Number(stockEntry.current_stock || 0) + allocated;
            const updatedValue = Number(stockEntry.stock_value || 0) + valDelta;
            const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stockEntry.unit_cost || 0);

            await supabase
              .from("raw_material_current_stock")
              .update({
                current_stock: updatedQty,
                stock_value: updatedValue,
                unit_cost: updatedUnitCost,
                updated_at: new Date().toISOString(),
              })
              .eq("id", stockEntry.id);
          }

          // Insert positive ledger entry for cancellation release
          await supabase
            .from("stock_ledger")
            .insert({
              business_id: businessId,
              item_type: "raw_material",
              item_id: matTypeId,
              godown_id: godownId,
              transaction_type: "production_lot_cancellation_roll_release",
              quantity_delta: allocated,
              value_delta: valDelta,
              reference_table: "production_lots",
              reference_id: lotId,
              created_by: userId,
            });
        }
      }
    }
  }

  // 2. Release Allocated Accessories
  const { data: lotAccs } = await supabase
    .from("production_lot_accessories")
    .select("*")
    .eq("lot_id", lotId)
    .eq("business_id", businessId);

  if (lotAccs && lotAccs.length > 0) {
    const accIds = lotAccs.map((a: any) => a.id);
    const { data: issuances } = await supabase
      .from("stage_entry_accessories")
      .select("lot_accessory_id, issued_qty")
      .eq("business_id", businessId)
      .in("lot_accessory_id", accIds);

    const issuedMap = new Map<string, number>();
    (issuances || []).forEach((iss: any) => {
      const prev = issuedMap.get(iss.lot_accessory_id) || 0;
      issuedMap.set(iss.lot_accessory_id, prev + Number(iss.issued_qty || 0));
    });

    for (const acc of lotAccs) {
      const allocated = Number(acc.allocated_qty || 0);
      const issued = issuedMap.get(acc.id) || Number(acc.total_issued_qty || 0);
      const unissued = Math.max(0, allocated - issued);

      if (unissued > 0 && acc.purchase_item_id) {
        const { data: pItem } = await supabase
          .from("raw_material_purchase_items")
          .select(`
            material_type_id,
            rate,
            purchase:raw_material_purchases (godown_id)
          `)
          .eq("id", acc.purchase_item_id)
          .maybeSingle();

        const godownId = acc.godown_id || (pItem as any)?.purchase?.godown_id;
        const matTypeId = (pItem as any)?.material_type_id;
        const rate = Number(acc.unit_rate || (pItem as any)?.rate || 0);
        const valDelta = unissued * rate;

        if (godownId && matTypeId) {
          const { data: stockEntry } = await supabase
            .from("raw_material_current_stock")
            .select("*")
            .eq("business_id", businessId)
            .eq("material_type_id", matTypeId)
            .eq("godown_id", godownId)
            .maybeSingle();

          if (stockEntry) {
            const updatedQty = Number(stockEntry.current_stock || 0) + unissued;
            const updatedValue = Number(stockEntry.stock_value || 0) + valDelta;
            const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stockEntry.unit_cost || 0);

            await supabase
              .from("raw_material_current_stock")
              .update({
                current_stock: updatedQty,
                stock_value: updatedValue,
                unit_cost: updatedUnitCost,
                updated_at: new Date().toISOString(),
              })
              .eq("id", stockEntry.id);
          }

          // Insert positive ledger entry for accessory cancellation release
          await supabase
            .from("stock_ledger")
            .insert({
              business_id: businessId,
              item_type: "raw_material",
              item_id: matTypeId,
              godown_id: godownId,
              transaction_type: "production_lot_cancellation_accessory_release",
              quantity_delta: unissued,
              value_delta: valDelta,
              reference_table: "production_lots",
              reference_id: lotId,
              created_by: userId,
            });
        }
      }
    }
  }

  // Trigger reconciliation
  try {
    const { reconcileRawMaterialStock } = await import("@/lib/stock-reconciliation");
    await reconcileRawMaterialStock(supabase, businessId);
  } catch (recErr) {
    console.warn("Reconciliation on lot cancellation warning:", recErr);
  }
}


// PATCH to complete lot
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // Get old values
    const { data: oldLot } = await supabase
      .from("production_lots")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (!oldLot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    // Update lot to completed status and set completed_quantity to total_quantity
    const { data: lot, error } = await supabase
      .from("production_lots")
      .update({
        status: "completed",
        completed_quantity: oldLot.total_quantity,
        completed_at: new Date().toISOString(),
        completed_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Also mark the final stage of the lot as completed
    const { data: finalStages } = await supabase
      .from("lot_production_stages")
      .select("*")
      .eq("lot_id", id)
      .eq("business_id", businessId)
      .order("sequence_no", { ascending: false })
      .limit(1);

    if (finalStages && finalStages.length > 0) {
      await supabase
        .from("lot_production_stages")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", finalStages[0].id);
    }

    // Log audit trail
    await logAudit(businessId, "complete_lot", "production_lots", id, lot, oldLot);

    return NextResponse.json({ lot });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
