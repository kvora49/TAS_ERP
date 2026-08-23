import { createClient, getSessionBusinessId } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { reconcileRawMaterialStock } from "@/lib/stock-reconciliation";

export async function GET(request: Request) {
  const supabase = createClient();
  const businessId = await getSessionBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const searchId = searchParams.get("id");

  // Fetch raw_material_types
  const { data: matTypes } = await supabase
    .from("raw_material_types")
    .select("id, name, category, unit, deleted_at")
    .eq("business_id", businessId);

  const targetMat = searchId
    ? matTypes?.find((m) => m.id === searchId)
    : matTypes?.find((m) => m.name?.toLowerCase().includes("imported denim")) || matTypes?.[0];
  const matId = targetMat?.id;

  // Run reconciliation now to test
  const recResult = matId ? await reconcileRawMaterialStock(supabase, businessId, matId) : null;

  // Fetch raw_material_current_stock after reconciliation
  const { data: currentStock } = await supabase
    .from("raw_material_current_stock")
    .select("*, godown:godowns(id, name)")
    .eq("business_id", businessId)
    .eq("material_type_id", matId);

  // Fetch purchases
  const { data: purchaseItems } = await supabase
    .from("raw_material_purchase_items")
    .select("*, purchase:raw_material_purchases(id, purchase_number, invoice_no, godown_id, godown:godowns(id, name))")
    .eq("business_id", businessId)
    .eq("material_type_id", matId);

  // Fetch rolls
  const pItemIds = (purchaseItems || []).map((pi) => pi.id);
  let rolls: any[] = [];
  if (pItemIds.length > 0) {
    const { data: rData } = await supabase
      .from("purchase_rolls")
      .select("*")
      .in("purchase_item_id", pItemIds);
    rolls = rData || [];
  }

  // Fetch stock entries
  const { data: stockEntries } = await supabase
    .from("raw_material_stock_entries")
    .select("*")
    .eq("business_id", businessId);

  const { data: stockEntryItems } = await supabase
    .from("raw_material_stock_entry_items")
    .select("*")
    .eq("material_type_id", matId);

  return NextResponse.json({
    businessId,
    targetMat,
    recResult,
    currentStock,
    purchaseItems,
    rolls,
    stockEntries,
    stockEntryItems,
  });
}
