import { SupabaseClient } from "@supabase/supabase-js";

export interface PurchaseCreateParams {
  businessId: string;
  purchaseNumber: string;
  supplier_id: string;
  godown_id: string;
  invoice_no: string;
  invoice_date: string;
  delivery_date?: string | null;
  payment_terms?: string;
  due_date?: string | null;
  reference?: string | null;
  transporter?: string | null;
  place_of_supply?: string | null;
  gst_type?: string;
  notes?: string | null;
  subtotal: number;
  total_taxable_value: number;
  total_gst_amount: number;
  freight: number;
  loading_unloading: number;
  other_charges: number;
  total_other_charges: number;
  grand_total: number;
  amount_in_words?: string | null;
  attachments?: string[];
  items: Array<{
    material_type_id: string;
    hsn_sac?: string | null;
    unit: string;
    quantity: number;
    rate: number;
    discount_percent: number;
    taxable_value: number;
    gst_percent: number;
    gst_amount: number;
    amount: number;
    item_type?: string;
    rolls?: Array<{
      roll_number: string;
      meters: number;
      shade?: string;
      comment?: string | null;
      width?: number | null;
      weight_unit?: string | null;
      weight_value?: number | null;
    }>;
  }>;
}

export class PurchaseRepository {
  constructor(private supabase: SupabaseClient) {}

