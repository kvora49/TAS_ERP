import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateQRCode } from "@/lib/utils/barcode";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const designId = searchParams.get("design_id");
  const finishedStockId = searchParams.get("finished_stock_id");

  try {
    let query = supabase
      .from("finished_stock")
      .select(`
        id,
        size_quantities,
        total_quantity,
        total_value,
        designs (id, design_number, name, sale_price),
        design_colours (id, colour_name, colour_hex),
        godowns (id, name)
      `)
      .eq("business_id", businessId)
      .is("deleted_at", null);

    if (finishedStockId) {
      query = query.eq("id", finishedStockId);
    } else if (designId) {
      query = query.eq("design_id", designId);
    }

    const { data: items, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate QR Data URLs for each stock item
    const labels = await Promise.all(
      (items || []).map(async (item: any) => {
        const qrUuid = item.qr_uuid || item.id;
        const qrDataUrl = await generateQRCode(qrUuid);
        const sizesStr = item.size_quantities && typeof item.size_quantities === "object"
          ? Object.keys(item.size_quantities).join(", ")
          : "All Sizes";

        return {
          stock_id: item.id,
          qr_uuid: qrUuid,
          qr_data_url: qrDataUrl,
          design_code: item.designs?.design_number || item.designs?.name || "DES-001",
          design_name: item.designs?.name || "Garment Item",
          colour_name: item.design_colours?.colour_name || "Red",
          colour_hex: item.design_colours?.colour_hex,
          size: sizesStr,
          godown_name: item.godowns?.name || "Main Godown",
          quantity: item.total_quantity || 0,
        };
      })
    );

    return NextResponse.json({ labels });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
