import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidQRUUID } from "@/lib/utils/barcode";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { qr_uuid } = body;

    if (!qr_uuid || !isValidQRUUID(qr_uuid)) {
      return NextResponse.json({
        found: false,
        message: "Invalid QR code format. Please scan a valid TAS ERP label."
      }, { status: 400 });
    }

    // Step 3: Lookup by ID or QR UUID with business_id protection
    const { data: stockList, error } = await supabase
      .from("finished_stock")
      .select(`
        *,
        designs (id, design_number, name, sale_price, images),
        design_colours (id, colour_name, colour_hex),
        godowns (id, name)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .or(`id.eq.${qr_uuid},qr_uuid.eq.${qr_uuid}`);

    const stock = stockList && stockList.length > 0 ? stockList[0] : null;

    // Record scan in barcode_scan_history table
    await supabase.from("barcode_scan_history").insert({
      business_id: businessId,
      qr_uuid_scanned: qr_uuid,
      finished_stock_id: stock ? stock.id : null,
      scan_result: stock ? "found" : "not_found",
      scanned_by: user?.id || null,
    });

    if (error || !stock) {
      return NextResponse.json({
        found: false,
        message: "Stock item not found or unauthorized."
      }, { status: 404 });
    }

    return NextResponse.json({
      found: true,
      stock,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
