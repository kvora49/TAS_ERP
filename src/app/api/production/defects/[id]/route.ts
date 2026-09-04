import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/production/defects/[id]
// ─────────────────────────────────────────────────────────────────────────────
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
    const { data: defect, error } = await supabase
      .from("lot_defects")
      .select(`
        *,
        lot:production_lots (
          id,
          lot_number,
          lot_name,
          design_id,
          design:designs (id, name, code:design_number, size_set:size_sets(sizes)),
          colour:design_colours (id, colour_name, hex_code:colour_hex)
        ),
        colour:design_colours!colour_id (id, colour_name, hex_code:colour_hex),
        responsible_worker:parties (id, name, code, phone),
        detected_at_stage:lot_production_stages!detected_at_stage_id (id, stage_name, sequence_no),
        responsible_stage:lot_production_stages!responsible_stage_id (id, stage_name, sequence_no),
        resolutions:defect_resolutions (
          id,
          resolution_type,
          resolution_date,
          qty_recovered,
          qty_b_grade,
          qty_scrapped,
          recovered_size_quantities,
          b_grade_size_quantities,
          scrapped_size_quantities,
          rework_cost,
          rework_cost_mode,
          deduction_amount,
          cloth_cost_recovery,
          material_write_off_value,
          waste_reason,
          remarks,
          target_godown:godowns (id, name),
          rework_worker:parties (id, name, code),
          created_at
        )
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (error || !defect) {
      return NextResponse.json({ error: "Defect not found." }, { status: 404 });
    }

    return NextResponse.json({ defect });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/production/defects/[id]
// BUG 13 FIX: Block quantity / size_quantities changes if resolutions exist
// ─────────────────────────────────────────────────────────────────────────────
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
    const body = await request.json();
    const {
      defect_category,
      size_quantities,
      colour_id,
      description,
      responsible_worker_id,
      responsible_stage_id,
      status,
    } = body;

    // Fetch existing defect
    const { data: existing, error: fetchErr } = await supabase
      .from("lot_defects")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Defect not found." }, { status: 404 });
    }

    // BUG 13 FIX: Block size/quantity changes if any resolution exists
    if (size_quantities !== undefined) {
      const { data: resolutions } = await supabase
        .from("defect_resolutions")
        .select("id")
        .eq("defect_id", id)
        .limit(1);

      if (resolutions && resolutions.length > 0) {
        return NextResponse.json(
          {
            error:
              "Cannot change the quantity/size breakdown of a defect that has already been resolved. Resolutions reference the original quantities.",
          },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, any> = {};
    if (defect_category !== undefined) updates.defect_category = defect_category;
    if (description !== undefined) updates.description = description || null;
    if (responsible_worker_id !== undefined)
      updates.responsible_worker_id = responsible_worker_id || null;
    if (responsible_stage_id !== undefined)
      updates.responsible_stage_id = responsible_stage_id || null;
    if (status !== undefined) {
      updates.status = status === "in_rework" ? "sent_for_rework" : status;
    }
    if (colour_id !== undefined) updates.colour_id = colour_id || null;

    // Toggle sent_for_rework (only allowed on pending/sent_for_rework defects with no resolutions)
    if (body.sent_for_rework !== undefined) {
      const newSentForRework = !!body.sent_for_rework;
      const currentlyInRework =
        existing.sent_for_rework &&
        (existing.status === "sent_for_rework" || existing.status === "in_rework");

      if (newSentForRework !== existing.sent_for_rework) {
        // Block if already has resolutions
        const { data: resCheck } = await supabase
          .from("defect_resolutions")
          .select("id")
          .eq("defect_id", id)
          .limit(1);

        if (resCheck && resCheck.length > 0) {
          return NextResponse.json(
            { error: "Cannot change rework flag on a defect that already has resolutions." },
            { status: 400 }
          );
        }

        const { data: lotForToggle } = await supabase
          .from("production_lots")
          .select("total_quantity")
          .eq("id", existing.lot_id)
          .single();

        if (lotForToggle) {
          if (newSentForRework && !currentlyInRework) {
            // Deduct from lot
            await supabase
              .from("production_lots")
              .update({ total_quantity: Math.max(0, Number(lotForToggle.total_quantity || 0) - existing.quantity) })
              .eq("id", existing.lot_id);

            for (const [size, sizeQty] of Object.entries((existing.size_quantities || {}) as Record<string, number>)) {
              const numQty = Math.max(0, Number(sizeQty) || 0);
              if (numQty <= 0) continue;
              let sqQuery = supabase.from("lot_size_quantities").select("id, quantity").eq("lot_id", existing.lot_id).eq("size", size).eq("business_id", businessId);
              if (existing.colour_id) sqQuery = sqQuery.eq("colour_id", existing.colour_id);
              const { data: sqs } = await sqQuery;
              if (sqs && sqs.length > 0) {
                let rem = numQty;
                for (const sq of sqs) {
                  if (rem <= 0) break;
                  const cur = Number(sq.quantity || 0);
                  const dec = Math.min(cur, rem);
                  await supabase.from("lot_size_quantities").update({ quantity: Math.max(0, cur - dec) }).eq("id", sq.id);
                  rem -= dec;
                }
              }
            }
            updates.status = "sent_for_rework";
          } else if (!newSentForRework && currentlyInRework) {
            // Restore to lot
            await supabase
              .from("production_lots")
              .update({ total_quantity: Number(lotForToggle.total_quantity || 0) + existing.quantity })
              .eq("id", existing.lot_id);

            for (const [size, sizeQty] of Object.entries((existing.size_quantities || {}) as Record<string, number>)) {
              const numQty = Math.max(0, Number(sizeQty) || 0);
              if (numQty <= 0) continue;
              let sqQuery = supabase.from("lot_size_quantities").select("id, quantity").eq("lot_id", existing.lot_id).eq("size", size).eq("business_id", businessId);
              if (existing.colour_id) sqQuery = sqQuery.eq("colour_id", existing.colour_id);
              const { data: sqs } = await sqQuery;
              if (sqs && sqs.length > 0) {
                const target = sqs[0];
                await supabase.from("lot_size_quantities").update({ quantity: Number(target.quantity || 0) + numQty }).eq("id", target.id);
              }
            }
            updates.status = "pending";
          }
        }

        updates.sent_for_rework = newSentForRework;
      }
    }

    // Only update size_quantities if no resolutions exist (checked above)
    let qtyDiff = 0;
    if (size_quantities !== undefined) {
      const newQty = Object.values(size_quantities as Record<string, number>).reduce(
        (sum, v) => sum + Math.max(0, Number(v) || 0),
        0
      );
      if (newQty <= 0) {
        return NextResponse.json({ error: "Total quantity must be greater than 0." }, { status: 400 });
      }
      qtyDiff = newQty - (existing.quantity || 0);
      updates.size_quantities = size_quantities;
      updates.quantity = newQty;
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateErr } = await supabase
      .from("lot_defects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    // Adjust lot defect_quantity if size breakdown changed
    if (qtyDiff !== 0) {
      const { data: lot } = await supabase
        .from("production_lots")
        .select("defect_quantity")
        .eq("id", existing.lot_id)
        .single();
      if (lot) {
        await supabase
          .from("production_lots")
          .update({
            defect_quantity: Math.max(0, Number(lot.defect_quantity || 0) + qtyDiff),
          })
          .eq("id", existing.lot_id);
      }
    }

    await logAudit(businessId, "update", "lot_defects", id, updated, existing, request);

    return NextResponse.json({ defect: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/production/defects/[id] — Soft delete (blocks if resolved)
// ─────────────────────────────────────────────────────────────────────────────
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
    const { data: existing, error: fetchErr } = await supabase
      .from("lot_defects")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Defect not found." }, { status: 404 });
    }

    const { data: resolutions } = await supabase
      .from("defect_resolutions")
      .select("id")
      .eq("defect_id", id);

    if (resolutions && resolutions.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a defect that has recorded resolutions. Revert resolution first." },
        { status: 400 }
      );
    }

    await supabase
      .from("lot_defects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    // Restore lot defect_quantity and — if defect was in_rework — total_quantity too
    const { data: lot } = await supabase
      .from("production_lots")
      .select("defect_quantity, total_quantity")
      .eq("id", existing.lot_id)
      .single();

    if (lot) {
      const lotRestorePayload: Record<string, number> = {
        defect_quantity: Math.max(0, Number(lot.defect_quantity || 0) - existing.quantity),
      };

      // If pieces were live-deducted when defect was created (sent_for_rework), restore them
      if (
        existing.sent_for_rework &&
        (existing.status === "sent_for_rework" || existing.status === "in_rework")
      ) {
        lotRestorePayload.total_quantity = Number(lot.total_quantity || 0) + existing.quantity;
      }

      await supabase
        .from("production_lots")
        .update(lotRestorePayload)
        .eq("id", existing.lot_id);

      // Also restore per-size quantities if in_rework
      if (
        existing.sent_for_rework &&
        (existing.status === "sent_for_rework" || existing.status === "in_rework") &&
        existing.size_quantities
      ) {
        for (const [size, sizeQty] of Object.entries(existing.size_quantities as Record<string, number>)) {
          const numQty = Math.max(0, Number(sizeQty) || 0);
          if (numQty <= 0) continue;

          let sqQuery = supabase
            .from("lot_size_quantities")
            .select("id, quantity")
            .eq("lot_id", existing.lot_id)
            .eq("size", size)
            .eq("business_id", businessId);

          if (existing.colour_id) {
            sqQuery = sqQuery.eq("colour_id", existing.colour_id);
          }

          const { data: sqs } = await sqQuery;
          if (sqs && sqs.length > 0) {
            const target = sqs[0];
            await supabase
              .from("lot_size_quantities")
              .update({ quantity: Number(target.quantity || 0) + numQty })
              .eq("id", target.id);
          }
        }
      }
    }

    await logAudit(businessId, "delete", "lot_defects", id, {}, existing, request);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
