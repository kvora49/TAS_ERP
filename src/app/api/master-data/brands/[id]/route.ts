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
    // 1. Fetch brand details
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // 2. Fetch linked production lots
    const { data: lots, error: lotsError } = await supabase
      .from("production_lots")
      .select(`
        id,
        lot_number,
        lot_date,
        total_quantity,
        completed_quantity,
        status,
        design:designs(name, code)
      `)
      .eq("brand_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("lot_date", { ascending: false });

    // 3. Fetch linked designs
    const { data: designs } = await supabase
      .from("designs")
      .select("id, name, design_number, is_active, created_at")
      .eq("brand_id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // 4. Fetch finished stock matching these designs
    let resolvedStock: any[] = [];
    if (designs && designs.length > 0) {
      const designIds = designs.map((d) => d.id);
      const { data: stockItems } = await supabase
        .from("finished_stock")
        .select(`
          id,
          total_quantity,
          cost_per_piece,
          total_value,
          size_quantities,
          godown:godowns(id, name),
          design:designs(id, name, code:design_number),
          colour:design_colours(id, colour_name)
        `)
        .eq("business_id", businessId)
        .in("design_id", designIds)
        .gt("total_quantity", 0);

      resolvedStock = stockItems || [];
    }

    return NextResponse.json({
      brand,
      lots: lots || [],
      designs: designs || [],
      stock: resolvedStock,
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
