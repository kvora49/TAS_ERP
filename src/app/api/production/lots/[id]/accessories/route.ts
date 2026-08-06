import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/production/lots/[id]/accessories
 * Returns the accessory pool for a specific production lot,
 * with live available_qty = allocated_qty - total_issued_qty.
 * Used by Stage Entry Section 5 (Accessory Assignment).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: lotId } = params;

  try {
    // 1. Fetch lot accessories
    const { data: lotAccessories, error } = await supabase
      .from("production_lot_accessories")
      .select(`
        *,
        godown:godowns (id, name)
      `)
      .eq("lot_id", lotId)
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!lotAccessories || lotAccessories.length === 0) {
      return NextResponse.json({ accessories: [] });
    }

    // 2. Fetch total issued qty per lot_accessory from stage_entry_accessories
    const accessoryIds = lotAccessories.map((a: any) => a.id);
    const { data: issuances } = await supabase
      .from("stage_entry_accessories")
      .select("lot_accessory_id, issued_qty")
      .eq("business_id", businessId)
      .in("lot_accessory_id", accessoryIds);

    // 3. Build issued totals map
    const issuedMap = new Map<string, number>();
    (issuances || []).forEach((iss: any) => {
      const prev = issuedMap.get(iss.lot_accessory_id) || 0;
      issuedMap.set(iss.lot_accessory_id, prev + Number(iss.issued_qty));
    });

    // 4. Enrich each accessory with live available_qty
    const enriched = lotAccessories.map((acc: any) => {
      const totalIssued = issuedMap.get(acc.id) || 0;
      const availableQty = Math.max(0, Number(acc.allocated_qty) - totalIssued);
      return {
        id: acc.id,
        lot_id: acc.lot_id,
        purchase_item_id: acc.purchase_item_id,
        item_name: acc.item_name,
        unit: acc.unit,
        godown_id: acc.godown_id,
        godown_name: acc.godown?.name || "—",
        allocated_qty: Number(acc.allocated_qty),
        unit_rate: Number(acc.unit_rate),
        total_value: Number(acc.allocated_qty) * Number(acc.unit_rate),
        total_issued_qty: totalIssued,
        available_qty: availableQty,
      };
    });

    return NextResponse.json({ accessories: enriched });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
