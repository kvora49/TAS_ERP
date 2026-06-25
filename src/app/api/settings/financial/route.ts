import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch business settings
    let { data: settings, error: setError } = await supabase
      .from("business_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (!settings && !setError) {
      const { data: newSettings } = await supabase
        .from("business_settings")
        .insert({ business_id: businessId })
        .select()
        .single();
      settings = newSettings;
    }

    // 2. Fetch brands
    const { data: brands, error: brandError } = await supabase
      .from("brands")
      .select("id, name, bill_prefix_pakka, bill_prefix_kacha, design_prefix, design_separator, design_digits")
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (brandError) {
      return NextResponse.json({ error: brandError.message }, { status: 500 });
    }

    return NextResponse.json({
      settings: settings || {},
      brands: brands || [],
    });
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
      default_credit_days,
      default_payment_terms,
      default_tds_type,
      round_off_method,
      enable_cash_rounding,
      brands,
    } = body;

    // 1. Update business settings
    const { error: setError } = await supabase
      .from("business_settings")
      .upsert(
        {
          business_id: businessId,
          default_credit_days: Number(default_credit_days || 0),
          default_payment_terms,
          default_tds_type,
          round_off_method,
          enable_cash_rounding: !!enable_cash_rounding,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      );

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    // 2. Bulk update brand numbering settings if provided
    if (brands && Array.isArray(brands)) {
      for (const brand of brands) {
        const { error: brandUpdateErr } = await supabase
          .from("brands")
          .update({
            bill_prefix_pakka: brand.bill_prefix_pakka || null,
            bill_prefix_kacha: brand.bill_prefix_kacha || null,
            design_prefix: brand.design_prefix || null,
            design_separator: brand.design_separator || ".",
            design_digits: Number(brand.design_digits || 4),
          })
          .eq("id", brand.id)
          .eq("business_id", businessId);

        if (brandUpdateErr) {
          return NextResponse.json({ error: `Brand ${brand.name} update failed: ${brandUpdateErr.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
