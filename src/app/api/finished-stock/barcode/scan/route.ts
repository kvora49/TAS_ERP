import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidQRUUID, isValidBarcodePayload, generateSizeQRUUID } from "@/lib/utils/barcode";

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
    const payload = (qr_uuid || "").trim();

    if (!payload || !isValidBarcodePayload(payload)) {
      return NextResponse.json({
        found: false,
        message: "Invalid barcode or QR payload format."
      }, { status: 400 });
    }

    let directList: any[] | null = null;
    const isUuid = isValidQRUUID(payload);

    // Step 1: Direct lookup by id or qr_uuid
    if (isUuid) {
      const { data } = await supabase
        .from("finished_stock")
        .select(`
          *,
          designs (id, design_number, name, sale_price, images),
          design_colours (id, colour_name, colour_hex),
          godowns (id, name)
        `)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .or(`id.eq.${payload},qr_uuid.eq.${payload}`);
      directList = data;
    } else {
      // Non-UUID payload (e.g. 1D Barcode, SKU, Design Number)
      const { data: byQrUuid } = await supabase
        .from("finished_stock")
        .select(`
          *,
          designs (id, design_number, name, sale_price, images),
          design_colours (id, colour_name, colour_hex),
          godowns (id, name)
        `)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .eq("qr_uuid", payload);

      if (byQrUuid && byQrUuid.length > 0) {
        directList = byQrUuid;
      } else {
        const { data: byDesign } = await supabase
          .from("finished_stock")
          .select(`
            *,
            designs!inner (id, design_number, name, sale_price, images),
            design_colours (id, colour_name, colour_hex),
            godowns (id, name)
          `)
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .ilike("designs.design_number", payload);
        directList = byDesign;
      }
    }

    let stock: any = directList && directList.length > 0 ? directList[0] : null;
    let resolvedSize: string | null = null;
    let resolvedQuantity: number | null = null;

    // Step 2: Fallback lookup for size-specific UUID tokens
    if (!stock && isUuid) {
      const { data: allStock } = await supabase
        .from("finished_stock")
        .select(`
          *,
          designs (id, design_number, name, sale_price, images),
          design_colours (id, colour_name, colour_hex),
          godowns (id, name)
        `)
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (allStock) {
        for (const item of allStock) {
          const sq = item.size_quantities && typeof item.size_quantities === "object" ? item.size_quantities : {};
          for (const sz of Object.keys(sq)) {
            if (generateSizeQRUUID(item.id, sz) === payload) {
              stock = item;
              resolvedSize = sz;
              resolvedQuantity = Number(sq[sz]) || 0;
              break;
            }
          }
          if (stock) break;
        }
      }
    }

    if (stock) {
      if (!resolvedSize) {
        const sq = stock.size_quantities && typeof stock.size_quantities === "object" ? stock.size_quantities : {};
        const keys = Object.keys(sq);
        resolvedSize = keys.length > 0 ? keys.join(", ") : "Free Size";
        resolvedQuantity = stock.total_quantity || 0;
      }
    }

    // Record scan in barcode_scan_history table
    await supabase.from("barcode_scan_history").insert({
      business_id: businessId,
      qr_uuid_scanned: qr_uuid,
      finished_stock_id: stock ? stock.id : null,
      scan_result: stock ? "found" : "not_found",
      scanned_by: user?.id || null,
    });

    if (!stock) {
      return NextResponse.json({
        found: false,
        message: "Stock item not found or unauthorized."
      }, { status: 404 });
    }

    return NextResponse.json({
      found: true,
      stock: {
        ...stock,
        resolved_size: resolvedSize,
        resolved_quantity: resolvedQuantity,
        size: resolvedSize, // Explicit size property for UI cards
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
