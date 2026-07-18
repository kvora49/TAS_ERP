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
    const { data: rawEntry, error } = await supabase
      .from("stage_entries")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (error || !rawEntry) {
      return NextResponse.json({ error: error?.message || "Entry not found" }, { status: 404 });
    }

    // Fetch related tables
    const { data: lot } = await supabase
      .from("production_lots")
      .select("*")
      .eq("id", rawEntry.lot_id)
      .single();

    const { data: stage } = await supabase
      .from("lot_production_stages")
      .select("id, stage_name, sequence_no, stage_type")
      .eq("id", rawEntry.lot_stage_id)
      .single();

    const { data: worker } = rawEntry.worker_id
      ? await supabase.from("workers").select("id, name, worker_id").eq("id", rawEntry.worker_id).single()
      : { data: null };

    // Fetch design details for lot
    let brand = null;
    let design = null;
    let colour = null;
    let sizeSet = null;

    if (lot) {
      if (lot.brand_id) {
        const { data: b } = await supabase.from("brands").select("id, name").eq("id", lot.brand_id).maybeSingle();
        brand = b;
      }
      if (lot.design_id) {
        const { data: d } = await supabase.from("designs").select("id, name, design_number").eq("id", lot.design_id).maybeSingle();
        design = d ? { id: d.id, name: d.name, code: d.design_number } : null;
      }
      if (lot.colour_id) {
        const { data: c } = await supabase.from("design_colours").select("id, colour_name, colour_hex").eq("id", lot.colour_id).maybeSingle();
        colour = c ? { id: c.id, colour_name: c.colour_name, hex_code: c.colour_hex } : null;
      }
      if (lot.size_set_id) {
        const { data: s } = await supabase.from("size_sets").select("id, name, sizes").eq("id", lot.size_set_id).maybeSingle();
        sizeSet = s;
      }
    }

    const entry = {
      ...rawEntry,
      lot: lot ? {
        id: lot.id,
        lot_number: lot.lot_number,
        total_quantity: lot.total_quantity,
        completed_quantity: lot.completed_quantity,
        brand,
        design,
        colour,
        size_set: sizeSet
      } : null,
      stage,
      worker
    };

    // Load total stages count for context
    const { data: stages } = await supabase
      .from("lot_production_stages")
      .select("id")
      .eq("lot_id", entry.lot_id)
      .eq("business_id", businessId);

    return NextResponse.json({
      entry,
      totalStagesCount: stages?.length || 0,
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
    } = body;

    // Get old entry for audit
    const { data: oldEntry } = await supabase
      .from("stage_entries")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (!oldEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Computations
    const wQty = parseInt(wastage_qty, 10) || 0;
    const wPercent = qty_in > 0 ? wQty / qty_in : 0;
    const qtyBalance = qty_in - qty_out - wQty;
    const jRate = parseFloat(job_work_rate) || 0;
    const totalJobWorkAmount = qty_out * jRate;
    const totalLaborCost = totalJobWorkAmount;

    let worker_type = null;
    if (worker_id) {
      const { data: worker } = await supabase
        .from("workers")
        .select("type")
        .eq("id", worker_id)
        .single();
      worker_type = worker?.type || null;
    }

    const { data: entry, error } = await supabase
      .from("stage_entries")
      .update({
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
        worker_id: worker_id || null,
        worker_type,
        no_of_workers: parseInt(no_of_workers, 10) || 1,
        total_labor_cost: totalLaborCost,
        remarks: remarks || null,
        custom_field_values: custom_field_values || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Update status of the stage in lot_production_stages if balance changed
    if (entry.qty_balance <= 0) {
      await supabase
        .from("lot_production_stages")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", entry.lot_stage_id);
    }

    // Log audit trail
    await logAudit(businessId, "update", "stage_entries", id, entry, oldEntry);

    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
