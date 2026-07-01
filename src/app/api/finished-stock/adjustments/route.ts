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

    // Auto-generate adjustment number (ADJ-YYYY-XXXX)
    const year = new Date(adjustment_date).getFullYear() || new Date().getFullYear();
    const { data: lastAdj } = await supabase
      .from("stock_adjustments")
      .select("adjustment_number")
      .eq("business_id", businessId)
      .like("adjustment_number", `ADJ-${year}-%`)
      .order("adjustment_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastAdj && lastAdj.length > 0 && lastAdj[0].adjustment_number) {
      const parts = lastAdj[0].adjustment_number.split("-");
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    const adjustmentNumber = `ADJ-${year}-${String(nextNum).padStart(4, "0")}`;

    const valueImpact = quantity_change * unit_cost;

    // Insert adjustment record
    const { data: adjustment, error: adjErr } = await supabase
      .from("stock_adjustments")
      .insert({
        business_id: businessId,
        adjustment_number: adjustmentNumber,
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

    // Insert finished stock ledger entry
    const sizeQuantities = { [size]: quantity_change };
    const { error: ledgerErr } = await supabase
      .from("finished_stock")
      .insert({
        business_id: businessId,
        design_id,
        colour_id,
        godown_id,
        entry_type: "adjustment",
        size_quantities: sizeQuantities,
        total_quantity: quantity_change,
        cost_per_piece: unit_cost,
        total_value: valueImpact,
      });

    if (ledgerErr) {
      console.error("Failed to insert stock ledger for adjustment:", ledgerErr.message);
      // Note: We don't rollback in this standard Next API route, but in production we should handle transactions
    }

    return NextResponse.json({ adjustment });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
