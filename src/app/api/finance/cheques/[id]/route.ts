import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

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
    const { data: cheque, error } = await supabase
      .from("cheques")
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*),
        payment:payments(
          *,
          allocations:payment_allocations(*)
        )
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!cheque) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    return NextResponse.json({ cheque });
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
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!businessId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const body = await request.json();
    const {
      status,
      received_account_id,
      deposited_date,
      cleared_date,
      bounce_reason,
      bounce_charges,
      remarks,
      debit_party,
    } = body;

    // Fetch existing cheque
    const { data: existing, error: fetchErr } = await supabase
      .from("cheques")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    const targetStatus = status !== undefined ? status : existing.status;
    const targetAccountId = received_account_id !== undefined ? (received_account_id || null) : existing.received_account_id;
    const effectiveClearedDate = cleared_date || (targetStatus === "cleared" ? new Date().toISOString().split("T")[0] : null);

    // Call the atomic process_cheque_status_update RPC to update bank balance
    const { error: updateErr } = await supabase
      .rpc("process_cheque_status_update", {
        p_cheque_id: id,
        p_business_id: businessId,
        p_new_status: targetStatus,
        p_received_account_id: targetAccountId,
        p_remarks: remarks !== undefined ? (remarks || null) : existing.remarks,
        p_deposited_date: deposited_date || null,
        p_cleared_date: effectiveClearedDate,
        p_bounce_reason: bounce_reason || null,
        p_bounce_charges: bounce_charges ? Number(bounce_charges) : null,
      });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 1. If transitioning to CLEARED
    if (targetStatus === "cleared" && existing.status !== "cleared") {
      // If there is no existing payment linked, create a payment voucher
      if (!existing.payment_id) {
        const todayStr = effectiveClearedDate || new Date().toISOString().split("T")[0];
        const dateCode = todayStr.replace(/-/g, "");
        const prefix = existing.direction === "received" ? "REC-" : "PAY-";

        const { count } = await supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("direction", existing.direction);

        const seqNo = String((count || 0) + 1).padStart(4, "0");
        const paymentNumber = `${prefix}${dateCode}-${seqNo}`;

        const allocationsList = Array.isArray(existing.allocations) ? existing.allocations : [];
        const allocatedTotal = allocationsList.reduce(
          (sum: number, a: any) => sum + Number(a.allocatedAmount || 0),
          0
        );
        const unallocatedAmount = Math.max(0, Number(existing.amount) - allocatedTotal);
        const isAdvance = unallocatedAmount > 0 || existing.settlement_type === "on_account";

        // Insert into payments
        const { data: newPayment, error: paymentInsertErr } = await supabase
          .from("payments")
          .insert({
            business_id: businessId,
            payment_number: paymentNumber,
            direction: existing.direction,
            party_id: existing.party_id,
            payment_date: todayStr,
            payment_mode: "cheque",
            reference_no: existing.cheque_number,
            bank_account_id: targetAccountId,
            amount: Number(existing.amount),
            unallocated_amount: unallocatedAmount,
            is_advance: isAdvance,
            remarks: remarks || `Cheque #${existing.cheque_number} cleared`,
            status: "completed",
            created_by: userId,
          })
          .select("id")
          .single();

        if (!paymentInsertErr && newPayment?.id) {
          const paymentId = newPayment.id;

          // Settle allocations on respective bills
          for (const alloc of allocationsList) {
            const allocAmt = Number(alloc.allocatedAmount || 0);
            if (allocAmt <= 0) continue;

            // Insert payment_allocation
            await supabase.from("payment_allocations").insert({
              business_id: businessId,
              payment_id: paymentId,
              bill_type: alloc.billType,
              bill_id: alloc.billId,
              allocated_amount: allocAmt,
            });

            // Update respective bill
            if (alloc.billType === "sale_bill") {
              const { data: sb } = await supabase
                .from("sale_bills")
                .select("paid_amount, grand_total")
                .eq("id", alloc.billId)
                .single();
              if (sb) {
                const newPaid = Number(sb.paid_amount || 0) + allocAmt;
                const newStatus = newPaid >= Number(sb.grand_total || 0) ? "paid" : "partially_paid";
                await supabase
                  .from("sale_bills")
                  .update({ paid_amount: newPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
                  .eq("id", alloc.billId);
              }
            } else if (alloc.billType === "purchase_bill") {
              const { data: pb } = await supabase
                .from("purchase_bills")
                .select("paid_amount, grand_total")
                .eq("id", alloc.billId)
                .single();
              if (pb) {
                const newPaid = Number(pb.paid_amount || 0) + allocAmt;
                const newStatus = newPaid >= Number(pb.grand_total || 0) ? "paid" : "partially_paid";
                await supabase
                  .from("purchase_bills")
                  .update({ paid_amount: newPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
                  .eq("id", alloc.billId);
              }
            } else if (alloc.billType === "raw_material_purchase") {
              const { data: rm } = await supabase
                .from("raw_material_purchases")
                .select("paid_amount, grand_total")
                .eq("id", alloc.billId)
                .single();
              if (rm) {
                const newPaid = Number(rm.paid_amount || 0) + allocAmt;
                const newStatus = newPaid >= Number(rm.grand_total || 0) ? "paid" : "partially_paid";
                await supabase
                  .from("raw_material_purchases")
                  .update({ paid_amount: newPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
                  .eq("id", alloc.billId);
              }
            } else if (alloc.billType === "job_work_entry") {
              const { data: jw } = await supabase
                .from("stage_entries")
                .select("paid_amount, total_job_work_amount")
                .eq("id", alloc.billId)
                .single();
              if (jw) {
                const newPaid = Number(jw.paid_amount || 0) + allocAmt;
                const newStatus = newPaid >= Number(jw.total_job_work_amount || 0) ? "paid" : "partially_paid";
                await supabase
                  .from("stage_entries")
                  .update({ paid_amount: newPaid, payment_status: newStatus })
                  .eq("id", alloc.billId);
              }
            }
          }

          // If unallocated amount > 0, insert into advance_payments
          if (unallocatedAmount > 0 && existing.party_id) {
            await supabase.from("advance_payments").insert({
              business_id: businessId,
              payment_id: paymentId,
              party_id: existing.party_id,
              advance_amount: unallocatedAmount,
              settled_amount: 0,
              remaining_amount: unallocatedAmount,
              is_settled: false,
            });
          }

          // Link payment_id to cheque
          await supabase
            .from("cheques")
            .update({ payment_id: paymentId })
            .eq("id", id);
        }
      }
    }

    // 2. If transitioning to BOUNCED or CANCELLED from CLEARED
    if ((targetStatus === "bounced" || targetStatus === "cancelled") && existing.status === "cleared") {
      if (existing.payment_id) {
        // Mark payment as bounced or cancelled
        await supabase
          .from("payments")
          .update({ status: targetStatus, updated_at: new Date().toISOString() })
          .eq("id", existing.payment_id);

        // Fetch allocations and revert bills
        const { data: allocationsToRevert } = await supabase
          .from("payment_allocations")
          .select("bill_type, bill_id, allocated_amount")
          .eq("payment_id", existing.payment_id);

        for (const alloc of (allocationsToRevert || [])) {
          const allocAmt = Number(alloc.allocated_amount || 0);
          if (alloc.bill_type === "sale_bill") {
            const { data: sb } = await supabase
              .from("sale_bills")
              .select("paid_amount, grand_total")
              .eq("id", alloc.bill_id)
              .single();
            if (sb) {
              const newPaid = Math.max(0, Number(sb.paid_amount || 0) - allocAmt);
              const newStatus = newPaid <= 0 ? "unpaid" : "partially_paid";
              await supabase
                .from("sale_bills")
                .update({ paid_amount: newPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", alloc.bill_id);
            }
          } else if (alloc.bill_type === "purchase_bill") {
            const { data: pb } = await supabase
              .from("purchase_bills")
              .select("paid_amount, grand_total")
              .eq("id", alloc.bill_id)
              .single();
            if (pb) {
              const newPaid = Math.max(0, Number(pb.paid_amount || 0) - allocAmt);
              const newStatus = newPaid <= 0 ? "unpaid" : "partially_paid";
              await supabase
                .from("purchase_bills")
                .update({ paid_amount: newPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", alloc.bill_id);
            }
          } else if (alloc.bill_type === "raw_material_purchase") {
            const { data: rm } = await supabase
              .from("raw_material_purchases")
              .select("paid_amount, grand_total")
              .eq("id", alloc.bill_id)
              .single();
            if (rm) {
              const newPaid = Math.max(0, Number(rm.paid_amount || 0) - allocAmt);
              const newStatus = newPaid <= 0 ? "unpaid" : "partially_paid";
              await supabase
                .from("raw_material_purchases")
                .update({ paid_amount: newPaid, payment_status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", alloc.bill_id);
            }
          } else if (alloc.bill_type === "job_work_entry") {
            const { data: jw } = await supabase
              .from("stage_entries")
              .select("paid_amount")
              .eq("id", alloc.bill_id)
              .single();
            if (jw) {
              const newPaid = Math.max(0, Number(jw.paid_amount || 0) - allocAmt);
              const newStatus = newPaid <= 0 ? "unpaid" : "partially_paid";
              await supabase
                .from("stage_entries")
                .update({ paid_amount: newPaid, payment_status: newStatus })
                .eq("id", alloc.bill_id);
            }
          }
        }

        // Mark advance payment as voided/cancelled
        await supabase
          .from("advance_payments")
          .update({ is_settled: true, remaining_amount: 0, updated_at: new Date().toISOString() })
          .eq("payment_id", existing.payment_id);
      }
    }

    // 3. If BOUNCED and user requested to debit penalty to party ledger
    if (targetStatus === "bounced" && debit_party && Number(bounce_charges || 0) > 0 && existing.party_id) {
      const penaltyAmt = Number(bounce_charges);
      const dnNumber = `DN-BNC-${Date.now().toString().slice(-6)}`;
      const { data: dn } = await supabase
        .from("debit_notes")
        .insert({
          business_id: businessId,
          party_id: existing.party_id,
          dn_number: dnNumber,
          dn_date: new Date().toISOString().split("T")[0],
          amount: penaltyAmt,
          reason: `Cheque #${existing.cheque_number} bounce penalty charge: ${bounce_reason || "Dishonored"}`,
        })
        .select("id")
        .single();

      if (dn?.id) {
        await supabase
          .from("cheques")
          .update({ debit_note_id: dn.id })
          .eq("id", id);
      }
    }

    // Query the updated cheque with all relationships
    const { data: updatedCheque, error: selectErr } = await supabase
      .from("cheques")
      .select(`
        *,
        party:parties(*),
        received_account:bank_accounts(*),
        payment:payments(
          *,
          allocations:payment_allocations(*)
        )
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (selectErr) {
      return NextResponse.json({ error: selectErr.message }, { status: 500 });
    }

    return NextResponse.json({ cheque: updatedCheque });
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
    const { data: success, error } = await supabase
      .rpc("delete_cheque", {
        p_cheque_id: id,
        p_business_id: businessId
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!success) {
      return NextResponse.json({ error: "Cheque not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
