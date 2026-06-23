import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: brands, error } = await supabase
      .from("brands")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brands });
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
      logo_url,
      gstin,
      address,
      state,
      state_code,
      bank_details,
      bill_prefix_pakka,
      bill_prefix_kacha,
      design_prefix,
      design_separator,
      design_digits,
      is_primary,
      is_active,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Brand Name is required" },
        { status: 400 }
      );
    }

    // If this brand is marked as primary, reset all other brands of this tenant to false
    if (is_primary) {
      await supabase
        .from("brands")
        .update({ is_primary: false })
        .eq("business_id", businessId);
    }

    const { data: brand, error } = await supabase
      .from("brands")
      .insert({
        business_id: businessId,
        name,
        logo_url: logo_url || null,
        gstin: gstin || null,
        address: address || null,
        state: state || null,
        state_code: state_code || null,
        bank_details: bank_details || null,
        bill_prefix_pakka: bill_prefix_pakka || null,
        bill_prefix_kacha: bill_prefix_kacha || null,
        design_prefix: design_prefix || null,
        design_separator: design_separator || ".",
        design_digits: Number(design_digits || 4),
        is_primary: !!is_primary,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ brand });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
