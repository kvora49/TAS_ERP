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
    const { data: ledgerEntries } = await supabase
      .from("stock_ledger")
      .select(`
        *,
        design:finished_designs(id, name, design_number)
      `)
      .eq("business_id", businessId)
      .eq("reference_table", "sales_returns")
      .eq("reference_id", id)
      .eq("transaction_type", "sales_return_inflow");

    return NextResponse.json({ return: sReturn, ledgerEntries: ledgerEntries || [] });
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

    // 2. Fetch stock ledger entries from when this return was created (inflow entries)
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
