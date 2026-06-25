import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: business, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ business });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      gstin,
      pan,
      address,
      phone,
      email,
      website,
      logo_url,
      financial_year_start,
      currency,
    } = body;

    if (!name || !gstin || !address || !phone || !email || !financial_year_start || !currency) {
      return NextResponse.json(
        { error: "Missing required profile fields" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("businesses")
      .update({
        name,
        gstin,
        pan: pan || null,
        address,
        phone,
        email,
        website: website || null,
        logo_url: logo_url || null,
        financial_year_start,
        currency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
