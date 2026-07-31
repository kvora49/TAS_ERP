import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: materials, error } = await supabase
      .from("raw_material_types")
      .select("id, name, category, unit, hsn_code, reorder_level, created_at")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ materials: materials || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch materials" }, { status: 500 });
  }
}
