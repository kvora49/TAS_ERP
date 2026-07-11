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
    const { data: stageEntries } = await supabase
      .from("stage_entries")
      .select(`
        *,
        worker:workers(id, name, worker_id),
        stage:lot_production_stages(id, stage_name)
      `)
      .eq("lot_id", id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

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
    const { data: lotRolls } = await supabase
      .from("lot_rolls")
      .select(`
        *,
        purchase_roll:purchase_rolls (
          roll_number,
          shade,
          item:raw_material_purchase_items (
            rate,
            material_type:raw_material_types (name, unit)
          )
        )
      `)
      .eq("lot_id", id)
      .eq("business_id", businessId);

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

    return NextResponse.json({
      lot: lotWithImageUrl,
      sizes: sizeQuantities || [],
      stages: stages || [],
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
