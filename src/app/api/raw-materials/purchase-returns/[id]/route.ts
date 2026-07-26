import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    // 1. Fetch Return
    const { data: pReturn, error: returnError } = await supabase
      .from("purchase_returns")
      .select("*, supplier:parties(id, name, company_name), purchase:raw_material_purchases(id, purchase_number, invoice_no)")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (returnError) {
      return NextResponse.json({ error: returnError.message }, { status: 404 });
    }

    // 2. Fetch Return Items
    const { data: items, error: itemsError } = await supabase
      .from("purchase_return_items")
      .select("*, material_type:raw_material_types(name, category)")
      .eq("return_id", id)
      .eq("business_id", businessId);

    return NextResponse.json({
      return: {
        ...pReturn,
        items: items || [],
      },
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
      status, // 'pending', 'completed', 'cancelled'
      remarks,
      reason,
    } = body;

    // Fetch existing return
    const { data: existingReturn, error: fetchErr } = await supabase
      .from("purchase_returns")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .single();

    if (fetchErr || !existingReturn) {
      return NextResponse.json({ error: "Purchase Return not found" }, { status: 404 });
    }

    // Update return fields
    const { data: updatedReturn, error: updateErr } = await supabase
      .from("purchase_returns")
      .update({
        status: status || existingReturn.status,
        remarks: remarks !== undefined ? remarks : existingReturn.remarks,
        reason: reason !== undefined ? reason : existingReturn.reason,
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // If status transitioned to 'completed' and godown_id is specified, automatically generate a stock entry and write to stock_ledger
    if (status === "completed" && existingReturn.status !== "completed" && existingReturn.godown_id) {
      // Fetch items of the return
      const { data: returnItems } = await supabase
        .from("purchase_return_items")
        .select("*")
        .eq("return_id", id)
        .eq("business_id", businessId);

      if (returnItems && returnItems.length > 0) {
        // 1. Write negative delta to stock_ledger
        const { data: { user } } = await supabase.auth.getUser();
        const ledgerEntries = returnItems.map((item: any) => ({
          business_id: businessId,
          item_type: 'raw_material',
          item_id: item.material_type_id,
          godown_id: existingReturn.godown_id,
          transaction_type: 'purchase_return',
          quantity_delta: -Number(item.returned_qty),
          value_delta: -Number(item.taxable_value),
          reference_table: 'purchase_returns',
          reference_id: id,
          created_by: user?.id || null,
        }));

        const { error: ledgerError } = await supabase
          .from("stock_ledger")
          .insert(ledgerEntries);

        if (ledgerError) {
          // Revert purchase return update
          await supabase
            .from("purchase_returns")
            .update({ status: existingReturn.status })
            .eq("id", id);
          return NextResponse.json({ error: "Failed to create stock ledger entries: " + ledgerError.message }, { status: 500 });
        }

        // 2. Generate legacy stock entry
        const { data: stockEntry, error: seError } = await supabase
          .from("raw_material_stock_entries")
          .insert({
            business_id: businessId,
            stock_entry_number: `STK-OUT-${existingReturn.return_number}`,
            entry_type: "stock_out",
            reference_type: "return",
            reference_id: id,
            reference_no: existingReturn.return_number,
            reference_date: existingReturn.return_date,
            godown_id: existingReturn.godown_id,
            posting_date: new Date().toISOString().split("T")[0],
            remarks: `Auto-generated from Completed Purchase Return ${existingReturn.return_number}`,
            total_items_value: Number(existingReturn.total_taxable_value || 0),
            grand_total: Number(existingReturn.grand_total || 0),
            status: "active",
          })
          .select()
          .single();

        if (!seError && stockEntry) {
          const seItems = returnItems.map((item: any) => ({
            business_id: businessId,
            stock_entry_id: stockEntry.id,
            material_type_id: item.material_type_id,
            hsn_sac: item.hsn_sac || null,
            unit: item.unit,
            quantity: Number(item.returned_qty),
            rate: Number(item.rate),
            amount: Number(item.taxable_value),
          }));

          await supabase.from("raw_material_stock_entry_items").insert(seItems);
        }
      }
    }

    // If status transitioned to 'cancelled' and it was completed, cancel the stock entry and reverse stock_ledger
    if (status === "cancelled" && existingReturn.status === "completed") {
      // 1. Cancel the legacy stock entry
      await supabase
        .from("raw_material_stock_entries")
        .update({ status: "cancelled" })
        .eq("reference_type", "return")
        .eq("reference_id", id)
        .eq("business_id", businessId);

      // 2. Revert entries in stock_ledger (insert positive delta)
      const { data: returnItems } = await supabase
        .from("purchase_return_items")
        .select("*")
        .eq("return_id", id)
        .eq("business_id", businessId);

      if (returnItems && returnItems.length > 0 && existingReturn.godown_id) {
        const { data: { user } } = await supabase.auth.getUser();
        const ledgerEntries = returnItems.map((item: any) => ({
          business_id: businessId,
          item_type: 'raw_material',
          item_id: item.material_type_id,
          godown_id: existingReturn.godown_id,
          transaction_type: 'purchase_return',
          quantity_delta: Number(item.returned_qty), // Positive delta to restore stock
          value_delta: Number(item.taxable_value), // Positive delta to restore stock value
          reference_table: 'purchase_returns',
          reference_id: id,
          created_by: user?.id || null,
        }));

        await supabase.from("stock_ledger").insert(ledgerEntries);
      }
    }

    return NextResponse.json({ return: updatedReturn });
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
    const { data: pReturn } = await supabase
      .from("purchase_returns")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!pReturn) {
      return NextResponse.json({ error: "Purchase return not found or access denied" }, { status: 404 });
    }

    // 🔒 GUARDRAIL: If purchase return / debit note has been settled or adjusted, block cancellation!
    if (pReturn.debit_note_id) {
      const { data: dn } = await supabase
        .from("debit_notes")
        .select("status, amount_adjusted")
        .eq("id", pReturn.debit_note_id)
        .eq("business_id", businessId)
        .maybeSingle();

      if (dn && (dn.status === "settled" || Number(dn.amount_adjusted || 0) > 0)) {
        return NextResponse.json(
          { error: "Cannot cancel this purchase return because the associated Debit Note has already been settled or adjusted against payments." },
          { status: 400 }
        );
      }
    }

    const { data: returnItems } = await supabase
      .from("purchase_return_items")
      .select("*")
      .eq("return_id", id)
      .eq("business_id", businessId);

    const { data: { user } } = await supabase.auth.getUser();

    // 1. Revert Stock: Restore stock that was returned to supplier (Finished Goods & Raw Materials)
    if (returnItems && returnItems.length > 0 && pReturn.godown_id) {
      for (const item of returnItems) {
        const qty = Number(item.returned_qty || 0);
        const val = Number(item.taxable_value || (qty * Number(item.rate || 0)));

        if (item.item_type === "finished_goods" && item.design_id) {
          // Restore Finished Goods stock to Godown
          await supabase.from("finished_stock").insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id || null,
            godown_id: pReturn.godown_id,
            entry_type: "adjustment",
            size_quantities: item.size_quantities || {},
            total_quantity: qty,
            cost_per_piece: Number(item.rate || 0),
            total_value: val,
            notes: `Restored stock from cancelled Purchase Return ${pReturn.return_number}`,
          });

          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "finished_good",
            item_id: item.design_id,
            godown_id: pReturn.godown_id,
            transaction_type: "purchase_return_cancellation",
            quantity_delta: qty,
            value_delta: val,
            reference_table: "purchase_returns",
            reference_id: id,
            created_by: user?.id || null,
          });
        } else if (item.material_type_id) {
          // Restore Fabric rolls remaining meters if applicable
          if (item.item_type === "fabric") {
            const { data: retRolls } = await supabase
              .from("purchase_return_rolls")
              .select("*")
              .eq("return_item_id", item.id)
              .eq("business_id", businessId);

            if (retRolls && retRolls.length > 0) {
              for (const rRoll of retRolls) {
                const { data: origRoll } = await supabase
                  .from("purchase_rolls")
                  .select("remaining_meters")
                  .eq("id", rRoll.purchase_roll_id)
                  .maybeSingle();

                if (origRoll) {
                  await supabase
                    .from("purchase_rolls")
                    .update({
                      remaining_meters: Number(origRoll.remaining_meters || 0) + Number(rRoll.returned_meters || 0),
                    })
                    .eq("id", rRoll.purchase_roll_id);
                }
              }
            }
          }

          // Insert positive delta entry in stock_ledger for Raw Materials
          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "raw_material",
            item_id: item.material_type_id,
            godown_id: pReturn.godown_id,
            transaction_type: "purchase_return_cancellation",
            quantity_delta: qty,
            value_delta: val,
            reference_table: "purchase_returns",
            reference_id: id,
            created_by: user?.id || null,
          });

          // Update raw_material_current_stock for godown
          const { data: stockEntry } = await supabase
            .from("raw_material_current_stock")
            .select("*")
            .eq("business_id", businessId)
            .eq("material_type_id", item.material_type_id)
            .eq("godown_id", pReturn.godown_id)
            .maybeSingle();

          if (stockEntry) {
            const updatedQty = Number(stockEntry.current_stock || 0) + qty;
            const updatedValue = Number(stockEntry.stock_value || 0) + val;
            const updatedUnitCost = updatedQty > 0 ? updatedValue / updatedQty : Number(stockEntry.unit_cost || 0);

            await supabase
              .from("raw_material_current_stock")
              .update({
                current_stock: updatedQty,
                stock_value: updatedValue,
                unit_cost: updatedUnitCost,
                updated_at: new Date().toISOString(),
              })
              .eq("id", stockEntry.id);
          }
        }
      }
    }

    // 2. Soft-delete Purchase Return & cancel associated Debit Note if active
    await supabase
      .from("purchase_returns")
      .update({
        status: "cancelled",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("business_id", businessId);

    if (pReturn.debit_note_id) {
      await supabase
        .from("debit_notes")
        .update({ status: "cancelled" })
        .eq("id", pReturn.debit_note_id)
        .eq("business_id", businessId);
    }

    // 3. Record Audit Log
    await supabase.from("audit_log").insert({
      business_id: businessId,
      user_id: user?.id || null,
      user_name: user?.user_metadata?.full_name || user?.email || "System",
      action: "cancel_purchase_return",
      table_name: "purchase_returns",
      record_id: id,
      old_values: { return_number: pReturn.return_number, grand_total: pReturn.grand_total, status: pReturn.status },
      new_values: { status: "cancelled", deleted_at: new Date().toISOString() },
      ip_address: "127.0.0.1",
      user_agent: "NextJS Server",
    });

    return NextResponse.json({ success: true, message: `Purchase Return '${pReturn.return_number}' cancelled and stock restored.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}
