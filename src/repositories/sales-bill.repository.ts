import { SupabaseClient } from "@supabase/supabase-js";

export class SalesBillRepository {
  constructor(public supabase: SupabaseClient) {}

  async list(businessId: string, options: {
    page: number;
    limit: number;
    type?: string;
    partyId?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, limit, type, partyId, status, search, startDate, endDate } = options;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from("sale_bills")
      .select("*, party:parties(name, gstin)", { count: "exact" })
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("bill_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (type) {
      query = query.eq("bill_type", type);
    }
    if (partyId) {
      query = query.eq("party_id", partyId);
    }
    if (status) {
      query = query.eq("payment_status", status);
    }
    if (startDate) {
      query = query.gte("bill_date", startDate);
    }
    if (endDate) {
      query = query.lte("bill_date", endDate);
    }
    if (search) {
      query = query.or(`bill_number.ilike.%${search}%,reference_no.ilike.%${search}%`);
    }

    const { data, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return { data, total: count || 0 };
  }

  async getById(id: string, businessId: string) {
    const { data: bill, error } = await this.supabase
      .from("sale_bills")
      .select(`
        *,
        party:parties(*),
        items:sale_bill_items(*, design:designs(id, design_number, name), colour:design_colours(id, colour_name)),
        charges:sale_bill_charges(*)
      `)
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return bill;
  }

  async getDetailById(id: string, businessId: string) {
    // Run all four queries in parallel to avoid serial waterfall
    const [billResult, brandResult] = await Promise.all([
      this.supabase
        .from("sale_bills")
        .select(`
          *,
          party:parties(*),
          items:sale_bill_items(*, design:designs(id, design_number, name), colour:design_colours(id, colour_name)),
          charges:sale_bill_charges(*)
        `)
        .eq("id", id)
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .maybeSingle(),
      this.supabase
        .from("brands")
        .select("id, name, gstin, address, logo_url, phone, email")
        .eq("business_id", businessId)
        .is("deleted_at", null)
        .eq("is_primary", true)
        .maybeSingle(),
    ]);

    if (billResult.error) throw billResult.error;
    const bill = billResult.data;
    if (!bill) return null;

    const brand = brandResult.data || null;

    // Fetch brand config and profit data in second parallel wave (depend on bill/brand)
    const [configResult, profitResult] = await Promise.all([
      brand
        ? this.supabase
            .from("brand_invoice_configs")
            .select("*")
            .eq("brand_id", brand.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      this.supabase
        .from("sale_bill_items")
        .select("quantity, rate, discount_percent, tax_percent, cost_per_piece")
        .eq("bill_id", id),
    ]);

    const brandConfig = configResult.data || null;

    // Calculate profit from items cost data
    let profit = null;
    if (profitResult.data && profitResult.data.length > 0) {
      const items = profitResult.data;
      const cogs = items.reduce((sum: number, it: any) => sum + (Number(it.cost_per_piece || 0) * Number(it.quantity || 0)), 0);
      const saleValue = bill.grand_total || 0;
      const netProfit = saleValue - cogs;
      const profitMarginPercent = saleValue > 0 ? (netProfit / saleValue) * 100 : 0;
      profit = { cogs, sale_value: saleValue, net_profit: netProfit, profit_margin_percent: profitMarginPercent };
    }

    return { bill, profit, brand, brandConfig };
  }

  async create(billData: any, items: any[], charges: any[]) {
    // Strip non-existing columns and map transporter details to eway columns
    const { gstin, phone, transporter_name, vehicle_no, ...cleanData } = billData;
    const insertableData = {
      ...cleanData,
      eway_transporter: transporter_name || null,
      eway_vehicle_no: vehicle_no || null,
      generate_eway_bill: !!transporter_name,
    };

    // 1. Insert parent bill
    const { data: bill, error: billErr } = await this.supabase
      .from("sale_bills")
      .insert(insertableData)
      .select("*")
      .single();

    if (billErr) throw billErr;

    // 2. Insert items
    if (items.length > 0) {
      const itemsToInsert = items.map(it => ({
        ...it,
        bill_id: bill.id,
        business_id: billData.business_id,
      }));
      const { error: itemsErr } = await this.supabase
        .from("sale_bill_items")
        .insert(itemsToInsert);
      if (itemsErr) throw itemsErr;
    }

    // 3. Insert charges
    if (charges && charges.length > 0) {
      const chargesToInsert = charges.map(ch => ({
        ...ch,
        bill_id: bill.id,
        business_id: billData.business_id,
      }));
      const { error: chargesErr } = await this.supabase
        .from("sale_bill_charges")
        .insert(chargesToInsert);
      if (chargesErr) throw chargesErr;
    }

    return bill;
  }

  async updateAtomic(billId: string, businessId: string, billData: any, items: any[], charges: any[]) {
    const { gstin, phone, transporter_name, vehicle_no, ...cleanData } = billData;
    const insertableData = {
      ...cleanData,
      eway_transporter: transporter_name || null,
      eway_vehicle_no: vehicle_no || null,
      generate_eway_bill: !!transporter_name,
    };

    const { error } = await this.supabase.rpc("update_sales_bill_atomic", {
      p_bill_id: billId,
      p_business_id: businessId,
      p_bill_data: insertableData,
      p_items: items,
      p_charges: charges,
    });
    if (error) throw error;
    return { success: true };
  }

  async delete(id: string, businessId: string) {
    const { error } = await this.supabase
      .from("sale_bills")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw error;
    return { success: true };
  }
}
