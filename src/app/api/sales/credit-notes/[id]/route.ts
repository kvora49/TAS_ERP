import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
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
    const { data: creditNote, error } = await supabase
      .from("credit_notes")
      .select(`
        *,
        party:parties(id, name, company_name, phone, email, gstin, billing_address_line1, billing_city, billing_state, billing_pincode),
        return:sales_returns(id, return_number, return_date, return_reason, grand_total,
          bill:sale_bills(id, bill_number, bill_date))
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error || !creditNote) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    // Also fetch stock ledger entries for item breakdown
    const returnId = creditNote.return_id;
    let ledgerEntries: any[] = [];
    if (returnId) {
      const { data: entries } = await supabase
        .from("stock_ledger")
        .select("*, design:designs(id, name, design_number)")
        .eq("business_id", businessId)
        .eq("reference_table", "sales_returns")
        .eq("reference_id", returnId)
        .eq("transaction_type", "sales_return_inflow");
      ledgerEntries = entries || [];
    }

    return NextResponse.json({ creditNote, ledgerEntries });
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
    // 1. Fetch the credit note
    const { data: creditNote, error: fetchErr } = await supabase
      .from("credit_notes")
      .select("*, return:sales_returns(*)")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (fetchErr || !creditNote) {
      return NextResponse.json({ error: "Credit note not found or access denied" }, { status: 404 });
    }

    // 2. Safeguard: Check if credit note has already been used / allocated
    if (Number(creditNote.used_amount || 0) > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete Credit Note ${creditNote.cn_number}: Amount of ₹${creditNote.used_amount} has already been adjusted/allocated to invoices. Please unallocate first.`,
        },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    const returnId = creditNote.return_id;

    // 3. If linked to a sales return, reverse stock and party balance
    if (returnId) {
      const { data: sReturn } = await supabase
        .from("sales_returns")
        .select("*")
        .eq("id", returnId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (sReturn) {
        // Reverse customer party balance
        if (sReturn.party_id && Number(sReturn.grand_total || 0) > 0) {
          const { data: party } = await supabase
            .from("parties")
            .select("current_balance")
            .eq("id", sReturn.party_id)
            .maybeSingle();

          if (party) {
            const newBal = Number(party.current_balance || 0) + Number(sReturn.grand_total || 0);
            await supabase
              .from("parties")
              .update({ current_balance: newBal, updated_at: new Date().toISOString() })
              .eq("id", sReturn.party_id);
          }

          await supabase
            .from("party_ledger")
            .update({ deleted_at: new Date().toISOString() })
            .eq("reference_id", returnId);
        }

        // Reverse stock ledger & finished_stock
        const { data: ledgerEntries } = await supabase
          .from("stock_ledger")
          .select("*")
          .eq("business_id", businessId)
          .eq("reference_table", "sales_returns")
          .eq("reference_id", returnId)
          .eq("transaction_type", "sales_return_inflow");

        if (ledgerEntries && ledgerEntries.length > 0) {
          for (const entry of ledgerEntries) {
            const qty = Math.abs(Number(entry.quantity_delta || 0));
            const val = Math.abs(Number(entry.value_delta || 0));
            if (qty <= 0) continue;

            // Insert reversal into stock_ledger
            await supabase.from("stock_ledger").insert({
              business_id: businessId,
              item_type: "finished_good",
              item_id: entry.item_id,
              godown_id: entry.godown_id,
              transaction_type: "sales_return_reversal",
              quantity_delta: -qty,
              value_delta: -val,
              reference_table: "sales_returns",
              reference_id: returnId,
              created_by: user?.id || null,
            });

            // Deduct from finished_stock
            const { data: fsRows } = await supabase
              .from("finished_stock")
              .select("*")
              .eq("business_id", businessId)
              .eq("design_id", entry.item_id)
              .eq("godown_id", entry.godown_id);

            if (fsRows && fsRows.length > 0) {
              const fs = fsRows[0];
              const newTotalQty = Math.max(0, Number(fs.total_quantity || 0) - qty);
              const costPerPiece = Number(fs.cost_per_piece || 0);
              const newTotalValue = newTotalQty * costPerPiece;

              await supabase
                .from("finished_stock")
                .update({
                  total_quantity: newTotalQty,
                  total_value: newTotalValue,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", fs.id);
            }
          }
        }

        // Delete the sales_returns record
        await supabase.from("sales_returns").delete().eq("id", returnId).eq("business_id", businessId);
      }
    }

    // 4. Delete the credit note
    const { error: deleteErr } = await supabase
      .from("credit_notes")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 5. Log audit trail
    await logAudit(
      businessId,
      "delete_credit_note",
      "credit_notes",
      id,
      { deleted: true, stock_reversed: !!returnId },
      { cn_number: creditNote.cn_number, amount: creditNote.amount },
      request
    );

    return NextResponse.json({
      success: true,
      message: `Credit note ${creditNote.cn_number} deleted. Stock restored & party balance updated.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
