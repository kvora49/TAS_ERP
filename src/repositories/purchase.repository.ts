import { SupabaseClient } from "@supabase/supabase-js";
import { reconcileRawMaterialStock } from "@/lib/stock-reconciliation";

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
    item_type?: "fabric" | "accessory" | "finished_goods" | "others";
    material_type_id?: string | null;
    design_id?: string | null;
    colour_id?: string | null;
    size_quantities?: Record<string, number>;
    other_item_name?: string | null;
    other_category?: "capital_asset" | "office_expense" | "consumable" | null;
    asset_tag?: string | null;
    hsn_sac?: string | null;
    unit: string;
    quantity: number;
    rate: number;
    discount_percent: number;
    taxable_value: number;
    gst_percent: number;
    gst_amount: number;
    amount: number;
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
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

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
          design:designs(id, design_number, name, size_set:size_sets(id, name, sizes)),
          colour:design_colours(id, colour_name, colour_hex),
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
    // Fetch supplier info for naming in expenses if needed
    let supplierName = "Supplier";
    if (params.supplier_id) {
      const { data: party } = await this.supabase
        .from("parties")
        .select("name, company_name")
        .eq("id", params.supplier_id)
        .maybeSingle();
      if (party) supplierName = party.company_name || party.name;
    }

    // Helper to strip null/undefined properties to prevent schema cache errors on optional columns
    const omitNulls = (obj: Record<string, any>) => {
      const cleaned: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val !== null && val !== undefined) {
          cleaned[key] = val;
        }
      }
      return cleaned;
    };

    // 1. Insert parent purchase invoice
    const parentPayload = omitNulls({
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
      attachments: params.attachments && params.attachments.length > 0 ? params.attachments : null,
    });

    const { data: purchase, error: purchaseError } = await this.supabase
      .from("raw_material_purchases")
      .insert(parentPayload)
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // 2. Insert line items
    const itemsToInsert = params.items.map((item) => {
      const base: Record<string, any> = {
        business_id: params.businessId,
        purchase_id: purchase.id,
        material_type_id: item.material_type_id || null,
        hsn_sac: item.hsn_sac || null,
        unit: item.unit || "Pcs",
        quantity: Number(item.quantity),
        rate: Number(item.rate),
        discount_percent: Number(item.discount_percent || 0),
        taxable_value: Number(item.taxable_value),
        gst_percent: Number(item.gst_percent || 0),
        gst_amount: Number(item.gst_amount || 0),
        amount: Number(item.amount),
      };

      if (item.item_type && item.item_type !== "fabric") {
        base.item_type = item.item_type;
      }
      if (item.item_type === "finished_goods") {
        if (item.design_id) base.design_id = item.design_id;
        if (item.colour_id) base.colour_id = item.colour_id;
        if (item.size_quantities && Object.keys(item.size_quantities).length > 0) {
          base.size_quantities = item.size_quantities;
        }
      }
      if (item.item_type === "others") {
        if (item.other_item_name) base.other_item_name = item.other_item_name;
        if (item.other_category) base.other_category = item.other_category;
        if (item.asset_tag) base.asset_tag = item.asset_tag;
      }

      return omitNulls(base);
    });

    const { data: insertedItems, error: itemsError } = await this.supabase
      .from("raw_material_purchase_items")
      .insert(itemsToInsert)
      .select();

    if (itemsError || !insertedItems) {
      await this.supabase.from("raw_material_purchases").delete().eq("id", purchase.id);
      const errMsg = itemsError?.message || "";
      if (errMsg.includes("schema cache") || errMsg.includes("column")) {
        throw new Error(
          `Database column missing (${errMsg}). Please run 'supabase/master_schema_patch.sql' in your Supabase SQL Editor.`
        );
      }
      throw new Error(`Failed to create purchase items: ${errMsg || "No data returned"}`);
    }

    // 3. Process item type specific stock & expense records
    const rollsToInsert: any[] = [];
    const finishedStockToInsert: any[] = [];
    const stockLedgerToInsert: any[] = [];
    const expensesToInsert: any[] = [];

    // Find default expense type for "others" if any exist
    let defaultExpenseTypeId: string | null = null;
    const { data: expenseTypes } = await this.supabase
      .from("expense_types")
      .select("id")
      .eq("business_id", params.businessId)
      .limit(1);
    if (expenseTypes && expenseTypes.length > 0) {
      defaultExpenseTypeId = expenseTypes[0].id;
    }

    for (let idx = 0; idx < insertedItems.length; idx++) {
      const insertedItem = insertedItems[idx];
      const inputItem = params.items[idx];
      const type = inputItem.item_type || "fabric";

      if (type === "fabric") {
        if (inputItem.rolls?.length) {
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

        if (inputItem.material_type_id) {
          stockLedgerToInsert.push({
            business_id: params.businessId,
            item_type: "raw_material",
            item_id: inputItem.material_type_id,
            godown_id: params.godown_id,
            transaction_type: "purchase",
            quantity_delta: Number(inputItem.quantity),
            value_delta: Number(inputItem.taxable_value),
            reference_table: "raw_material_purchases",
            reference_id: purchase.id,
            created_by: userId || null,
          });

          // Update raw material current stock
          await this.updateRawMaterialStock(params.businessId, inputItem.material_type_id, params.godown_id, Number(inputItem.quantity), Number(inputItem.rate), Number(inputItem.taxable_value));
        }
      } else if (type === "accessory") {
        if (inputItem.material_type_id) {
          stockLedgerToInsert.push({
            business_id: params.businessId,
            item_type: "raw_material",
            item_id: inputItem.material_type_id,
            godown_id: params.godown_id,
            transaction_type: "purchase",
            quantity_delta: Number(inputItem.quantity),
            value_delta: Number(inputItem.taxable_value),
            reference_table: "raw_material_purchases",
            reference_id: purchase.id,
            created_by: userId || null,
          });

          await this.updateRawMaterialStock(params.businessId, inputItem.material_type_id, params.godown_id, Number(inputItem.quantity), Number(inputItem.rate), Number(inputItem.taxable_value));
        }
      } else if (type === "finished_goods") {
        if (inputItem.design_id && inputItem.colour_id) {
          const sq = inputItem.size_quantities || {};
          const totalQty = Object.values(sq).reduce((a, b) => Number(a) + Number(b), 0) || Number(inputItem.quantity);

          finishedStockToInsert.push({
            business_id: params.businessId,
            design_id: inputItem.design_id,
            colour_id: inputItem.colour_id,
            godown_id: params.godown_id,
            entry_type: "purchase",
            size_quantities: sq,
            total_quantity: totalQty,
            cost_per_piece: Number(inputItem.rate),
            total_value: Number(inputItem.taxable_value),
            notes: `Purchase Invoice ${params.purchaseNumber}`,
            created_by: userId || null,
          });

          stockLedgerToInsert.push({
            business_id: params.businessId,
            item_type: "finished_goods",
            item_id: inputItem.design_id,
            godown_id: params.godown_id,
            transaction_type: "purchase",
            quantity_delta: totalQty,
            value_delta: Number(inputItem.taxable_value),
            reference_table: "raw_material_purchases",
            reference_id: purchase.id,
            created_by: userId || null,
          });
        }
      } else if (type === "others") {
        if (defaultExpenseTypeId) {
          const expNumber = `EXP-PUR-${purchase.purchase_number}-${idx + 1}`;
          expensesToInsert.push({
            business_id: params.businessId,
            expense_number: expNumber,
            expense_type_id: defaultExpenseTypeId,
            expense_date: params.invoice_date,
            amount: Number(inputItem.taxable_value || inputItem.amount),
            gst_percent: Number(inputItem.gst_percent || 0),
            gst_amount: Number(inputItem.gst_amount || 0),
            vendor_name: supplierName,
            vendor_invoice_no: params.invoice_no,
            notes: `[Purchase Bill: ${params.purchaseNumber}] ${inputItem.other_item_name || "Other Purchase Item"} (${inputItem.other_category || "expense"})`,
            purchase_id: purchase.id,
            purchase_item_id: insertedItem.id,
            created_by: userId || null,
          });
        }
      }
    }

    // Execute bulk insertions
    if (rollsToInsert.length > 0) {
      const { error: rollsError } = await this.supabase.from("purchase_rolls").insert(rollsToInsert);
      if (rollsError) console.error("Rolls insert warning:", rollsError);
    }

    if (finishedStockToInsert.length > 0) {
      const { error: fgError } = await this.supabase.from("finished_stock").insert(finishedStockToInsert);
      if (fgError) throw new Error(`Failed to update finished stock: ${fgError.message}`);
    }

    if (stockLedgerToInsert.length > 0) {
      const { error: ledgerError } = await this.supabase.from("stock_ledger").insert(stockLedgerToInsert);
      if (ledgerError) console.error("Stock ledger warning:", ledgerError);
    }

    if (expensesToInsert.length > 0) {
      const { error: expError } = await this.supabase.from("expenses").insert(expensesToInsert);
      if (expError) console.error("Expenses insert warning:", expError);
    }

    // Auto-generate Stock Entry Voucher for Stock Movement Registers
    const rmItems = params.items.filter((it) => it.material_type_id && (!it.item_type || it.item_type === "fabric" || it.item_type === "accessory"));
    if (rmItems.length > 0) {
      const entryNumber = `STK-IN-${params.purchaseNumber}`;
      const { data: stockEntry } = await this.supabase
        .from("raw_material_stock_entries")
        .insert({
          business_id: params.businessId,
          stock_entry_number: entryNumber,
          entry_type: "stock_in",
          posting_date: params.invoice_date || new Date().toISOString().split("T")[0],
          godown_id: params.godown_id,
          reference_type: "purchase",
          reference_no: params.invoice_no,
          reference_id: purchase.id,
          remarks: `Auto-registered from Purchase Bill ${params.purchaseNumber}`,
          total_items_value: Number(params.total_taxable_value || params.subtotal || 0),
          grand_total: Number(params.grand_total || 0),
          status: "active",
        })
        .select()
        .single();

      if (stockEntry) {
        const seItems = rmItems.map((item) => ({
          business_id: params.businessId,
          stock_entry_id: stockEntry.id,
          material_type_id: item.material_type_id,
          hsn_sac: item.hsn_sac || null,
          unit: item.unit || "meter",
          quantity: Number(item.quantity),
          rate: Number(item.rate),
          amount: Number(item.taxable_value || item.amount),
        }));

        await this.supabase.from("raw_material_stock_entry_items").insert(seItems);
      }
    }

    try {
      await reconcileRawMaterialStock(this.supabase, params.businessId);
    } catch (recErr) {
      console.warn("Reconciliation on purchase creation warning:", recErr);
    }

    return purchase;
  }

  private async updateRawMaterialStock(
    businessId: string,
    materialTypeId: string,
    godownId: string,
    quantity: number,
    rate: number,
    taxableValue: number
  ) {
    const { data: existingStock } = await this.supabase
      .from("raw_material_current_stock")
      .select("*")
      .eq("business_id", businessId)
      .eq("material_type_id", materialTypeId)
      .eq("godown_id", godownId)
      .maybeSingle();

    const newQty = Number((existingStock?.current_stock || 0)) + quantity;
    const newValue = Number((existingStock?.stock_value || 0)) + taxableValue;
    const newCost = newQty > 0 ? Number((newValue / newQty).toFixed(2)) : Number(rate || existingStock?.unit_cost || 0);

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
          business_id: businessId,
          material_type_id: materialTypeId,
          godown_id: godownId,
          current_stock: newQty,
          unit_cost: newCost,
          stock_value: newValue,
        });
    }
  }

  async softDelete(id: string, businessId: string) {
    // 1. Fetch purchase details with items
    const purchase = await this.getById(id, businessId);
    if (!purchase) throw new Error("Purchase bill not found");

    // 2. Check if any finished goods items from this purchase have been sold in Sales Bills
    const fgItems = (purchase.items || []).filter((it: any) => it.item_type === "finished_goods");
    if (fgItems.length > 0) {
      for (const item of fgItems) {
        if (item.design_id) {
          // Check if sales bills exist for this design after purchase invoice_date
          const { count } = await this.supabase
            .from("sale_bill_items")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .eq("design_id", item.design_id);

          if (count && count > 0) {
            throw new Error(
              `Cannot delete Purchase Bill ${purchase.purchase_number}: Finished goods from this purchase (Design ID: ${item.design?.name || item.design_id}) have already been sold in Sales Bills.`
            );
          }
        }
      }
    }

    // 3. Perform soft delete on purchase bill
    const { error } = await this.supabase
      .from("raw_material_purchases")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw error;

    // 4. Soft delete associated expenses entries created by "others" items
    await this.supabase
      .from("expenses")
      .delete()
      .eq("purchase_id", id)
      .eq("business_id", businessId);

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
