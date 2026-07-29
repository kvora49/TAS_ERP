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
    const { data: sReturn, error } = await supabase
      .from("sales_returns")
      .select(`
        *,
        party:parties(id, name, company_name, phone, email, gstin, billing_address_line1, billing_city, billing_state, billing_pincode),
        bill:sale_bills(id, bill_number, bill_date, grand_total),
        credit_note:credit_notes(*)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!sReturn) {
      return NextResponse.json({ error: "Sales return not found" }, { status: 404 });
    }

    // Fetch stock ledger entries linked to this return to reconstruct item list
    const { data: rawLedger } = await supabase
      .from("stock_ledger")
      .select("*")
      .eq("business_id", businessId)
      .eq("reference_table", "sales_returns")
      .eq("reference_id", id);

    let ledgerEntries: any[] = [];
    if (rawLedger && rawLedger.length > 0) {
      const designIds = rawLedger.map((r) => r.item_id).filter(Boolean);
      let designMap = new Map<string, any>();
      if (designIds.length > 0) {
        const { data: designs } = await supabase
          .from("designs")
          .select("id, name, design_number")
          .in("id", designIds);

        (designs || []).forEach((d) => designMap.set(d.id, d));
      }

      ledgerEntries = rawLedger.map((r) => ({
        ...r,
        design: designMap.get(r.item_id) || { name: "Returned Item", design_number: "SR-ITEM" },
      }));
    }

    return NextResponse.json({ return: sReturn, ledgerEntries });
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
    // 1. Fetch the return to validate ownership
    const { data: sReturn } = await supabase
      .from("sales_returns")
      .select("*, credit_note:credit_notes(*)")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!sReturn) {
      return NextResponse.json({ error: "Sales return not found or access denied" }, { status: 404 });
    }

    // 1.5 Safeguard: Check if credit note has already been adjusted / allocated
    const creditNote = Array.isArray(sReturn.credit_note) ? sReturn.credit_note[0] : sReturn.credit_note;
    if (creditNote && Number(creditNote.used_amount || 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete sales return ${sReturn.return_number}: Credit note amount of ₹${creditNote.used_amount} has already been adjusted or allocated to invoices. Please unallocate first.` },
        { status: 400 }
      );
    }

    // 2. Reverse customer party balance & soft-delete party ledger entry
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
        .eq("reference_id", id);
    }

    // 3. Fetch stock ledger entries from when this return was created (inflow entries)
    const { data: ledgerEntries } = await supabase
      .from("stock_ledger")
      .select("*")
      .eq("business_id", businessId)
      .eq("reference_table", "sales_returns")
      .eq("reference_id", id)
      .eq("transaction_type", "sales_return_inflow");

    const { data: { user } } = await supabase.auth.getUser();

    // 3. For each inflow, reverse the finished_stock and insert a negative ledger entry
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
          reference_id: id,
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

    // 4. Delete linked credit note
    await supabase.from("credit_notes").delete().eq("return_id", id).eq("business_id", businessId);

    // 5. Delete the sales return itself
    const { error } = await supabase
      .from("sales_returns")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 6. Audit log
    await supabase.from("audit_log").insert({
      business_id: businessId,
      user_id: user?.id || null,
      user_name: user?.user_metadata?.full_name || user?.email || "System",
      action: "delete_sales_return",
      table_name: "sales_returns",
      record_id: id,
      old_values: { return_number: sReturn.return_number, grand_total: sReturn.grand_total },
      new_values: { deleted: true },
      ip_address: "127.0.0.1",
      user_agent: "NextJS Server",
    });

    return NextResponse.json({
      success: true,
      message: `Sales return ${sReturn.return_number} deleted. Credit note cancelled. Stock reversed.`,
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
  const body = await request.json();

  try {
    const { return_date, return_reason, grand_total, items } = body;

    // 1. Fetch current sales return to compare old values
    const { data: sReturn } = await supabase
      .from("sales_returns")
      .select("*, credit_note:credit_notes(*)")
      .eq("id", id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!sReturn) {
      return NextResponse.json({ error: "Sales return not found" }, { status: 404 });
    }

    const oldGrandTotal = Number(sReturn.grand_total || 0);
    const newGrandTotal = grand_total !== undefined ? Number(grand_total) : oldGrandTotal;
    const deltaGrandTotal = newGrandTotal - oldGrandTotal;

    // 2. Update Sales Return record
    const { data: updated, error } = await supabase
      .from("sales_returns")
      .update({
        ...(return_date && { return_date }),
        ...(return_reason !== undefined && { return_reason }),
        grand_total: newGrandTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Update Credit Note amount if grand_total changed
    if (deltaGrandTotal !== 0) {
      const creditNote = Array.isArray(sReturn.credit_note) ? sReturn.credit_note[0] : sReturn.credit_note;
      if (creditNote) {
        await supabase
          .from("credit_notes")
          .update({ amount: newGrandTotal, updated_at: new Date().toISOString() })
          .eq("id", creditNote.id);
      }

      // 4. Update Customer Party Balance (Delta adjustment: current_balance -= deltaGrandTotal)
      if (sReturn.party_id) {
        const { data: party } = await supabase
          .from("parties")
          .select("current_balance")
          .eq("id", sReturn.party_id)
          .maybeSingle();

        if (party) {
          const newBal = Math.max(0, Number(party.current_balance || 0) - deltaGrandTotal);
          await supabase
            .from("parties")
            .update({ current_balance: newBal, updated_at: new Date().toISOString() })
            .eq("id", sReturn.party_id);
        }
      }
    }

    // 5. Update or insert items in stock_ledger
    if (Array.isArray(items) && items.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();

      for (const item of items) {
        const qty = Math.abs(Number(item.quantity || 0));
        const amount = Math.abs(Number(item.amount || 0));
        if (qty <= 0) continue;

        if (item.id) {
          // Update existing ledger entry
          await supabase
            .from("stock_ledger")
            .update({
              quantity_delta: qty,
              value_delta: amount,
            })
            .eq("id", item.id);
        } else if (item.item_id) {
          const targetGodownId = item.godown_id || sReturn.godown_id || null;
          // Insert new ledger entry for added item from invoice
          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "finished_good",
            item_id: item.item_id,
            godown_id: targetGodownId,
            transaction_type: "sales_return_inflow",
            quantity_delta: qty,
            value_delta: amount,
            reference_table: "sales_returns",
            reference_id: id,
            created_by: user?.id || null,
          });

          // Update finished_stock for new item
          if (targetGodownId) {
            const { data: fsRows } = await supabase
              .from("finished_stock")
              .select("*")
              .eq("business_id", businessId)
              .eq("design_id", item.item_id)
              .eq("godown_id", targetGodownId);

            if (fsRows && fsRows.length > 0) {
              const fs = fsRows[0];
              const newTotalQty = Number(fs.total_quantity || 0) + qty;
              const costPerPiece = Number(fs.cost_per_piece || (qty > 0 ? amount / qty : 0));
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
      }
    }

    return NextResponse.json({ success: true, return: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
