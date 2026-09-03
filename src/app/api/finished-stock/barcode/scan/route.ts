import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isValidBarcodePayload, isValidQRUUID, parseBarcodeId, generateSizeQRUUID } from "@/lib/utils/barcode";

export async function POST(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const body = await request.json();
    const payload = (body.barcode || body.qr_uuid || "").trim();

    if (!payload || !isValidBarcodePayload(payload)) {
      return NextResponse.json(
        {
          found: false,
          message: "Invalid barcode payload format.",
        },
        { status: 400 }
      );
    }

    let stock: any = null;
    let resolvedSize: string | null = null;
    let resolvedQuantity: number | null = null;

    const isUuid = isValidQRUUID(payload);

    // Strategy 1: Smart Barcode Parsing (e.g. "NIG.0042-M", "ZARA.01-XL", "DES-001-FREE")
    if (!isUuid) {
      const parsed = parseBarcodeId(payload);
      if (parsed.designNumber) {
        // Query by design number
        const { data: matchedStock } = await supabase
          .from("finished_stock")
          .select(`
            *,
            designs!inner (id, design_number, name, sale_price, images),
            design_colours (id, colour_name, colour_hex),
            godowns (id, name)
          `)
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .ilike("designs.design_number", parsed.designNumber);

        if (matchedStock && matchedStock.length > 0) {
          if (parsed.size) {
            // Find a record where this specific size has stock
            const targetSizeUpper = parsed.size.toUpperCase();
            const matchingItem = matchedStock.find((item: any) => {
              const sq =
                item.size_quantities && typeof item.size_quantities === "object"
                  ? item.size_quantities
                  : {};
              return Object.keys(sq).some(
                (k) => k.toUpperCase() === targetSizeUpper && Number(sq[k]) > 0
              );
            });

            stock = matchingItem || matchedStock[0];
            resolvedSize = parsed.size;
            const sq =
              stock.size_quantities && typeof stock.size_quantities === "object"
                ? stock.size_quantities
                : {};
            // Match key case-insensitively
            const matchedKey = Object.keys(sq).find(
              (k) => k.toUpperCase() === targetSizeUpper
            );
            resolvedQuantity = matchedKey ? Number(sq[matchedKey]) || 0 : 0;
          } else {
            // No size specified in barcode, use first matching design
            stock = matchedStock[0];
          }
        }
      }
    }

    // Strategy 2: Direct lookup by qr_uuid or stock ID (Legacy UUIDs or exact custom codes)
    if (!stock) {
      let directQuery = supabase
        .from("finished_stock")
        .select(`
          *,
          designs (id, design_number, name, sale_price, images),
          design_colours (id, colour_name, colour_hex),
          godowns (id, name)
        `)
        .eq("business_id", businessId)
        .is("deleted_at", null);

      if (isUuid) {
        directQuery = directQuery.or(`id.eq.${payload},qr_uuid.eq.${payload}`);
      } else {
        directQuery = directQuery.eq("qr_uuid", payload);
      }

      const { data: directList } = await directQuery;
      if (directList && directList.length > 0) {
        stock = directList[0];
      }
    }

    // Strategy 3: Plain Design Number fallback (e.g. user entered "NIG.0042")
    if (!stock && !isUuid) {
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

      if (byDesign && byDesign.length > 0) {
        stock = byDesign[0];
      }
    }

    // Strategy 4: Legacy size-specific UUID token matching
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
          const sq =
            item.size_quantities && typeof item.size_quantities === "object"
              ? item.size_quantities
              : {};
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

    // Resolve display size and quantity if not already resolved
    if (stock && !resolvedSize) {
      const sq =
        stock.size_quantities && typeof stock.size_quantities === "object"
          ? stock.size_quantities
          : {};
      const keys = Object.keys(sq);
      resolvedSize = keys.length > 0 ? keys.join(", ") : "Free Size";
      resolvedQuantity = stock.total_quantity || 0;
    }

    // Record scan in barcode_scan_history table
    await supabase.from("barcode_scan_history").insert({
      business_id: businessId,
      qr_uuid_scanned: payload,
      finished_stock_id: stock ? stock.id : null,
      scan_result: stock ? "found" : "not_found",
      scanned_by: user?.id || null,
    });

    if (!stock) {
      return NextResponse.json(
        {
          found: false,
          message: `Stock item not found for barcode "${payload}".`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      stock: {
        ...stock,
        resolved_size: resolvedSize,
        resolved_quantity: resolvedQuantity,
        size: resolvedSize,
        barcode: payload,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
