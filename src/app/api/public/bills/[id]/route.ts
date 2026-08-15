import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-response";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public API endpoint for customer invoice viewing (no auth required)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const billId = params.id;
    if (!billId || !UUID_REGEX.test(billId)) {
      return NextResponse.json({ error: "Invalid invoice identifier format", code: "INVALID_ID" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: bill, error: billErr } = await supabase
      .from("sale_bills")
      .select(`
        *,
        party:parties(*),
        items:sale_bill_items(*, design:designs(id, design_number, name, hsn_code), colour:design_colours(id, colour_name), material_type:raw_material_types(id, name, unit, hsn_code)),
        charges:sale_bill_charges(*)
      `)
      .eq("id", billId)
      .is("deleted_at", null)
      .maybeSingle();

    if (billErr) throw billErr;
    if (!bill) {
      return NextResponse.json({ error: "Invoice not found or expired", code: "NOT_FOUND" }, { status: 404 });
    }

    if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
      try {
        const itemIds = bill.items.map((it: any) => it.id);
        const { data: rollsData } = await supabase.from("sale_rolls").select("*").in("sale_item_id", itemIds);
        if (rollsData && rollsData.length > 0) {
          const rollsByItem: Record<string, any[]> = {};
          for (const r of rollsData) {
            if (!rollsByItem[r.sale_item_id]) rollsByItem[r.sale_item_id] = [];
            rollsByItem[r.sale_item_id].push(r);
          }
          for (const it of bill.items) {
            it.rolls = rollsByItem[it.id] || [];
          }
        }
      } catch {
        // Safe non-blocking fallback
      }
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
        .from("brand_bill_config")
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
    return handleApiError(err);
  }
}

