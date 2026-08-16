import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/production/defects/[id]/resolve
//
// Fixes: BUG 4 (rework-to-lot restores lot), BUG 5 (rework cost only on reworked pcs),
//        BUG 6 (post-stock deducts from selected finished_stock entry),
//        BUG 7 (b-grade → b_grade_stock not finished_stock),
//        BUG 10 (lot.other_cost updated on merge), BUG 11 (scrap write-off),
//        BUG 12 (rework cost modes: free / paid_normal / paid_custom)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(
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
      resolution_type,
      resolution_date,
      // Size-wise breakdown (BUG 2 fix)
      recovered_size_quantities = {} as Record<string, number>,
      b_grade_size_quantities = {} as Record<string, number>,
      scrapped_size_quantities = {} as Record<string, number>,
      // Rework cost (BUG 5 / BUG 12 fix)
      rework_cost_mode = "free",   // 'free' | 'paid_normal' | 'paid_custom'
      rework_cost = 0,
      // Deductions
      deduction_amount = 0,
      cloth_cost_recovery = 0,
      // Rework / B-grade storage
      rework_stage_id,
      rework_worker_id,
      target_godown_id,
      // Post-stock: which finished_stock entry to deduct from (BUG 6 fix)
      source_finished_stock_id,
      // Worker
      responsible_worker_id,
      // Waste (BUG 11 fix)
      waste_reason,
      remarks,
    } = body;

    // ── 1. Fetch Defect & Lot ────────────────────────────────────────────────
    const { data: defect, error: defectErr } = await supabase
      .from("lot_defects")
      .select(`
        *,
        lot:production_lots (
          id,
          lot_number,
          design_id,
          colour_id,
          size_set_id,
          total_quantity,
          accessory_cost,
          other_cost,
          status
        )
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (defectErr || !defect) {
      return NextResponse.json({ error: "Defect not found." }, { status: 404 });
    }

    if (defect.status === "resolved" || defect.status === "reworked_fixed" ||
        defect.status === "moved_to_b_grade" || defect.status === "written_off") {
      return NextResponse.json(
        { error: "This defect has already been fully resolved. Use re-resolve only for partial corrections." },
        { status: 400 }
      );
    }

    const lot = defect.lot;
    const isPostStock = defect.source === "post_stock";

    // ── 2. Compute totals from size-wise breakdown ───────────────────────────
    const sumSizes = (obj: Record<string, number>) =>
      Object.values(obj).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);

    const recQty = sumSizes(recovered_size_quantities);
    const bQty = sumSizes(b_grade_size_quantities);
    const scrapQty = sumSizes(scrapped_size_quantities);
    const totalAccounted = recQty + bQty + scrapQty;

    // Validate totals match defect quantity
    if (totalAccounted !== defect.quantity) {
      return NextResponse.json(
        {
          error: `Total resolved pieces (${totalAccounted}) must equal defect quantity (${defect.quantity}). ` +
            `[Recovered: ${recQty}, B-Grade: ${bQty}, Scrapped: ${scrapQty}]`,
        },
        { status: 400 }
      );
    }

    // Validate per-size totals match defect's size_quantities
    const defectSizes = (defect.size_quantities || {}) as Record<string, number>;
    for (const [size, defectSizeQty] of Object.entries(defectSizes)) {
      const expected = Number(defectSizeQty || 0);
      if (expected <= 0) continue;
      const got =
        Math.max(0, Number((recovered_size_quantities as any)[size] || 0)) +
        Math.max(0, Number((b_grade_size_quantities as any)[size] || 0)) +
        Math.max(0, Number((scrapped_size_quantities as any)[size] || 0));
      if (got !== expected) {
        return NextResponse.json(
          {
            error: `Size ${size}: expected ${expected} pcs to be allocated but got ${got} (Recovered ${(recovered_size_quantities as any)[size] || 0} + B-Grade ${(b_grade_size_quantities as any)[size] || 0} + Scrapped ${(scrapped_size_quantities as any)[size] || 0}).`,
          },
          { status: 400 }
        );
      }
    }

    // Validate godown requirements
    if (
      (bQty > 0 || (resolution_type === "reworked_to_stock_grade_a" && recQty > 0)) &&
      !target_godown_id
    ) {
      return NextResponse.json(
        { error: "Target godown is required when storing recovered or B-Grade stock." },
        { status: 400 }
      );
    }

    // For post-stock defects, need source entry to deduct from
    if (isPostStock && (bQty > 0 || scrapQty > 0) && !source_finished_stock_id) {
      return NextResponse.json(
        {
          error: "For post-stock defects, you must specify which finished stock entry to deduct from (source_finished_stock_id).",
        },
        { status: 400 }
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // ── 3. Calculate unit costs ──────────────────────────────────────────────
    const [{ data: lotRolls }, { data: stageEntries }, { data: lotSizes }] = await Promise.all([
      supabase
        .from("lot_rolls")
        .select(`allocated_meters, purchase_roll:purchase_rolls(item:raw_material_purchase_items(rate))`)
        .eq("lot_id", lot.id)
        .eq("business_id", businessId),
      supabase
        .from("stage_entries")
        .select("qty_out, job_work_rate, lot_stage_id")
        .eq("lot_id", lot.id)
        .eq("business_id", businessId),
      supabase
        .from("lot_size_quantities")
        .select("size, quantity")
        .eq("lot_id", lot.id)
        .eq("business_id", businessId),
    ]);

    const totalFabricCost = (lotRolls || []).reduce((acc: number, curr: any) => {
      const rate = Number(curr.purchase_roll?.item?.rate || 0);
      return acc + Number(curr.allocated_meters || 0) * rate;
    }, 0);

    const totalLaborCost = (stageEntries || []).reduce((acc: number, curr: any) => {
      return acc + Number(curr.qty_out || 0) * Number(curr.job_work_rate || 0);
    }, 0);

    const totalLotCost =
      totalFabricCost +
      totalLaborCost +
      Number(lot.accessory_cost || 0) +
      Number(lot.other_cost || 0);

    const totalLotQty = Number(lot.total_quantity || 1);
    const unitCost = totalLotQty > 0 ? totalLotCost / totalLotQty : 0;

    // Unit fabric cost (for scrap write-off valuation)
    const unitFabricCost = totalLotQty > 0 ? totalFabricCost / totalLotQty : 0;

    // Stage rate for auto-deduction (free rework)
    let stageJobWorkRate = 0;
    if (defect.responsible_stage_id && stageEntries) {
      const matchedEntry = stageEntries.find(
        (se: any) => se.lot_stage_id === defect.responsible_stage_id
      );
      if (matchedEntry) stageJobWorkRate = Number(matchedEntry.job_work_rate || 0);
    }
    if (stageJobWorkRate === 0 && totalLotQty > 0) {
      stageJobWorkRate = totalLaborCost / totalLotQty;
    }

    // BUG 5 FIX: Rework cost per piece (only applied to reworked pieces, not whole lot)
    const reworkCostPerPiece = recQty > 0 ? Number(rework_cost || 0) / recQty : 0;
    const reworkedUnitCost = unitCost + reworkCostPerPiece;

    // ── 4. Post-stock: deduct from existing finished_stock entry ─────────────
    if (isPostStock && source_finished_stock_id && (bQty > 0 || scrapQty > 0)) {
      const deductQty = bQty + scrapQty;
      const { data: fsEntry, error: fsGetErr } = await supabase
        .from("finished_stock")
        .select("id, total_quantity, size_quantities, cost_per_piece, total_value")
        .eq("id", source_finished_stock_id)
        .eq("business_id", businessId)
        .single();

      if (fsGetErr || !fsEntry) {
        return NextResponse.json(
          { error: "Source finished stock entry not found." },
          { status: 404 }
        );
      }

      if (Number(fsEntry.total_quantity) < deductQty) {
        return NextResponse.json(
          {
            error: `Insufficient stock in selected entry. Available: ${fsEntry.total_quantity}, Required: ${deductQty}.`,
          },
          { status: 400 }
        );
      }

      // Deduct per-size from existing entry
      const updatedSizeQty = { ...(fsEntry.size_quantities || {}) } as Record<string, number>;
      const allDeductSizes = {
        ...b_grade_size_quantities,
        ...scrapped_size_quantities,
      } as Record<string, number>;
      for (const [size, qty] of Object.entries(allDeductSizes)) {
        updatedSizeQty[size] = Math.max(0, (updatedSizeQty[size] || 0) - Number(qty));
      }

      const newTotalQty = Math.max(0, Number(fsEntry.total_quantity) - deductQty);
      const newTotalValue = newTotalQty * Number(fsEntry.cost_per_piece || 0);

      await supabase
        .from("finished_stock")
        .update({
          total_quantity: newTotalQty,
          size_quantities: updatedSizeQty,
          total_value: newTotalValue,
        })
        .eq("id", source_finished_stock_id);

      // Stock ledger: outflow for post-stock defect deduction
      await supabase.from("stock_ledger").insert({
        business_id: businessId,
        item_type: "finished_good",
        item_id: lot.design_id,
        godown_id: null,
        transaction_type: "post_stock_defect_deduction",
        quantity_delta: -deductQty,
        value_delta: -(deductQty * Number(fsEntry.cost_per_piece || 0)),
        reference_table: "lot_defects",
        reference_id: defect.id,
        created_by: userId,
      });
    }

    // ── 5. In-Production Lot: Deduct pieces leaving the lot (B-grade, Scrap, Direct Stock) ──
    if (!isPostStock) {
      // Collect all quantities leaving the lot
      const leavingSizes: Record<string, number> = {
        ...b_grade_size_quantities,
        ...scrapped_size_quantities,
      };
      if (resolution_type === "reworked_to_stock_grade_a") {
        for (const [s, q] of Object.entries(recovered_size_quantities)) {
          leavingSizes[s] = (leavingSizes[s] || 0) + Number(q || 0);
        }
      }

      for (const [size, qty] of Object.entries(leavingSizes)) {
        const numQty = Math.max(0, Number(qty) || 0);
        if (numQty <= 0) continue;

        const { data: existingSq } = await supabase
          .from("lot_size_quantities")
          .select("id, quantity")
          .eq("lot_id", lot.id)
          .eq("size", size)
          .eq("business_id", businessId)
          .maybeSingle();

        if (existingSq) {
          await supabase
            .from("lot_size_quantities")
            .update({ quantity: Math.max(0, Number(existingSq.quantity || 0) - numQty) })
            .eq("id", existingSq.id);
        }
      }

      const totalLeaving = bQty + scrapQty + (resolution_type === "reworked_to_stock_grade_a" ? recQty : 0);
      if (totalLeaving > 0) {
        await supabase
          .from("production_lots")
          .update({
            total_quantity: Math.max(0, Number(lot.total_quantity || 0) - totalLeaving),
          })
          .eq("id", lot.id);
      }

      // BUG 10 FIX: If reworked to lot and rework_cost > 0, add rework_cost to lot.other_cost
      if (resolution_type === "reworked_to_lot" && Number(rework_cost || 0) > 0) {
        const { data: currentLot } = await supabase
          .from("production_lots")
          .select("other_cost")
          .eq("id", lot.id)
          .single();
        if (currentLot) {
          await supabase
            .from("production_lots")
            .update({ other_cost: Number(currentLot.other_cost || 0) + Number(rework_cost) })
            .eq("id", lot.id);
        }
      }
    }

    // ── 6. Reworked → Push to Stock Grade A ─────────────────────────────────
    if (recQty > 0 && resolution_type === "reworked_to_stock_grade_a" && target_godown_id) {
      // BUG 5 FIX: Use reworkedUnitCost (includes per-piece rework cost) not whole-lot unitCost
      const val = recQty * reworkedUnitCost;
      const colourId = defect.colour_id || lot.colour_id || null;

      const { error: fsErr } = await supabase.from("finished_stock").insert({
        business_id: businessId,
        design_id: lot.design_id,
        colour_id: colourId,
        size_set_id: lot.size_set_id,
        lot_id: lot.id,
        godown_id: target_godown_id,
        entry_type: "defect_rework",
        size_quantities: recovered_size_quantities,
        total_quantity: recQty,
        cost_per_piece: reworkedUnitCost,
        total_value: val,
        created_by: userId,
      });

      if (fsErr) throw new Error(`Failed to push recovered Grade A stock: ${fsErr.message}`);

      await supabase.from("stock_ledger").insert({
        business_id: businessId,
        item_type: "finished_good",
        item_id: lot.design_id,
        godown_id: target_godown_id,
        transaction_type: "defect_rework_grade_a_push",
        quantity_delta: recQty,
        value_delta: val,
        reference_table: "lot_defects",
        reference_id: defect.id,
        created_by: userId,
      });
    }

    // ── 7. B-Grade → b_grade_stock (BUG 7 FIX — NOT finished_stock) ─────────
    if (bQty > 0 && target_godown_id) {
      const colourId = defect.colour_id || lot.colour_id || null;
      const bVal = bQty * unitCost;

      const { error: bgErr } = await supabase.from("b_grade_stock").insert({
        business_id: businessId,
        lot_id: lot.id,
        design_id: lot.design_id,
        colour_id: colourId,
        godown_id: target_godown_id,
        size_quantities: b_grade_size_quantities,
        total_quantity: bQty,
        cost_per_piece: unitCost,
        total_value: bVal,
        b_grade_sale_price: null,   // Set later when user prices it for sale
        status: "available",
        created_by: userId,
        // defect_resolution_id will be linked after resolution record is created (step 9)
      });

      if (bgErr) throw new Error(`Failed to push B-Grade stock: ${bgErr.message}`);

      // Stock ledger entry for B-grade (internal tracking only)
      await supabase.from("stock_ledger").insert({
        business_id: businessId,
        item_type: "finished_good",
        item_id: lot.design_id,
        godown_id: target_godown_id,
        transaction_type: "defect_b_grade_push",
        quantity_delta: bQty,
        value_delta: bVal,
        reference_table: "lot_defects",
        reference_id: defect.id,
        created_by: userId,
      });
    }

    // ── 8. Scrap Write-Off (BUG 11 FIX) ─────────────────────────────────────
    const materialWriteOffValue = scrapQty > 0 ? scrapQty * unitFabricCost : 0;

    if (scrapQty > 0) {
      // Negative stock ledger entry for raw material fabric write-off
      await supabase.from("stock_ledger").insert({
        business_id: businessId,
        item_type: "finished_good",
        item_id: lot.design_id,
        godown_id: null,
        transaction_type: "defect_scrap_writeoff",
        quantity_delta: -scrapQty,
        value_delta: -materialWriteOffValue,
        reference_table: "lot_defects",
        reference_id: defect.id,
        created_by: userId,
      });
    }

    // ── 9. Worker Deductions (BUG 12 FIX — rework cost modes) ───────────────
    const effectiveWorkerId = responsible_worker_id || defect.responsible_worker_id;

    // Calculate auto-deduction for free rework
    let autoDeductionAmount = Number(deduction_amount || 0);
    let autoClothCostRecovery = Number(cloth_cost_recovery || 0);

    if (rework_cost_mode === "free" && effectiveWorkerId) {
      // Deduct for pieces they couldn't fix (scrapped + b-graded) at their stage rate
      const failedQty = scrapQty + bQty;
      if (failedQty > 0 && stageJobWorkRate > 0) {
        autoDeductionAmount = Math.max(autoDeductionAmount, Math.round(stageJobWorkRate * failedQty));
      }
    }

    const totalDeduction = autoDeductionAmount + autoClothCostRecovery;

    if (totalDeduction > 0 && effectiveWorkerId) {
      const now = new Date();
      const yy = String(now.getFullYear()).substring(2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const prefix = `DED-${yy}${mm}`;

      const { data: lastDeds } = await supabase
        .from("worker_deductions")
        .select("deduction_number")
        .eq("business_id", businessId)
        .like("deduction_number", `${prefix}-%`)
        .order("deduction_number", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (lastDeds && lastDeds.length > 0) {
        const numPart = lastDeds[0].deduction_number.substring(prefix.length + 1);
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      const deductionNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      const deductionType =
        autoClothCostRecovery > 0
          ? "cloth_damage"
          : rework_cost_mode === "free"
          ? "rework_free"
          : "job_work_loss";

      const desc =
        remarks ||
        `Defect penalty on Lot ${lot.lot_number || "N/A"} (${defect.defect_category}) — ` +
          `Mode: ${rework_cost_mode}. Job-work loss: ₹${autoDeductionAmount}, Cloth: ₹${autoClothCostRecovery}`;

      await supabase.from("worker_deductions").insert({
        business_id: businessId,
        deduction_number: deductionNumber,
        worker_id: effectiveWorkerId,
        defect_id: defect.id,
        lot_id: lot.id,
        deduction_date: resolution_date || new Date().toISOString().split("T")[0],
        deduction_type: deductionType,
        amount: totalDeduction,
        description: desc,
        status: "applied",
        created_by: userId,
      });
    }

    // ── 10. Insert Resolution Record ─────────────────────────────────────────
    const { data: resRecord, error: resErr } = await supabase
      .from("defect_resolutions")
      .insert({
        business_id: businessId,
        defect_id: defect.id,
        resolution_type,
        resolution_date: resolution_date || new Date().toISOString().split("T")[0],
        qty_recovered: recQty,
        qty_b_grade: bQty,
        qty_scrapped: scrapQty,
        recovered_size_quantities,
        b_grade_size_quantities,
        scrapped_size_quantities,
        rework_stage_id: rework_stage_id || null,
        rework_worker_id: rework_worker_id || null,
        rework_cost: Number(rework_cost || 0),
        rework_cost_mode,
        deduction_amount: autoDeductionAmount,
        cloth_cost_recovery: autoClothCostRecovery,
        material_write_off_value: materialWriteOffValue,
        waste_reason: waste_reason || null,
        target_godown_id: target_godown_id || null,
        source_finished_stock_id: source_finished_stock_id || null,
        remarks: remarks || null,
        created_by: userId,
      })
      .select()
      .single();

    if (resErr) throw new Error(`Failed to record defect resolution: ${resErr.message}`);

    // ── 11. Link b_grade_stock to resolution ─────────────────────────────────
    if (bQty > 0 && target_godown_id) {
      await supabase
        .from("b_grade_stock")
        .update({ defect_resolution_id: resRecord.id })
        .eq("business_id", businessId)
        .eq("lot_id", lot.id)
        .is("defect_resolution_id", null)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    // ── 12. Update Defect Status ──────────────────────────────────────────────
    let finalStatus = "resolved";
    if (recQty === defect.quantity) finalStatus = "reworked_fixed";
    else if (bQty === defect.quantity) finalStatus = "moved_to_b_grade";
    else if (scrapQty === defect.quantity) finalStatus = "written_off";

    await supabase
      .from("lot_defects")
      .update({ status: finalStatus, updated_at: new Date().toISOString() })
      .eq("id", defect.id);

    // ── 13. Update Lot Aggregates (BUG 4 FIX) ────────────────────────────────
    const { data: currentLot } = await supabase
      .from("production_lots")
      .select("reworked_quantity, b_grade_quantity, scrapped_quantity, defect_quantity")
      .eq("id", lot.id)
      .single();

    if (currentLot) {
      const updates: Record<string, number> = {
        reworked_quantity: Number(currentLot.reworked_quantity || 0) + recQty,
        b_grade_quantity: Number(currentLot.b_grade_quantity || 0) + bQty,
        scrapped_quantity: Number(currentLot.scrapped_quantity || 0) + scrapQty,
      };

      // BUG 4 FIX: For rework-to-lot, reduce defect_quantity so lot knows pieces returned
      if (resolution_type === "reworked_to_lot") {
        updates.defect_quantity = Math.max(0, Number(currentLot.defect_quantity || 0) - recQty);
      }

      await supabase.from("production_lots").update(updates).eq("id", lot.id);
    }

    // ── 14. Stock Reconciliation (Grade A only) ───────────────────────────────
    if (target_godown_id && resolution_type === "reworked_to_stock_grade_a") {
      try {
        const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
        await reconcileFinishedStock(supabase, businessId, lot.design_id);

        const { runStockIntegrityCheck } = await import("@/lib/stock-integrity-watchdog");
        await runStockIntegrityCheck(supabase, businessId, lot.design_id);
      } catch (recErr) {
        console.warn("[defect resolution] Stock reconciliation warning:", recErr);
      }
    }

    await logAudit(businessId, "create", "defect_resolutions", resRecord.id, resRecord, {}, request);

    return NextResponse.json({
      success: true,
      resolution: resRecord,
      summary: {
        qty_recovered: recQty,
        qty_b_grade: bQty,
        qty_scrapped: scrapQty,
        material_write_off_value: materialWriteOffValue,
        worker_deduction_applied: totalDeduction > 0 ? totalDeduction : null,
        rework_cost_mode,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
