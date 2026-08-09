import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateQRCode, generateSizeQRUUID } from "@/lib/utils/barcode";

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
        qr_uuid,
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

    // Generate individual stock label tags per size breakdown
    const labelPromises: Promise<any>[] = [];

    (items || []).forEach((item: any) => {
      const baseUuid = item.qr_uuid || item.id;
      const salePrice = Number(item.designs?.sale_price || 0) > 0 
        ? Number(item.designs.sale_price) 
        : (Number(item.cost_per_piece || 0) > 0 ? Math.round(Number(item.cost_per_piece) / 0.6) : 0);
      const designCode = item.designs?.design_number || item.designs?.name || "DES-001";
      const designName = item.designs?.name || "Garment Item";
      const colourName = item.design_colours?.colour_name || "Standard";
      const colourHex = item.design_colours?.colour_hex;
      const godownName = item.godowns?.name || "Main Godown";

      const sizeQuantitiesObj = item.size_quantities && typeof item.size_quantities === "object"
        ? item.size_quantities
        : {};
      const sizeKeys = Object.keys(sizeQuantitiesObj).filter(
        (k) => (Number(sizeQuantitiesObj[k]) || 0) > 0
      );

      if (sizeKeys.length > 0) {
        sizeKeys.forEach((sz) => {
          const sizeUuid = generateSizeQRUUID(item.id, sz);
          labelPromises.push(
            (async () => {
              const qrDataUrl = await generateQRCode(sizeUuid);
              return {
                id: `${item.id}-${sz}`,
                stock_id: item.id,
                qr_uuid: sizeUuid,
                qr_data_url: qrDataUrl,
                design_code: designCode,
                design_number: designCode,
                design_name: designName,
                colour_name: colourName,
                colour_hex: colourHex,
                size: sz,
                godown_name: godownName,
                quantity: Number(sizeQuantitiesObj[sz]) || 0,
                sale_price: salePrice,
              };
            })()
          );
        });
      } else {
        labelPromises.push(
          (async () => {
            const qrDataUrl = await generateQRCode(baseUuid);
            return {
              id: item.id,
              stock_id: item.id,
              qr_uuid: baseUuid,
              qr_data_url: qrDataUrl,
              design_code: designCode,
              design_number: designCode,
              design_name: designName,
              colour_name: colourName,
              colour_hex: colourHex,
              size: "Free Size",
              godown_name: godownName,
              quantity: item.total_quantity || 0,
              sale_price: salePrice,
            };
          })()
        );
      }
    });

    const labels = await Promise.all(labelPromises);

    return NextResponse.json({ labels });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
