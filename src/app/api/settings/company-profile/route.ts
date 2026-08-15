import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [businessRes, brandRes] = await Promise.all([
      supabase.from("businesses").select("*").eq("id", businessId).maybeSingle(),
      supabase.from("brands").select("*").eq("business_id", businessId).eq("is_primary", true).maybeSingle(),
    ]);

    if (businessRes.error) {
      return NextResponse.json({ error: businessRes.error.message }, { status: 500 });
    }

    const business = businessRes.data;
    const brand = brandRes.data;
    let brandConfig = null;

    if (brand) {
      const { data: cfg } = await supabase
        .from("brand_bill_config")
        .select("*")
        .eq("brand_id", brand.id)
        .maybeSingle();
      brandConfig = cfg;
    }

    return NextResponse.json({ business, brand, brandConfig });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const { requireAuthGuard } = await import("@/lib/auth/guards");
  const { handleApiError } = await import("@/lib/api-response");

  const guard = await requireAuthGuard(["owner", "admin"]);
  if (!guard.success) return guard.response;
  const { businessId } = guard.ctx;
  const supabase = createClient();

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

    if (!name || !address || !phone || !email) {
      return NextResponse.json(
        { error: "Missing required profile fields (name, address, phone, email)", code: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("businesses")
      .update({
        name: name.trim(),
        gstin: gstin?.trim() || null,
        pan: pan?.trim() || null,
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        website: website?.trim() || null,
        logo_url: logo_url || null,
        financial_year_start: financial_year_start || "2026-04-01",
        currency: currency || "INR",
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}

