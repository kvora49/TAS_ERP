import { SupabaseClient } from "@supabase/supabase-js";

export interface ProfitItem {
  cost_per_piece: number;
  quantity: number;
  amount: number; // Net amount after item-level discount and tax
}

/**
 * Calculates COGS, net profit, margin and inserts or updates the record in `bill_profit`.
 * Designed to be executed server-side.
 */
export async function calculateAndStoreProfit(
  supabase: SupabaseClient,
  billId: string,
  businessId: string,
  items: ProfitItem[],
  charges: number,
  discount: number
) {
  // 1. Calculate Cost of Goods Sold (COGS)
  const cogs = items.reduce((sum, item) => sum + ((item.cost_per_piece || 0) * item.quantity), 0);
  
  // 2. Calculate sale value
  // Sale value = item net amount sum + other charges - other discounts
  const saleValue = items.reduce((sum, item) => sum + item.amount, 0) + charges - discount;
  
  // 3. Net profit
  const netProfit = saleValue - cogs;
  
  // 4. Profit margin percent
  const profitMarginPercent = saleValue > 0 ? (netProfit / saleValue) * 100 : 0;

  // 5. Deduction breakdown
  const deductionBreakdown = {
    charges,
    discount,
    cogs_details: items.map(item => ({
      cost: item.cost_per_piece || 0,
      quantity: item.quantity,
      amount: item.amount
    }))
  };

  // 6. Insert or Update (upsert) in bill_profit
  const { error } = await supabase
    .from("bill_profit")
    .upsert({
      business_id: businessId,
      bill_id: billId,
      cogs,
      sale_value: saleValue,
      net_profit: netProfit,
      profit_margin_percent: profitMarginPercent,
      deduction_breakdown: deductionBreakdown
    }, { onConflict: "bill_id" });

  if (error) {
    console.error(`Error storing bill profit for bill ${billId}:`, error.message);
    throw error;
  }
}
