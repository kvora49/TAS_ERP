import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_primary", true)
      .maybeSingle();

    if (!brand) {
      return NextResponse.json({ config: null });
    }

    let { data: config } = await supabase
      .from("brand_bill_config")
      .select("*, bank_account:bank_accounts(id, type, name, bank_name, account_number, ifsc, branch, upi_id)")
      .eq("brand_id", brand.id)
      .maybeSingle();

    if (!config || !config.bank_account) {
      const { data: defaultBank } = await supabase
        .from("bank_accounts")
        .select("id, type, name, bank_name, account_number, ifsc, branch, upi_id")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .neq("type", "cash")
        .not("name", "ilike", "%cash%")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (defaultBank) {
        config = {
          ...(config || {}),
          bank_account: defaultBank,
          bank_name: (config as any)?.bank_name || defaultBank.bank_name || defaultBank.name,
          bank_account_no: (config as any)?.bank_account_no || defaultBank.account_number,
          bank_ifsc: (config as any)?.bank_ifsc || defaultBank.ifsc,
          bank_branch: (config as any)?.bank_branch || defaultBank.branch,
          bank_account_type: (config as any)?.bank_account_type || defaultBank.type || "Current Account",
        };
      }
    }

    return NextResponse.json({ config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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

    // 1. Fetch or create primary brand
    let { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("business_id", businessId)
      .eq("is_primary", true)
      .maybeSingle();

    if (!brand) {
      const { data: newBrand, error: brandErr } = await supabase
        .from("brands")
        .insert({ business_id: businessId, name: "Default Brand", is_primary: true })
        .select("id")
        .single();
      if (brandErr) throw brandErr;
      brand = newBrand;
    }

    // 2. Check if brand_invoice_configs row exists
    const { data: existing } = await supabase
      .from("brand_bill_config")
      .select("id")
      .eq("brand_id", brand.id)
      .maybeSingle();

    const configPayload = {
      terms_conditions: body.terms_conditions || null,
      declaration: body.declaration || null,
      bank_name: body.bank_name || null,
      bank_account_no: body.bank_account_no || null,
      bank_ifsc: body.bank_ifsc || null,
      bank_branch: body.bank_branch || null,
      bank_account_type: body.bank_account_type || "Current Account",
      bank_account_id: body.bank_account_id || null,
      footer_text: body.terms_conditions || body.footer_text || null,
    };

    if (existing) {
      const { error } = await supabase
        .from("brand_bill_config")
        .update(configPayload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("brand_bill_config")
        .insert({ ...configPayload, brand_id: brand.id, business_id: businessId });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
