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

    if (type && type !== "all") {
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

    // 4. Deduct finished stock and record stock_ledger entries
    if (items.length > 0) {
      for (const item of items) {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) continue;

        // Fetch fresh finished_stock row to prevent stale overwrites across multiple size items
        let { data: fsRows } = await this.supabase
          .from("finished_stock")
          .select("*")
          .eq("business_id", billData.business_id)
          .eq("design_id", item.design_id);

        if (item.colour_id && fsRows && fsRows.length > 0) {
          const matchCol = fsRows.filter((r) => r.colour_id === item.colour_id);
          if (matchCol.length > 0) fsRows = matchCol;
        }

        if (billData.godown_id && fsRows && fsRows.length > 0) {
          const matchGodown = fsRows.filter((r) => r.godown_id === billData.godown_id);
          if (matchGodown.length > 0) fsRows = matchGodown;
        }

        const existingFs = fsRows && fsRows.length > 0 ? fsRows[0] : null;
        const godownId = existingFs?.godown_id || billData.godown_id;

        if (godownId) {
          await this.supabase.from("stock_ledger").insert({
            business_id: billData.business_id,
            item_type: "finished_good",
            item_id: item.design_id,
            godown_id: godownId,
            transaction_type: "sale_bill_outflow",
            quantity_delta: -qty,
            value_delta: -Number(item.amount || 0),
            reference_table: "sale_bills",
            reference_id: bill.id,
            created_by: billData.created_by || null,
          });
        }

        if (existingFs) {
          const currentSizeQty = existingFs.size_quantities || {};
          const sz = item.size || "all";
          const currentSzQty = Number(currentSizeQty[sz] || 0);
          const newSzQty = Math.max(0, currentSzQty - qty);
          const newTotalQty = Math.max(0, Number(existingFs.total_quantity || 0) - qty);
          const costPerPiece = Number(
            existingFs.cost_per_piece ||
              (existingFs.total_quantity > 0 ? existingFs.total_value / existingFs.total_quantity : 0)
          );
          const newTotalValue = newTotalQty * costPerPiece;

          const updatedSizes = { ...currentSizeQty };
          if (sz !== "all") {
            updatedSizes[sz] = newSzQty;
          }

          await this.supabase
            .from("finished_stock")
            .update({
              size_quantities: updatedSizes,
              total_quantity: newTotalQty,
              total_value: newTotalValue,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingFs.id);
        }
      }
    }

    return bill;
  }

  async updateAtomic(billId: string, businessId: string, billData: any, items: any[], charges: any[]) {
    const { gstin, phone, transporter_name, vehicle_no, ...cleanData } = billData;
    const updateData = {
      ...cleanData,
      eway_transporter: transporter_name || null,
      eway_vehicle_no: vehicle_no || null,
      generate_eway_bill: !!transporter_name,
      updated_at: new Date().toISOString(),
    };

    // 1. Update parent bill
    const { error: billErr } = await this.supabase
      .from("sale_bills")
      .update(updateData)
      .eq("id", billId)
      .eq("business_id", businessId);

    if (billErr) throw billErr;

    // 2. Delete and re-insert items if provided
    if (items) {
      await this.supabase
        .from("sale_bill_items")
        .delete()
        .eq("bill_id", billId)
        .eq("business_id", businessId);

      if (items.length > 0) {
        const itemsToInsert = items.map((it) => ({
          business_id: businessId,
          bill_id: billId,
          design_id: it.design_id,
          colour_id: it.colour_id || null,
          size: it.size,
          brand_id: it.brand_id || null,
          hsn_sac: it.hsn_sac || null,
          quantity: Number(it.quantity || 0),
          unit: it.unit || "Pcs",
          rate: Number(it.rate || 0),
          discount_percent: Number(it.discount_percent || 0),
          tax_percent: Number(it.tax_percent || 0),
          amount: Number(it.amount || 0),
          cost_per_piece: it.cost_per_piece !== undefined ? Number(it.cost_per_piece) : null,
          description: it.description || null,
        }));

        const { error: itemsErr } = await this.supabase
          .from("sale_bill_items")
          .insert(itemsToInsert);

        if (itemsErr) throw itemsErr;
      }
    }

    // 3. Delete and re-insert charges if provided
    if (charges) {
      await this.supabase
        .from("sale_bill_charges")
        .delete()
        .eq("bill_id", billId)
        .eq("business_id", businessId);

      if (charges.length > 0) {
        const chargesToInsert = charges.map((ch) => ({
          business_id: businessId,
          bill_id: billId,
          charge_name: ch.charge_name,
          charge_type: ch.charge_type || "flat",
          is_taxable: !!ch.is_taxable,
          amount: Number(ch.amount || 0),
        }));

        const { error: chargesErr } = await this.supabase
          .from("sale_bill_charges")
          .insert(chargesToInsert);

        if (chargesErr) throw chargesErr;
      }
    }

    return { success: true };
  }

  async delete(id: string, businessId: string) {
    // 1. Fetch sale bill with items to restore stock
    const bill = await this.getById(id, businessId);
    if (bill && bill.items && bill.items.length > 0) {
      const godownId = bill.godown_id || bill.items[0]?.godown_id;
      if (godownId) {
        const finishedStockRestorations: any[] = [];
        const stockLedgerRestorations: any[] = [];

        for (const item of bill.items) {
          if (item.design_id) {
            const sizeQty = item.size ? { [item.size]: Number(item.quantity || 0) } : {};
            const totalQty = Number(item.quantity || 0);

            finishedStockRestorations.push({
              business_id: businessId,
              design_id: item.design_id,
              colour_id: item.colour_id || null,
              godown_id: godownId,
              entry_type: "adjustment",
              size_quantities: sizeQty,
              total_quantity: totalQty,
              cost_per_piece: item.cost_per_piece || item.rate || 0,
              total_value: (item.cost_per_piece || item.rate || 0) * totalQty,
            });

            stockLedgerRestorations.push({
              business_id: businessId,
              item_type: "finished_goods",
              item_id: item.design_id,
              godown_id: godownId,
              transaction_type: "sales_return",
              quantity_delta: totalQty,
              value_delta: (item.cost_per_piece || item.rate || 0) * totalQty,
              reference_table: "sale_bills",
              reference_id: id,
            });
          }
        }

        if (finishedStockRestorations.length > 0) {
          await this.supabase.from("finished_stock").insert(finishedStockRestorations);
        }
        if (stockLedgerRestorations.length > 0) {
          await this.supabase.from("stock_ledger").insert(stockLedgerRestorations);
        }
      }
    }

    // 2. Soft delete the sale bill
    const { error } = await this.supabase
      .from("sale_bills")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw error;
    return { success: true };
  }
}
