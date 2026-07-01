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
      sizes,  // array of { size, quantity }
      stages, // array of { stage_id, stage_name, stage_type, sequence_no, is_mandatory }
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
      }));

      const { error: sizesError } = await supabase
        .from("lot_size_quantities")
        .insert(sizesToInsert);

      if (sizesError) {
        // Rollback lot or just return error (Supabase doesn't do auto rollback on separate queries unless in RPC)
        // Since it's a critical error, return bad request
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

      const { error: stagesError } = await supabase
        .from("lot_production_stages")
        .insert(stagesToInsert);

      if (stagesError) {
        return NextResponse.json({ error: `Lot created, but stages failed: ${stagesError.message}` }, { status: 400 });
      }

      // Automatically set current_stage_id of lot to the first stage
      const firstStage = stages.find((s: any) => s.sequence_no === 1);
      if (firstStage) {
        // Find the newly inserted stage row to get its id
        const { data: dbStages } = await supabase
          .from("lot_production_stages")
          .select("id")
          .eq("lot_id", lot.id)
          .eq("sequence_no", 1)
          .single();

        if (dbStages) {
          await supabase
            .from("production_lots")
            .update({
              current_stage_id: firstStage.stage_id,
              status: "in_progress",
            })
            .eq("id", lot.id);
            
          // Update the first stage status to in_progress
          await supabase
            .from("lot_production_stages")
            .update({
              status: "in_progress",
              started_at: new Date().toISOString(),
            })
            .eq("id", dbStages.id);
        }
      }
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
