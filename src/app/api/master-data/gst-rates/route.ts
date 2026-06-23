import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: gstRates, error } = await supabase
      .from("gst_rates")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gstRates });
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
      hsn_code,
      description,
      gst_percent,
      auto_tier,
      tier_threshold,
      tier_low_gst,
      tier_high_gst,
      is_active,
    } = body;

    if (!hsn_code || gst_percent === undefined) {
      return NextResponse.json(
        { error: "HSN Code and Base GST Percent are required" },
        { status: 400 }
      );
    }

    const { data: gstRate, error } = await supabase
      .from("gst_rates")
      .insert({
        business_id: businessId,
        hsn_code,
        description: description || null,
        gst_percent: Number(gst_percent),
        auto_tier: !!auto_tier,
        tier_threshold: auto_tier ? Number(tier_threshold || 1000) : null,
        tier_low_gst: auto_tier ? Number(tier_low_gst || 5) : null,
        tier_high_gst: auto_tier ? Number(tier_high_gst || 12) : null,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gstRate });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
