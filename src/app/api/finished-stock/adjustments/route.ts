import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: adjustments, error } = await supabase
      .from("stock_adjustments")
      .select("*, design:designs(code:design_number, name), colour:design_colours(colour_name, colour_hex), godown:godowns(name)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("adjustment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ adjustments });
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
      adjustment_type,
      adjustment_date,
      godown_id,
      design_id,
      colour_id,
      size,
      quantity_change,
      unit_cost,
      reason,
      remarks,
      attachment_url,
    } = body;

    // Validate inputs
    if (!adjustment_type || !adjustment_date || !godown_id || !design_id || !colour_id || !size || quantity_change === undefined || !unit_cost || !reason) {
      return NextResponse.json({ error: "All required fields must be filled" }, { status: 400 });
    }

    // Verify design_id belongs to finished stock designs table (excluding raw materials & accessories)
    const { data: validDesign } = await supabase
      .from("designs")
      .select("id")
      .eq("id", design_id)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!validDesign) {
      return NextResponse.json(
        { error: "Invalid item selected. Only Finished Garment Designs can be adjusted here. Raw materials and accessories must be adjusted in their respective stock modules." },
        { status: 400 }
      );
    }

    const valueImpact = quantity_change * unit_cost;

    // Insert adjustment record
    const { data: adjustment, error: adjErr } = await supabase
      .from("stock_adjustments")
      .insert({
        business_id: businessId,
        adjustment_number: "", // assigned atomically by database trigger
        adjustment_type,
        adjustment_date,
        godown_id,
        design_id,
        colour_id,
        size,
        quantity_change,
        unit_cost,
        value_impact: valueImpact,
        reason,
        remarks: remarks || null,
        attachment_url: attachment_url || null,
      })
      .select()
      .single();

    if (adjErr) {
      return NextResponse.json({ error: adjErr.message }, { status: 500 });
    }

    // Fetch existing stock for dynamic WAC unit cost recalculation
    const { data: existingStock } = await supabase
      .from("finished_stock")
      .select("total_quantity, cost_per_piece, total_value")
      .eq("design_id", design_id)
      .eq("colour_id", colour_id)
      .eq("godown_id", godown_id)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    let currentQty = 0;
    let currentValue = 0;
    if (existingStock) {
      existingStock.forEach((st) => {
        currentQty += Number(st.total_quantity || 0);
        currentValue += Number(st.total_value || 0);
      });
    }

    let calculatedUnitCost = unit_cost;
    const absQtyChange = Math.abs(quantity_change);

    if (adjustment_type === "deduction") {
      const remainingQty = Math.max(0, currentQty - absQtyChange);
      if (body.valuation_mode === "absorb" && remainingQty > 0 && currentValue > 0) {
        calculatedUnitCost = Number((currentValue / remainingQty).toFixed(2));
      }
    } else if (adjustment_type === "addition") {
      const newTotalQty = currentQty + absQtyChange;
      if (body.valuation_mode === "dilute" && newTotalQty > 0 && currentValue > 0) {
        calculatedUnitCost = Number((currentValue / newTotalQty).toFixed(2));
      } else if (newTotalQty > 0) {
        const addedVal = absQtyChange * unit_cost;
        calculatedUnitCost = Number(((currentValue + addedVal) / newTotalQty).toFixed(2));
      }
    }

    // Insert stock_ledger audit entry for adjustment
    const { error: ledgerErr } = await supabase
      .from("stock_ledger")
      .insert({
        business_id: businessId,
        item_type: "finished_good",
        item_id: design_id,
        godown_id,
        transaction_type: adjustment_type === "addition" ? "adjustment_inflow" : "adjustment_outflow",
        quantity_delta: quantity_change,
        value_delta: valueImpact,
        reference_table: "stock_adjustments",
        reference_id: adjustment.id,
      });

    if (ledgerErr) {
      console.warn("Failed to insert stock ledger for adjustment:", ledgerErr.message);
    }

    // Reconcile finished stock ground-truth after adjustment creation
    const { reconcileFinishedStock } = await import("@/lib/finished-stock-reconciliation");
    await reconcileFinishedStock(supabase, businessId, design_id);

    return NextResponse.json({ adjustment, calculatedUnitCost });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
