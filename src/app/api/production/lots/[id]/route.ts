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
        design:designs(id, name, code:design_number, images),
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

    // 2. Fetch Size Quantities
    const { data: sizeQuantities } = await supabase
      .from("lot_size_quantities")
      .select("*")
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

    // Extract first image as image_url
    const imageUrl = lot.design && Array.isArray((lot.design as any).images) && (lot.design as any).images.length > 0
      ? (lot.design as any).images[0]
      : null;

    const lotWithImageUrl = {
      ...lot,
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

    return NextResponse.json({
      lot: lotWithImageUrl,
      sizes: sizeQuantities || [],
      stages: stagesWithWorkers || [],
      stageEntries: stageEntries || [],
      lotRolls: lotRolls || [],
      specifications: specifications || null,
      specSheet: specSheet || null,
      stageWorkers: stageWorkers || [],
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
