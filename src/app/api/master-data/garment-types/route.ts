import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: garmentTypes, error } = await supabase
      .from("garment_types")
      .select(`
        id,
        name,
        created_at,
        specTemplate:design_spec_templates(id, fields)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to simplify specTemplate object in response
    const resolvedGarmentTypes = (garmentTypes || []).map((gt: any) => ({
      id: gt.id,
      name: gt.name,
      created_at: gt.created_at,
      specTemplate: gt.specTemplate && gt.specTemplate.length > 0 ? gt.specTemplate[0] : null,
    }));

    return NextResponse.json({ garmentTypes: resolvedGarmentTypes });
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
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { data: garmentType, error } = await supabase
      .from("garment_types")
      .insert({
        business_id: businessId,
        name,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ garmentType });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
