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

    // 6. Record returned stock: auto-detect source godown from original sale, restore purchase_rolls for fabric
    const designIdsToReconcile = new Set<string>();
    let needsRawMaterialReconcile = false;

    if (returnItems.length > 0) {
      for (const item of returnItems) {
        const qty = Number(item.return_qty || item.quantity || 0);
        if (qty <= 0) continue;

        const itemType = item.item_type || "finished_goods";

        if (itemType === "fabric" && item.sale_item_id) {
          // Fabric Roll return: restore remaining_meters on the source purchase_rolls
          const { data: saleRolls } = await supabase
            .from("sale_rolls")
            .select("purchase_roll_id, meters_sold")
            .eq("sale_item_id", item.sale_item_id)
            .eq("business_id", businessId);

          if (saleRolls && saleRolls.length > 0) {
            for (const sr of saleRolls) {
              if (!sr.purchase_roll_id) continue;
              const { data: origRoll } = await supabase
                .from("purchase_rolls")
                .select("remaining_meters")
                .eq("id", sr.purchase_roll_id)
                .maybeSingle();

              if (origRoll) {
                const restoredMeters = Math.min(
                  Number(origRoll.remaining_meters || 0) + Number(sr.meters_sold || 0),
                  999999
                );
                await supabase
                  .from("purchase_rolls")
                  .update({ remaining_meters: restoredMeters })
                  .eq("id", sr.purchase_roll_id);
              }
            }
          }

          // Log stock_ledger entry for fabric return inflow
          if (item.material_type_id) {
            // Auto-detect godown from original purchase roll
            const { data: rollGodown } = await supabase
              .from("sale_rolls")
              .select("purchase_rolls(purchase_item_id, raw_material_purchase_items(purchase_id, raw_material_purchases(godown_id)))")
              .eq("sale_item_id", item.sale_item_id)
              .eq("business_id", businessId)
              .limit(1)
              .maybeSingle();

            const detectedGodownId = (rollGodown as any)?.purchase_rolls?.raw_material_purchase_items?.raw_material_purchases?.godown_id || null;

            await supabase.from("stock_ledger").insert({
              business_id: businessId,
              item_type: "raw_material",
              item_id: item.material_type_id,
              godown_id: detectedGodownId,
              transaction_type: "sales_return_inflow",
              quantity_delta: qty,
              value_delta: Number(item.amount || qty * (item.unit_rate || 0)),
              reference_table: "sales_returns",
              reference_id: sReturn.id,
              created_by: userId,
            });
          }
          needsRawMaterialReconcile = true;

        } else if (item.design_id) {
          // Finished goods return: auto-detect godown from existing finished_stock entries for this design
          const { data: stockEntry } = await supabase
            .from("finished_stock")
            .select("godown_id")
            .eq("business_id", businessId)
            .eq("design_id", item.design_id)
            .not("godown_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const detectedGodownId = stockEntry?.godown_id || body.godown_id || null;

          await supabase.from("stock_ledger").insert({
            business_id: businessId,
            item_type: "finished_good",
            item_id: item.design_id,
            godown_id: detectedGodownId,
            transaction_type: "sales_return_inflow",
            quantity_delta: qty,
            value_delta: Number(item.amount || qty * (item.unit_rate || 0)),
            reference_table: "sales_returns",
            reference_id: sReturn.id,
            created_by: userId,
          });
          designIdsToReconcile.add(item.design_id);
        }
      }
    }

    // Reconcile ground-truth stock per affected design
    try {
      const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
      for (const designId of Array.from(designIdsToReconcile)) {
        await reconcileFinishedStock(supabase, businessId, designId);
      }
    } catch (reconcileErr) {
      console.warn("[POST /api/sales/returns] Finished stock reconciliation warning:", reconcileErr);
    }

    if (needsRawMaterialReconcile) {
      try {
        const { reconcileRawMaterialStock } = await import("@/lib/stock-reconciliation");
        await reconcileRawMaterialStock(supabase, businessId);
      } catch (reconcileErr) {
        console.warn("[POST /api/sales/returns] Raw material reconciliation warning:", reconcileErr);
      }
    }

    return NextResponse.json({ return: sReturn, creditNote });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
