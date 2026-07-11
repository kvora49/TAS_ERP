import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("purchase_returns")
      .select("*, supplier:parties(name, company_name), purchase:raw_material_purchases(purchase_number, invoice_no)")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (search) {
      query = query.or(`return_number.ilike.%${search}%,reason.ilike.%${search}%`);
    }

    const { data: returns, error } = await query.order("return_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ returns });
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
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      purchase_id,
      supplier_id,
      return_date,
      return_type,
      reason,
      godown_id,
      challan_no,
      remarks,
      total_taxable_value,
      total_discount,
      taxable_after_discount,
      cgst,
      sgst,
      igst,
      round_off,
      grand_total,
      amount_in_words,
      generate_debit_note,
      attachments,
      status, // 'pending', 'completed', 'cancelled'
      items,
    } = body;

    if (!purchase_id) {
      return NextResponse.json({ error: "Purchase Invoice is required" }, { status: 400 });
    }
    if (!supplier_id) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }
    if (!return_date) {
      return NextResponse.json({ error: "Return Date is required" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one return item is required" }, { status: 400 });
    }

    // Auto-generate Return Number (Format: RET-YYYY-XXXX)
    const year = new Date(return_date).getFullYear() || new Date().getFullYear();
    const { data: lastRet } = await supabase
      .from("purchase_returns")
      .select("return_number")
      .eq("business_id", businessId)
      .like("return_number", `RET-${year}-%`)
      .order("return_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastRet && lastRet.length > 0 && lastRet[0].return_number) {
      const parts = lastRet[0].return_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const returnNumber = `RET-${year}-${String(nextNum).padStart(4, "0")}`;

    // Insert purchase return
    const { data: pReturn, error: returnError } = await supabase
      .from("purchase_returns")
      .insert({
        business_id: businessId,
        return_number: returnNumber,
        purchase_id,
        supplier_id,
        return_date,
        return_type: return_type || 'material_return',
        reason: reason || null,
        godown_id: godown_id || null,
        challan_no: challan_no || null,
        remarks: remarks || null,
        total_taxable_value: Number(total_taxable_value || 0),
        total_discount: Number(total_discount || 0),
        taxable_after_discount: Number(taxable_after_discount || 0),
        cgst: Number(cgst || 0),
        sgst: Number(sgst || 0),
        igst: Number(igst || 0),
        round_off: Number(round_off || 0),
        grand_total: Number(grand_total || 0),
        amount_in_words: amount_in_words || null,
        generate_debit_note: generate_debit_note !== false,
        attachments: attachments || [],
        status: status || 'pending',
      })
      .select()
      .single();

    if (returnError) {
      return NextResponse.json({ error: returnError.message }, { status: 500 });
    }

    // Insert purchase return items
    const itemsToInsert = items.map((item: any) => ({
      business_id: businessId,
      return_id: pReturn.id,
      purchase_item_id: item.purchase_item_id || null,
      material_type_id: item.material_type_id,
      hsn_sac: item.hsn_sac || null,
      unit: item.unit,
      invoice_qty: Number(item.invoice_qty),
      returned_qty: Number(item.returned_qty),
      rate: Number(item.rate),
      discount_percent: Number(item.discount_percent || 0),
      taxable_value: Number(item.taxable_value),
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from("purchase_return_items")
      .insert(itemsToInsert)
      .select();

    if (itemsError || !insertedItems) {
      await supabase.from("purchase_returns").delete().eq("id", pReturn.id);
      return NextResponse.json({ error: "Failed to create return items: " + (itemsError?.message || "No data returned") }, { status: 500 });
    }

    // Insert purchase_return_rolls and update original roll remaining meters
    if (insertedItems && insertedItems.length > 0) {
      const returnRollsToInsert: any[] = [];
      for (let i = 0; i < insertedItems.length; i++) {
        const insertedItem = insertedItems[i];
        const inputItem = items[i];
        if (inputItem && inputItem.item_type === "fabric" && inputItem.rolls && inputItem.rolls.length > 0) {
          const selectedRolls = inputItem.rolls.filter((r: any) => r.selected);
          for (const roll of selectedRolls) {
            returnRollsToInsert.push({
              business_id: businessId,
              return_item_id: insertedItem.id,
              purchase_roll_id: roll.id,
              returned_meters: Number(roll.remaining_meters),
            });

            // Update remaining meters on original roll record
            const { data: origRoll } = await supabase
              .from("purchase_rolls")
              .select("remaining_meters")
              .eq("id", roll.id)
              .single();
            
            if (origRoll) {
              const newRemaining = Math.max(0, Number(origRoll.remaining_meters || 0) - Number(roll.remaining_meters));
              await supabase
                .from("purchase_rolls")
                .update({ remaining_meters: newRemaining })
                .eq("id", roll.id);
            }
          }
        }
      }

      if (returnRollsToInsert.length > 0) {
        const { error: returnRollsError } = await supabase
          .from("purchase_return_rolls")
          .insert(returnRollsToInsert);
        if (returnRollsError) {
          await supabase.from("purchase_returns").delete().eq("id", pReturn.id);
          return NextResponse.json({ error: "Failed to create return rolls: " + returnRollsError.message }, { status: 500 });
        }
      }
    }

    // Generate debit note if requested
    if (generate_debit_note) {
      const year = new Date(return_date).getFullYear() || new Date().getFullYear();
      const { data: lastDn } = await supabase
        .from("debit_notes")
        .select("dn_number")
        .eq("business_id", businessId)
        .like("dn_number", `DN-${year}-%`)
        .order("dn_number", { ascending: false })
        .limit(1);

      let nextDnNum = 1;
      if (lastDn && lastDn.length > 0 && lastDn[0].dn_number) {
        const parts = lastDn[0].dn_number.split("-");
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          nextDnNum = lastNum + 1;
        }
      }
      const dnNumber = `DN-${year}-${String(nextDnNum).padStart(4, "0")}`;

      const { data: dnRecord, error: dnError } = await supabase
        .from("debit_notes")
        .insert({
          business_id: businessId,
          dn_number: dnNumber,
          party_id: supplier_id,
          related_purchase_return_id: pReturn.id,
          dn_date: return_date,
          amount: Number(grand_total),
          reason: reason || null,
        })
        .select()
        .single();

      if (!dnError && dnRecord) {
        await supabase
          .from("purchase_returns")
          .update({ debit_note_id: dnRecord.id })
          .eq("id", pReturn.id);
      }
    }

    // If status is 'completed' and godown_id is specified, automatically generate a stock entry and write to stock_ledger
    if ((status === "completed") && godown_id) {
      // 1. Write negative delta to stock_ledger
      const { data: { user } } = await supabase.auth.getUser();
      const ledgerEntries = items.map((item: any) => ({
        business_id: businessId,
        item_type: 'raw_material',
        item_id: item.material_type_id,
        godown_id: godown_id,
        transaction_type: 'purchase_return',
        quantity_delta: -Number(item.returned_qty),
        value_delta: -Number(item.taxable_value),
        reference_table: 'purchase_returns',
        reference_id: pReturn.id,
        created_by: user?.id || null,
      }));

      const { error: ledgerError } = await supabase
        .from("stock_ledger")
        .insert(ledgerEntries);

      if (ledgerError) {
        // Clean up
        await supabase.from("purchase_return_items").delete().eq("return_id", pReturn.id);
        await supabase.from("purchase_returns").delete().eq("id", pReturn.id);
        return NextResponse.json({ error: "Failed to create stock ledger entries: " + ledgerError.message }, { status: 500 });
      }

      // 2. Generate legacy stock entry for historical data
      const { data: stockEntry, error: seError } = await supabase
        .from("raw_material_stock_entries")
        .insert({
          business_id: businessId,
          stock_entry_number: `STK-OUT-${returnNumber}`,
          entry_type: "stock_out",
          reference_type: "return",
          reference_id: pReturn.id,
          reference_no: returnNumber,
          reference_date: return_date,
          godown_id,
          posting_date: return_date,
          remarks: `Auto-generated from Purchase Return ${returnNumber}`,
          total_items_value: Number(total_taxable_value || 0),
          grand_total: Number(grand_total || 0),
          status: "active",
        })
        .select()
        .single();

      if (!seError && stockEntry) {
        const seItems = items.map((item: any) => ({
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

    return NextResponse.json({ return: pReturn });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
