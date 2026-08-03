import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch godowns
  const { data: godowns } = await supabase
    .from("godowns")
    .select("id, name, code, is_default, deleted_at")
    .eq("business_id", businessId);

  // Fetch cotton drill raw_material_type
  const { data: matTypes } = await supabase
    .from("raw_material_types")
    .select("id, name, category, unit, deleted_at")
    .eq("business_id", businessId);

  const cottonDrill = matTypes?.find((m) => m.name?.toLowerCase().includes("cotton drill"));
  const matId = cottonDrill?.id;

  // Fetch raw_material_current_stock for cotton drill
  const { data: currentStock } = await supabase
    .from("raw_material_current_stock")
    .select("*, godown:godowns(id, name)")
    .eq("business_id", businessId)
    .eq("material_type_id", matId);

  // Fetch purchases for cotton drill
  const { data: purchaseItems } = await supabase
    .from("raw_material_purchase_items")
    .select("*, purchase:raw_material_purchases(id, purchase_number, invoice_no, godown_id, godown:godowns(id, name))")
    .eq("business_id", businessId)
    .eq("material_type_id", matId);

  // Fetch rolls for cotton drill
  const pItemIds = (purchaseItems || []).map((pi) => pi.id);
  let rolls: any[] = [];
  if (pItemIds.length > 0) {
    const { data: rData } = await supabase
      .from("purchase_rolls")
      .select("*")
      .in("purchase_item_id", pItemIds);
    rolls = rData || [];
  }

  // Fetch returns for cotton drill
  const { data: returnItems } = await supabase
    .from("purchase_return_items")
    .select("*, purchase_return:purchase_returns(id, return_number, godown_id, purchase_id, godown:godowns(id, name))")
    .eq("business_id", businessId)
    .eq("material_type_id", matId);

  // Fetch stock_ledger for cotton drill
  const { data: ledger } = await supabase
    .from("stock_ledger")
    .select("*, godown:godowns(id, name)")
    .eq("business_id", businessId)
    .eq("item_type", "raw_material")
    .eq("item_id", matId);

  return NextResponse.json({
    businessId,
    godowns,
    cottonDrill,
    currentStock,
    purchaseItems,
    rolls,
    returnItems,
    ledger,
  });
}
