import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    let colours: any[] = [];
    let sizeSet = null;

    if (lot) {
      if (lot.brand_id) {
        const { data: b } = await supabase.from("brands").select("id, name").eq("id", lot.brand_id).maybeSingle();
        brand = b;
      }
      let effectiveSizeSetId = lot.size_set_id || null;
      if (lot.design_id) {
        const { data: d } = await supabase.from("designs").select("id, name, design_number, size_set_id").eq("id", lot.design_id).maybeSingle();
        design = d ? { id: d.id, name: d.name, code: d.design_number } : null;
        if (!effectiveSizeSetId && d?.size_set_id) {
          effectiveSizeSetId = d.size_set_id;
        }

        const { data: dcs } = await supabase
          .from("design_colours")
          .select("id, colour_name, colour_hex")
          .eq("design_id", lot.design_id);
        colours = (dcs || []).map((c: any) => ({ id: c.id, colour_name: c.colour_name, hex_code: c.colour_hex }));
      }

      if (lot.colour_id) {
        const c = colours.find((col) => col.id === lot.colour_id);
        colour = c ? c : null;
      }
      if (!colour && lot.colour_id) {
        const { data: c } = await supabase.from("design_colours").select("id, colour_name, colour_hex").eq("id", lot.colour_id).maybeSingle();
        colour = c ? { id: c.id, colour_name: c.colour_name, hex_code: c.colour_hex } : null;
      }

      if (effectiveSizeSetId) {
        const { data: s } = await supabase.from("size_sets").select("id, name, sizes").eq("id", effectiveSizeSetId).maybeSingle();
        sizeSet = s;
      }
    }

    const entryColId = rawEntry.colour_id || rawEntry.custom_field_values?.colour_id || rawEntry.custom_field_values?.color_id || null;
    const entryColour = entryColId ? ((lot as any)?.colours?.find((c: any) => c.id === entryColId) || colour) : colour;

      const entry = {
        ...rawEntry,
        colour: entryColour,
        lot: lot ? {
          id: lot.id,
          lot_number: lot.lot_number,
          total_quantity: lot.total_quantity,
          completed_quantity: lot.completed_quantity,
          brand,
          design,
          colour,
          colours,
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

    const editableBlockReason = await checkStageEntryEditable(supabase, businessId, rawEntry);

    return NextResponse.json({
      entry,
      totalStagesCount: stages?.length || 0,
      isEditable: !editableBlockReason,
      editableBlockReason,
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

    // Check guard conditions before editing
    const guardError = await checkStageEntryEditable(supabase, businessId, oldEntry);
    if (guardError) {
      return NextResponse.json({ error: guardError }, { status: 400 });
    }

    // Computations
    const wQty = parseInt(wastage_qty, 10) || 0;
    const wPercent = qty_in > 0 ? wQty / qty_in : 0;
    const qtyBalance = qty_in - qty_out - wQty;
    const jRate = parseFloat(job_work_rate) || 0;
    const totalJobWorkAmount = qty_out * jRate;
    const totalLaborCost = totalJobWorkAmount;

    const supabaseAdmin = createAdminClient();

    // Safely resolve worker_id to a valid workers.id UUID or null to prevent FK constraint errors
    let finalWorkerId: string | null = null;
    let worker_type: string | null = null;

    if (worker_id && typeof worker_id === "string" && worker_id.trim() !== "") {
      let matchedWorker: any = null;

      const { data: wRecord } = await supabaseAdmin
        .from("workers")
        .select("id, worker_id, name, type, phone, address, remarks, is_active")
        .eq("id", worker_id)
        .maybeSingle();

      if (wRecord) {
        matchedWorker = wRecord;
      } else {
        const { data: wCodeRecord } = await supabaseAdmin
          .from("workers")
          .select("id, worker_id, name, type, phone, address, remarks, is_active")
          .eq("worker_id", worker_id)
          .maybeSingle();

        if (wCodeRecord) {
          matchedWorker = wCodeRecord;
        } else {
          const { data: partyWorker } = await supabaseAdmin
            .from("parties")
            .select("id, code, name, type, phone, billing_address_line1, remarks, is_active")
            .eq("id", worker_id)
            .maybeSingle();

          if (partyWorker) {
            matchedWorker = {
              id: partyWorker.id,
              worker_id: partyWorker.code,
              name: partyWorker.name,
              type: Array.isArray(partyWorker.type) ? partyWorker.type[0] : "job_worker",
              phone: partyWorker.phone,
              address: partyWorker.billing_address_line1,
              remarks: partyWorker.remarks,
              is_active: partyWorker.is_active !== false,
            };
          }
        }
      }

      if (matchedWorker) {
        finalWorkerId = matchedWorker.id;
        worker_type = (matchedWorker.type === "permanent" || matchedWorker.type === "in_house") ? "permanent" : "job_worker";
        const uniqueCode = `${matchedWorker.worker_id || 'WRK'}_${matchedWorker.id.substring(0, 6)}`;

        // 1. Ensure worker exists in `workers` table
        try {
          await supabaseAdmin.from("workers").upsert({
            id: matchedWorker.id,
            business_id: businessId,
            name: matchedWorker.name || "Worker",
            worker_id: uniqueCode,
            type: worker_type,
            phone: matchedWorker.phone || null,
            address: matchedWorker.address || null,
            remarks: matchedWorker.remarks || null,
            is_active: matchedWorker.is_active !== false,
          }, { onConflict: "id" });
        } catch (_ignore) {}


      }
    }

    const { data: entry, error } = await supabaseAdmin
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
        worker_id: finalWorkerId,
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
    await logAudit(businessId, "update", "stage_entries", id, entry, oldEntry, request);

    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

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
    const { data: oldEntry } = await supabase
      .from("stage_entries")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!oldEntry) {
      return NextResponse.json({ error: "Stage entry not found" }, { status: 404 });
    }

    // Guard check using unified checkStageEntryEditable helper
    const guardError = await checkStageEntryEditable(supabase, businessId, oldEntry);
    if (guardError) {
      return NextResponse.json({ error: guardError }, { status: 400 });
    }

    // -------------------------------------------------------------
    // Delete Stage Entry
    // -------------------------------------------------------------
    const { error } = await supabase
      .from("stage_entries")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // -------------------------------------------------------------
    // Reconcile Lot Production Stage completed quantities
    // -------------------------------------------------------------
    if (oldEntry.lot_stage_id && oldEntry.qty_out > 0) {
      const { data: stage } = await supabase
        .from("lot_production_stages")
        .select("completed_quantity, status")
        .eq("id", oldEntry.lot_stage_id)
        .maybeSingle();

      if (stage) {
        const newCompleted = Math.max(0, (stage.completed_quantity || 0) - oldEntry.qty_out);
        await supabase
          .from("lot_production_stages")
          .update({
            completed_quantity: newCompleted,
            status: newCompleted > 0 ? "in_progress" : "pending",
          })
          .eq("id", oldEntry.lot_stage_id);
      }
    }

    await logAudit(businessId, "delete", "stage_entries", id, oldEntry, {}, request);

    return NextResponse.json({ success: true, message: "Stage entry deleted successfully and ledgers reconciled" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Check if a stage entry is editable or deletable
// ──────────────────────────────────────────────────────────────────────────────
async function checkStageEntryEditable(supabase: any, businessId: string, oldEntry: any): Promise<string | null> {
  // 1. Check if lot is completed or output moved to stock
  if (oldEntry.lot_id) {
    const { data: lot } = await supabase
      .from("production_lots")
      .select("id, status, lot_number")
      .eq("id", oldEntry.lot_id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (lot?.status === "completed") {
      return `Cannot modify stage entry ${oldEntry.entry_number} because Lot #${lot.lot_number} has already been completed.`;
    }
  }

  if (oldEntry.moved_to_stock === true || oldEntry.is_moved_to_stock || oldEntry.finished_stock_id) {
    return `Cannot modify stage entry ${oldEntry.entry_number} because output items have already been moved to Finished Stock.`;
  }

  // 2. Check payment status / linked payment vouchers
  const paidAmount = Number(oldEntry.paid_amount || 0);
  if (paidAmount > 0 || oldEntry.payment_status === "paid" || oldEntry.payment_status === "partial") {
    return `Cannot modify stage entry ${oldEntry.entry_number} because a payment of ₹${paidAmount.toFixed(
      2
    )} has already been recorded against it.`;
  }

  // 3. Check if subsequent stages in sequence have entries logged
  if (oldEntry.lot_stage_id && oldEntry.lot_id) {
    const { data: currentStage } = await supabase
      .from("lot_production_stages")
      .select("id, sequence_no, stage_name")
      .eq("id", oldEntry.lot_stage_id)
      .maybeSingle();

    if (currentStage) {
      const { data: nextStages } = await supabase
        .from("lot_production_stages")
        .select("id, stage_name, sequence_no")
        .eq("lot_id", oldEntry.lot_id)
        .gt("sequence_no", currentStage.sequence_no);

      if (nextStages && nextStages.length > 0) {
        const nextStageIds = nextStages.map((s: any) => s.id);
        const { data: subsequentEntries } = await supabase
          .from("stage_entries")
          .select("id, entry_number, lot_stage_id")
          .in("lot_stage_id", nextStageIds)
          .eq("business_id", businessId)
          .limit(1);

        if (subsequentEntries && subsequentEntries.length > 0) {
          const nextStageObj = nextStages.find((s: any) => s.id === subsequentEntries[0].lot_stage_id);
          const nextStageName = nextStageObj?.stage_name || "a subsequent stage";
          return `Cannot modify stage entry ${oldEntry.entry_number} because entries have already been logged in subsequent stage "${nextStageName}". Please delete downstream stage entries first.`;
        }
      }
    }
  }

  return null;
}

