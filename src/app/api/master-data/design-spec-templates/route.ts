import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const garmentTypeId = searchParams.get("garment_type_id");

  try {
    let query = supabase
      .from("design_spec_templates")
      .select(`
        *,
        garment_types (
          name
        )
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (garmentTypeId) {
      query = query.eq("garment_type_id", garmentTypeId);
    }

    const { data: templates, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates });
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
    const { garment_type_id, fields } = body;

    if (!garment_type_id) {
      return NextResponse.json({ error: "Garment Type is required" }, { status: 400 });
    }

    // Check if a template already exists for this garment type
    const { data: existing } = await supabase
      .from("design_spec_templates")
      .select("id")
      .eq("business_id", businessId)
      .eq("garment_type_id", garment_type_id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A template already exists for this garment type. Please edit the existing one." },
        { status: 400 }
      );
    }

    const { data: template, error } = await supabase
      .from("design_spec_templates")
      .insert({
        business_id: businessId,
        garment_type_id,
        fields: fields || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
