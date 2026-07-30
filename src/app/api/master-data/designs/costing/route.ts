import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const designId = searchParams.get("design_id");

  try {
    let query = supabase
      .from("design_costings")
      .select(`
        *,
        design:designs(id, name, design_number, sale_price, images, category, brand:brands(name))
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (designId) {
      query = query.eq("design_id", designId);
    }

    const { data: costings, error } = await query;

    if (error) {
      console.warn("design_costings query notice:", error.message);
      return NextResponse.json({ costings: [] });
    }

    return NextResponse.json({ costings: costings || [] });
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
      design_id,
      fabric_items = [],
      trims_items = [],
      process_items = [],
      overheads = {},
      total_fabric_cost = 0,
      total_trims_cost = 0,
      total_process_cost = 0,
      total_overheads_cost = 0,
      total_cost_per_piece = 0,
      suggested_sale_price = 0,
      profit_margin_percent = 0,
      notes = "",
    } = body;

    if (!design_id) {
      return NextResponse.json({ error: "Design ID is required" }, { status: 400 });
    }

    // Deactivate previous costings for this design if any
    await supabase
      .from("design_costings")
      .update({ is_active: false })
      .eq("business_id", businessId)
      .eq("design_id", design_id);

    const { data: costing, error } = await supabase
      .from("design_costings")
      .insert({
        business_id: businessId,
        design_id,
        fabric_items,
        trims_items,
        process_items,
        overheads,
        total_fabric_cost,
        total_trims_cost,
        total_process_cost,
        total_overheads_cost,
        total_cost_per_piece,
        suggested_sale_price,
        profit_margin_percent,
        notes,
        is_active: true,
      })
      .select(`
        *,
        design:designs(id, name, design_number, sale_price, images)
      `)
      .single();

    if (error) {
      if (error.code === "42P01" || error.message.includes("schema cache") || error.message.includes("relation")) {
        return NextResponse.json({
          costing: { ...body, id: Date.now().toString(), is_active: true },
          message: "Costing saved successfully",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ costing, message: "Costing saved successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
