import { createClient } from "@/lib/supabase/server";

/**
 * Shared helper to allocate a portion of a raw material purchase roll to a production lot
 * and write a corresponding negative delta to the stock_ledger.
 */
export async function allocateRollToLot(
  rollId: string,
  meters: number,
  godownId: string,
  lotId: string,
  businessId: string
) {
  const supabase = createClient();

  // 1. Fetch roll details to get material_type_id and rate
  // This joins purchase_rolls with raw_material_purchase_items to get material_type_id and rate
  const { data: rollData, error: rollError } = await supabase
    .from("purchase_rolls")
    .select(`
      id,
      purchase_item_id,
      purchase_item:raw_material_purchase_items(
        material_type_id,
        rate
      )
    `)
    .eq("id", rollId)
    .eq("business_id", businessId)
    .single();

  if (rollError || !rollData) {
    throw new Error(`Failed to fetch roll details: ${rollError?.message || 'Roll not found'}`);
  }

  const purchaseItem = rollData.purchase_item as any;
  if (!purchaseItem) {
    throw new Error("Purchase item associated with roll not found");
  }

  const materialTypeId = purchaseItem.material_type_id;
  const rate = Number(purchaseItem.rate || 0);
  const valueDelta = -Number(meters * rate);

  // 2. Write negative delta to stock_ledger
  const { error: ledgerError } = await supabase
    .from("stock_ledger")
    .insert({
      business_id: businessId,
      item_type: "raw_material",
      item_id: materialTypeId,
      godown_id: godownId,
      transaction_type: "lot_allocation",
      quantity_delta: -Number(meters),
      value_delta: valueDelta,
      reference_table: "production_lots",
      reference_id: lotId,
    });

  if (ledgerError) {
    throw new Error(`Failed to write to stock ledger: ${ledgerError.message}`);
  }

  // 3. Deduct meters from the remaining meters in purchase_rolls
  const { data: rollDetails } = await supabase
    .from("purchase_rolls")
    .select("remaining_meters")
    .eq("id", rollId)
    .single();
    
  const currentRemaining = Number(rollDetails?.remaining_meters || 0);
  const { error: directUpdateError } = await supabase
    .from("purchase_rolls")
    .update({ remaining_meters: currentRemaining - meters })
    .eq("id", rollId);
    
  if (directUpdateError) {
    throw new Error(`Failed to update purchase roll remaining meters: ${directUpdateError.message}`);
  }

  return { success: true };
}

/**
 * Shared helper to push finished goods stock into a godown
 * and write a corresponding positive delta to the stock_ledger.
 */
export async function pushFinishedStock(
  designId: string,
  quantity: number,
  value: number,
  godownId: string,
  referenceTable: string,
  referenceId: string,
  businessId: string,
  userId: string | null = null
) {
  const supabase = createClient();

  const { error: ledgerError } = await supabase
    .from("stock_ledger")
    .insert({
      business_id: businessId,
      item_type: "finished_good",
      item_id: designId,
      godown_id: godownId,
      transaction_type: "production",
      quantity_delta: Number(quantity),
      value_delta: Number(value),
      reference_table: referenceTable,
      reference_id: referenceId,
      created_by: userId,
    });

  if (ledgerError) {
    throw new Error(`Failed to write to stock ledger for finished stock push: ${ledgerError.message}`);
  }

  return { success: true };
}

