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

    return NextResponse.json({
      brand,
      lots: lots || []
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