  async list(
    businessId: string,
    options: {
      status?: string | null;
      paymentStatus?: string | null;
      search?: string | null;
    } = {}
  ) {
    let query = this.supabase
      .from("raw_material_purchases")
      .select("*, supplier:parties(name, company_name)")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("invoice_date", { ascending: false });

    if (options.status) query = query.eq("status", options.status);
    if (options.paymentStatus) query = query.eq("payment_status", options.paymentStatus);
    if (options.search) {
      query = query.or(
        `purchase_number.ilike.%${options.search}%,invoice_no.ilike.%${options.search}%,reference.ilike.%${options.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getById(id: string, businessId: string) {
    const { data, error } = await this.supabase
      .from("raw_material_purchases")
      .select(
        `*,
        supplier:parties(id, name, company_name, gstin, phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode),
        godown:godowns(id, name),
        items:raw_material_purchase_items(*,
          material_type:raw_material_types(id, name, unit, category),
          rolls:purchase_rolls(*)
        )`
      )
      .eq("id", id)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Generate the next sequential purchase number */
  async generateNextNumber(businessId: string, year: number): Promise<string> {
    const { data } = await this.supabase
      .from("raw_material_purchases")
      .select("purchase_number")
      .eq("business_id", businessId)
      .like("purchase_number", `PUR-${year}-%`)
      .order("purchase_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0 && data[0].purchase_number) {
      const parts = (data[0].purchase_number as string).split("-");
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last)) nextNum = last + 1;
    }
    return `PUR-${year}-${String(nextNum).padStart(4, "0")}`;
  }

  async create(params: PurchaseCreateParams, userId: string | null) {
    // 1. Insert parent purchase invoice
    const { data: purchase, error: purchaseError } = await this.supabase
      .from("raw_material_purchases")
      .insert({
        business_id: params.businessId,
        purchase_number: params.purchaseNumber,
        supplier_id: params.supplier_id,
        godown_id: params.godown_id,
        invoice_no: params.invoice_no,
        invoice_date: params.invoice_date,
        delivery_date: params.delivery_date || null,
        payment_terms: params.payment_terms || "30_days",
        due_date: params.due_date || null,
        reference: params.reference || null,
        transporter: params.transporter || null,
        place_of_supply: params.place_of_supply || null,
        gst_type: params.gst_type || "with_gst",
        notes: params.notes || null,
        subtotal: Number(params.subtotal || 0),
        total_taxable_value: Number(params.total_taxable_value || 0),
        total_gst_amount: Number(params.total_gst_amount || 0),
        freight: Number(params.freight || 0),
        loading_unloading: Number(params.loading_unloading || 0),
        other_charges: Number(params.other_charges || 0),
        total_other_charges: Number(params.total_other_charges || 0),
        grand_total: Number(params.grand_total || 0),
        amount_in_words: params.amount_in_words || null,
        paid_amount: 0,
        payment_status: "unpaid",
        status: "active",
        attachments: params.attachments || [],
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // 2. Insert line items
    const itemsToInsert = params.items.map((item) => ({
      business_id: params.businessId,
      purchase_id: purchase.id,
      material_type_id: item.material_type_id,
      hsn_sac: item.hsn_sac || null,
      unit: item.unit,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      discount_percent: Number(item.discount_percent || 0),
      taxable_value: Number(item.taxable_value),
      gst_percent: Number(item.gst_percent || 0),
      gst_amount: Number(item.gst_amount || 0),
      amount: Number(item.amount),
    }));

    const { data: insertedItems, error: itemsError } = await this.supabase
      .from("raw_material_purchase_items")
      .insert(itemsToInsert)
      .select();

    if (itemsError || !insertedItems) {
      await this.supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
      throw new Error(`Failed to create purchase items: ${itemsError?.message || "No data returned"}`);
    }

    // 3. Insert fabric rolls (only for fabric items)
    const rollsToInsert: any[] = [];
    insertedItems.forEach((insertedItem, idx) => {
      const inputItem = params.items[idx];
      if (inputItem?.item_type === "fabric" && inputItem.rolls?.length) {
        inputItem.rolls.forEach((roll) => {
          rollsToInsert.push({
            business_id: params.businessId,
            purchase_item_id: insertedItem.id,
            roll_number: roll.roll_number,
            meters: Number(roll.meters),
            shade: roll.shade,
            comment: roll.comment || null,
            width: roll.width ? Number(roll.width) : null,
            weight_unit: roll.weight_unit || null,
            weight_value: roll.weight_value ? Number(roll.weight_value) : null,
            remaining_meters: Number(roll.meters),
          });
        });
      }
    });

    if (rollsToInsert.length > 0) {
      const { error: rollsError } = await this.supabase.from("purchase_rolls").insert(rollsToInsert);
      if (rollsError) {
        await this.supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
        throw new Error(`Failed to create purchase rolls: ${rollsError.message}`);
      }
    }

    // 4. Insert stock ledger entries
    const ledgerEntries = params.items.map((item) => ({
      business_id: params.businessId,
      item_type: "raw_material",
      item_id: item.material_type_id,
      godown_id: params.godown_id,
      transaction_type: "purchase",
      quantity_delta: Number(item.quantity),
      value_delta: Number(item.taxable_value),
      reference_table: "raw_material_purchases",
      reference_id: purchase.id,
      created_by: userId || null,
    }));

    const { error: ledgerError } = await this.supabase.from("stock_ledger").insert(ledgerEntries);
    if (ledgerError) {
      await this.supabase.from("raw_material_purchase_items").delete().eq("purchase_id", purchase.id);
      await this.supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
      throw new Error(`Failed to create stock ledger entries: ${ledgerError.message}`);
    }

    // 5. Update live godown stock (raw_material_current_stock)
    for (const item of params.items) {
      const { data: existingStock } = await this.supabase
        .from("raw_material_current_stock")
        .select("*")
        .eq("business_id", params.businessId)
        .eq("material_type_id", item.material_type_id)
        .eq("godown_id", params.godown_id)
        .maybeSingle();

      const newQty = Number((existingStock?.current_stock || 0)) + Number(item.quantity);
      const newCost = Number(item.rate || existingStock?.unit_cost || 0);
      const newValue = Number((existingStock?.stock_value || 0)) + Number(item.taxable_value || (item.quantity * item.rate));

      if (existingStock) {
        await this.supabase
          .from("raw_material_current_stock")
          .update({
            current_stock: newQty,
            unit_cost: newCost,
            stock_value: newValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingStock.id);
      } else {
        await this.supabase
          .from("raw_material_current_stock")
          .insert({
            business_id: params.businessId,
            material_type_id: item.material_type_id,
            godown_id: params.godown_id,
            current_stock: newQty,
            unit_cost: newCost,
            stock_value: newValue,
          });
      }
    }

    return purchase;
  }

  async softDelete(id: string, businessId: string) {
    const { error } = await this.supabase
      .from("raw_material_purchases")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw error;
    return { success: true };
  }

  async updatePaymentStatus(
    id: string,
    businessId: string,
    paidAmount: number,
    grandTotal: number
  ) {
    const paymentStatus =
      paidAmount <= 0 ? "unpaid" : paidAmount >= grandTotal ? "paid" : "partial";

    const { error } = await this.supabase
      .from("raw_material_purchases")
      .update({ paid_amount: paidAmount, payment_status: paymentStatus })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw error;
    return { paymentStatus };
  }
}
