import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: materialTypes, error } = await supabase
      .from("raw_material_types")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ materialTypes });
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
      name,
      description,
      category,
      unit,
      image_url,
      default_supplier_id,
      reorder_level,
      is_active,
    } = body;

    if (!name || !unit) {
      return NextResponse.json(
        { error: "Material Name and Measurement Unit are required" },
        { status: 400 }
      );
    }

    const { data: materialType, error } = await supabase
      .from("raw_material_types")
      .insert({
        business_id: businessId,
        name,
        description: description || null,
        category: category || null,
        unit,
        image_url: image_url || null,
        default_supplier_id: default_supplier_id || null,
        reorder_level: Number(reorder_level || 0),
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ materialType });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
