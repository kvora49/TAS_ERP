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
  const search = searchParams.get("search");
  const brandId = searchParams.get("brand_id");
  const designId = searchParams.get("design_id");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

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
      // Since design details are nested, we can search lot_number or join designs
      query = query.or(`lot_number.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    const { data: lots, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If search is active, we can also filter in-memory if the search hits design code or name
    let filteredLots = lots || [];
    if (search && lots) {
      const searchLower = search.toLowerCase();
      filteredLots = lots.filter(
        (lot) =>
          lot.lot_number.toLowerCase().includes(searchLower) ||
          (lot.design?.name && lot.design.name.toLowerCase().includes(searchLower)) ||
          (lot.design?.code && lot.design.code.toLowerCase().includes(searchLower))
      );
    }

    // For each lot, load its size quantities
    const lotIds = filteredLots.map((l) => l.id);
    let sizeQuantities: any[] = [];
    if (lotIds.length > 0) {
      const { data: sqData } = await supabase
        .from("lot_size_quantities")
        .select("*")
        .in("lot_id", lotIds)
        .eq("business_id", businessId);
      sizeQuantities = sqData || [];
    }

    const lotsWithSizes = filteredLots.map((lot) => {
      const sizes = sizeQuantities.filter((sq) => sq.lot_id === lot.id);
      return {
        ...lot,
        sizes,
      };
    });

    return NextResponse.json({ lots: lotsWithSizes });
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
      allocated_rolls, // array of { purchase_roll_id, allocated_meters }
      specifications,  // object of { additional_details, design_reference_text, design_reference_photos, custom_qa }
      spec_sheet,      // object of { template_id, spec_values }
      sizes,  // array of { size, quantity, colour_id }
      stages, // array of { stage_id, stage_name, stage_type, sequence_no, is_mandatory, worker_ids }
    } = body;

    if (!lot_number || !brand_id || !design_id || !lot_date || !total_quantity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // 1. Create the production lot
    const { data: lot, error: lotError } = await supabase
      .from("production_lots")
      .insert({
        business_id: businessId,
        lot_number,
        brand_id,
        design_id,
        colour_id: colour_id || null,
        size_set_id: size_set_id || null,
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

    // 4. Insert lot rolls allocation
    if (allocated_rolls && allocated_rolls.length > 0) {
      const lotRollsToInsert = allocated_rolls.map((r: any) => ({
        business_id: businessId,
        lot_id: lot.id,
        purchase_roll_id: r.purchase_roll_id,
        allocated_meters: Number(r.allocated_meters),
      }));

      const { error: lrError } = await supabase
        .from("lot_rolls")
        .insert(lotRollsToInsert);

      if (lrError) {
        return NextResponse.json({ error: `Lot created, but roll allocation mapping failed: ${lrError.message}` }, { status: 400 });
      }

      // Link temporary stock ledger entries to this lot
      const rollIds = allocated_rolls.map((r: any) => r.purchase_roll_id);
      await supabase
        .from("stock_ledger")
        .update({
          reference_table: "production_lots",
          reference_id: lot.id,
        })
        .eq("business_id", businessId)
        .eq("transaction_type", "production_lot_allocation")
        .in("reference_id", rollIds)
        .eq("reference_table", "purchase_rolls");
    }

    // 5. Insert lot specifications
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
    await logAudit(businessId, "create", "production_lots", lot.id, lot);

    return NextResponse.json({ lot });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
