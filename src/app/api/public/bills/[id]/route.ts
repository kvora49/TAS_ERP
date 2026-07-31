import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Public API endpoint for customer invoice viewing (no auth required)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: bill, error: billErr } = await supabase
      .from("sale_bills")
      .select(`
        *,
        party:parties(*),
        items:sale_bill_items(*, design:designs(id, design_number, name), colour:design_colours(id, colour_name)),
        charges:sale_bill_charges(*)
      `)
      .eq("id", params.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (billErr) throw billErr;
    if (!bill) {
      return NextResponse.json({ error: "Invoice not found or expired" }, { status: 404 });
    }

    // Fetch primary brand details for business
    const { data: brand } = await supabase
      .from("brands")
      .select("id, name, gstin, address, logo_url, phone, email")
      .eq("business_id", bill.business_id)
      .is("deleted_at", null)
      .eq("is_primary", true)
      .maybeSingle();

    let brandConfig = null;
    if (brand) {
      const { data: cfg } = await supabase
        .from("brand_invoice_configs")
        .select("*")
        .eq("brand_id", brand.id)
        .maybeSingle();
      brandConfig = cfg;
    }

    return NextResponse.json({
      bill: {
        ...bill,
        is_temporary: bill.bill_number?.startsWith("TEMP-") || bill.remarks?.includes("[TEMPORARY]") || false,
      },
      brand,
      brandConfig,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load invoice" }, { status: 500 });
  }
}
