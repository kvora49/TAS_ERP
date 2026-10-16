import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: units, error } = await supabase
      .from("units")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ units });
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
      abbreviation,
      base_unit_id,
      conversion_factor,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Unit Name is required" },
        { status: 400 }
      );
    }
    if (!abbreviation) {
      return NextResponse.json(
        { error: "Abbreviation is required" },
        { status: 400 }
      );
    }
    const factor = conversion_factor !== undefined ? Number(conversion_factor) : 1;
    if (!Number.isFinite(factor) || factor <= 0) {
      return NextResponse.json({ error: "Conversion factor must be a finite number greater than zero." }, { status: 400 });
    }
    if (base_unit_id) {
      const { data: baseUnit, error: baseError } = await supabase
        .from("units").select("id").eq("id", base_unit_id).eq("business_id", businessId).is("deleted_at", null).maybeSingle();
      if (baseError) throw baseError;
      if (!baseUnit) return NextResponse.json({ error: "Selected base unit was not found in this company." }, { status: 400 });
    }

    // Item 30d: Uniqueness pre-check — reject duplicates before hitting the DB constraint
    const { data: existing } = await supabase
      .from("units")
      .select("id")
      .eq("business_id", businessId)
      .ilike("name", name.trim())
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: `A unit named "${name}" already exists.` }, { status: 409 });
    }

    const { data: unit, error } = await supabase
      .from("units")
      .insert({
        business_id: businessId,
        name,
        abbreviation,
        base_unit_id: base_unit_id || null,
        conversion_factor: factor,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unit });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
