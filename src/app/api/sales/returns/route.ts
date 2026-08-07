import { NextResponse } from "next/server";
import { createClient, getSessionBusinessId } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const startDate = searchParams.get("start_date") || "";
  const endDate = searchParams.get("end_date") || "";

  try {
    let query = supabase
      .from("sales_returns")
      .select(`
        *,
        party:parties(*),
        bill:sale_bills(bill_number),
        credit_note:credit_notes(*)
      `)
      .eq("business_id", businessId);

    if (status) {
      query = query.eq("status", status);
    }
    if (startDate) {
      query = query.gte("return_date", startDate);
    }
    if (endDate) {
      query = query.lte("return_date", endDate);
    }

    const { data: returns, error } = await query
      .order("return_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Client-side search filtering
    let filtered = returns || [];
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (r: any) =>
          r.return_number.toLowerCase().includes(term) ||
          (r.party?.name && r.party.name.toLowerCase().includes(term)) ||
          (r.return_reason && r.return_reason.toLowerCase().includes(term))
      );
    }

    return NextResponse.json({ returns: filtered });
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
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!businessId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      party_id,
      original_bill_id,
      return_date,
      return_reason,
      grand_total,
      // Stock return details
      design_id,
      colour_id,
      godown_id,
      size_quantities,
      total_quantity
    } = body;

    if (!party_id) {
      return NextResponse.json({ error: "Customer is required" }, { status: 400 });
    }
    if (!return_date) {
      return NextResponse.json({ error: "Return date is required" }, { status: 400 });
    }
    if (!grand_total || Number(grand_total) <= 0) {
      return NextResponse.json({ error: "Return total value must be greater than 0" }, { status: 400 });
    }

    // 1. Generate Return Number (SR-YYYY-XXXX)
    const year = new Date(return_date).getFullYear();
    const { count: returnCount } = await supabase
      .from("sales_returns")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);

    const sequence = String((returnCount || 0) + 1).padStart(4, "0");
    const returnNumber = `SR-${year}-${sequence}`;

    // 2. Generate Credit Note Number (CN-YYYY-XXXX)
    const { count: cnCount } = await supabase
      .from("credit_notes")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", `${year}-01-01T00:00:00Z`);
    const cnSequence = String((cnCount || 0) + 1).padStart(4, "0");
    const cnNumber = `CN-${year}-${cnSequence}`;

    // 3. Save Sales Return Header (initially pending or auto-approved)
    const { data: sReturn, error: returnErr } = await supabase
      .from("sales_returns")
      .insert({
        business_id: businessId,
        return_number: returnNumber,
        party_id,
        original_bill_id: original_bill_id || null,
        return_date,
        return_reason: return_reason || null,
        gst_type: body.gst_type || "with_gst",
        taxable_amount: Number(body.taxable_amount || 0),
        cgst: Number(body.cgst || 0),
        sgst: Number(body.sgst || 0),
        igst: Number(body.igst || 0),
        round_off: Number(body.round_off || 0),
        grand_total: Number(grand_total),
        status: "approved", // Auto-approved to directly apply stock & credit note
        approved_by: userId,
        approved_at: new Date().toISOString(),
        created_by: userId
      })
      .select()
      .single();

    if (returnErr) {
      return NextResponse.json({ error: returnErr.message }, { status: 500 });
    }

    // 4. Insert Return Items into sales_return_items
    const returnItems = body.items || [];
    if (returnItems.length > 0) {
      const itemsToInsert = returnItems.map((item: any) => ({
        business_id: businessId,
        return_id: sReturn.id,
        sale_item_id: item.sale_item_id || null,
        design_id: item.design_id || null,
        colour_id: item.colour_id || null,
        size: item.size || null,
        returned_qty: Number(item.return_qty || item.quantity || 0),
        unit_rate: Number(item.unit_rate || item.rate || 0),
        taxable_amount: Number(item.taxable_amount || (Number(item.return_qty || item.quantity || 0) * Number(item.unit_rate || item.rate || 0))),
        gst_percent: Number(item.gst_percent || item.tax_percent || 0),
        gst_amount: Number(item.gst_amount || 0),
        amount: Number(item.amount || 0),
      }));

      await supabase.from("sales_return_items").insert(itemsToInsert);
    }

    // 5. Create Linked Credit Note
    const { data: creditNote, error: cnErr } = await supabase
      .from("credit_notes")
      .insert({
        business_id: businessId,
        cn_number: cnNumber,
        party_id,
        return_id: sReturn.id,
        cn_date: return_date,
        amount: Number(grand_total),
        reason: `Sales Return ${returnNumber}`
      })
      .select()
      .single();

    if (cnErr) {
      // Soft rollback: delete the return
      await supabase.from("sales_returns").delete().eq("id", sReturn.id);
      return NextResponse.json({ error: "Failed to generate credit note: " + cnErr.message }, { status: 500 });
    }

    // Update return with credit_note_id
    await supabase
      .from("sales_returns")
      .update({ credit_note_id: creditNote.id })
      .eq("id", sReturn.id);

    // 6. Add back returned stock into finished_stock
    const targetGodownId = body.godown_id || null;

    if (returnItems.length > 0 && targetGodownId) {
      for (const item of returnItems) {
        const qty = Number(item.return_qty || item.quantity || 0);
        if (qty <= 0) continue;

        let { data: fsRows } = await supabase
          .from("finished_stock")
          .select("*")
          .eq("business_id", businessId)
          .eq("design_id", item.design_id);

        if (item.colour_id && fsRows && fsRows.length > 0) {
          const matchCol = fsRows.filter((r) => r.colour_id === item.colour_id);
          if (matchCol.length > 0) fsRows = matchCol;
        }

        if (fsRows && fsRows.length > 0) {
          const fs = fsRows[0];
          const currentSizes = fs.size_quantities || {};
          const sz = item.size || "all";
          const newSzQty = Number(currentSizes[sz] || 0) + qty;
          const newTotalQty = Number(fs.total_quantity || 0) + qty;
          const costPerPiece = Number(fs.cost_per_piece || (item.unit_rate || item.rate || 0));
          const newTotalValue = newTotalQty * costPerPiece;

          const updatedSizes = { ...currentSizes };
          if (sz !== "all") {
            updatedSizes[sz] = newSzQty;
          }

          await supabase
            .from("finished_stock")
            .update({
              size_quantities: updatedSizes,
              total_quantity: newTotalQty,
              total_value: newTotalValue,
              updated_at: new Date().toISOString(),
            })
            .eq("id", fs.id);
        } else {
          const sz = item.size || "all";
          const sizeQty = sz !== "all" ? { [sz]: qty } : {};
          const costPerPiece = Number(item.unit_rate || item.rate || 0);
          await supabase.from("finished_stock").insert({
            business_id: businessId,
            design_id: item.design_id,
            colour_id: item.colour_id || null,
            godown_id: targetGodownId,
            entry_type: "sales_return",
            size_quantities: sizeQty,
            total_quantity: qty,
            cost_per_piece: costPerPiece,
            total_value: qty * costPerPiece,
            created_by: userId,
          });
        }

        await supabase.from("stock_ledger").insert({
          business_id: businessId,
          item_type: "finished_good",
          item_id: item.design_id,
          godown_id: targetGodownId,
          transaction_type: "sales_return_inflow",
          quantity_delta: qty,
          value_delta: Number(item.amount || qty * (item.unit_rate || 0)),
          reference_table: "sales_returns",
          reference_id: sReturn.id,
          created_by: userId,
        });
      }
    } else if (design_id && colour_id && godown_id && size_quantities && total_quantity > 0) {
      // Legacy single-item fallback
      await supabase.from("finished_stock").insert({
        business_id: businessId,
        design_id,
        colour_id,
        godown_id,
        entry_type: "sales_return",
        size_quantities: size_quantities,
        total_quantity: Number(total_quantity),
        cost_per_piece: 0,
        total_value: 0,
        created_by: userId,
      });
    }

    // Reconcile ground-truth stock
    try {
      const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
      await reconcileFinishedStock(supabase, businessId);
    } catch (reconcileErr) {
      console.warn("[POST /api/sales/returns] Reconciliation warning:", reconcileErr);
    }

    return NextResponse.json({ return: sReturn, creditNote });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
