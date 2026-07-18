import { SalesBillRepository } from "../repositories/sales-bill.repository";
import { CreateSaleBillSchema, UpdateSaleBillSchema } from "@/lib/schemas/sales";

export class SalesBillService {
  constructor(private repository: SalesBillRepository) {}

  calculateTotals(params: {
    items: any[];
    charges?: any[];
    discount_type: "flat" | "percentage" | null;
    discount_value: number;
    gst_treatment: string;
    isInterstate: boolean;
  }) {
    const { items, charges = [], discount_type, discount_value, gst_treatment, isInterstate } = params;

    const itemTotal = items.reduce((sum, it) => sum + (Number(it.rate || 0) * Number(it.quantity || 0)), 0);
    const itemTotalAfterDiscount = items.reduce(
      (sum, it) => sum + (Number(it.rate || 0) * Number(it.quantity || 0) * (1 - Number(it.discount_percent || 0) / 100)),
      0
    );

    const taxableChargesTotal = charges
      .filter((c) => c.is_taxable)
      .reduce((sum, c) => {
        if (c.charge_type === "flat") return sum + Number(c.amount || 0);
        if (c.charge_type === "per_qty") {
          const totalQty = items.reduce((tot, it) => tot + Number(it.quantity || 0), 0);
          return sum + (Number(c.amount || 0) * totalQty);
        }
        if (c.charge_type === "percentage") {
          return sum + (itemTotalAfterDiscount * (Number(c.amount || 0) / 100));
        }
        return sum;
      }, 0);

    const nonTaxableChargesTotal = charges
      .filter((c) => !c.is_taxable)
      .reduce((sum, c) => {
        if (c.charge_type === "flat") return sum + Number(c.amount || 0);
        if (c.charge_type === "per_qty") {
          const totalQty = items.reduce((tot, it) => tot + Number(it.quantity || 0), 0);
          return sum + (Number(c.amount || 0) * totalQty);
        }
        if (c.charge_type === "percentage") {
          return sum + (itemTotalAfterDiscount * (Number(c.amount || 0) / 100));
        }
        return sum;
      }, 0);

    const subTotal = itemTotalAfterDiscount + taxableChargesTotal;
    
    let discountAmount = 0;
    if (discount_type === "flat") {
      discountAmount = discount_value;
    } else if (discount_type === "percentage") {
      discountAmount = subTotal * (discount_value / 100);
    }

    const taxableAmount = Math.max(0, subTotal - discountAmount);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (gst_treatment === "regular") {
      items.forEach((item) => {
        const itemAmt = Number(item.rate || 0) * Number(item.quantity || 0) * (1 - Number(item.discount_percent || 0) / 100);
        const share = itemTotalAfterDiscount > 0 ? itemAmt / itemTotalAfterDiscount : 0;
        const itemShareOfSubtotal = itemAmt + (taxableChargesTotal * share);
        const itemNetTaxableAfterDiscount = Math.max(0, itemShareOfSubtotal - (discountAmount * share));
        const itemGst = itemNetTaxableAfterDiscount * (Number(item.tax_percent || 0) / 100);

        if (isInterstate) {
          igst += itemGst;
        } else {
          cgst += itemGst / 2;
          sgst += itemGst / 2;
        }
      });
    }

    const preRoundTotal = taxableAmount + cgst + sgst + igst + nonTaxableChargesTotal;
    const grandTotal = Math.round(preRoundTotal);
    const roundOff = grandTotal - preRoundTotal;

    return {
      item_total: itemTotal,
      charges_total: taxableChargesTotal + nonTaxableChargesTotal,
      sub_total: subTotal,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      cgst,
      sgst,
      igst,
      round_off: roundOff,
      grand_total: grandTotal,
    };
  }

  async validateAndCreate(body: any, businessId: string, userId: string | null) {
    const parsed = CreateSaleBillSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.flatten()));
    }

    const { items, charges, ...rest } = parsed.data;

    let isInterstate = false;
    if (rest.gstin && rest.gstin.length >= 2) {
      const { data: biz } = await this.repository.supabase
        .from("businesses")
        .select("gstin")
        .eq("id", businessId)
        .maybeSingle();

      if (biz?.gstin && biz.gstin.trim().substring(0, 2) !== rest.gstin.trim().substring(0, 2)) {
        isInterstate = true;
      }
    }

    // Generate next sequential bill number
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = rest.bill_type === "kacha" ? `KAC-${yyyy}-${mm}` : `INV-${yyyy}-${mm}`;

    const { data: bills } = await this.repository.supabase
      .from("sale_bills")
      .select("bill_number")
      .eq("business_id", businessId)
      .eq("bill_type", rest.bill_type)
      .like("bill_number", `${prefix}-%`);

    let nextNum = 1;
    if (bills && bills.length > 0) {
      const nums = bills.map((b) => {
        if (!b.bill_number) return 0;
        const numPart = b.bill_number.substring(prefix.length + 1);
        const parsed = parseInt(numPart, 10);
        return isNaN(parsed) ? 0 : parsed;
      });
      const maxNum = Math.max(...nums, 0);
      nextNum = maxNum + 1;
    }
    const billNumber = `${prefix}-${String(nextNum).padStart(3, "0")}`;

    const calculated = this.calculateTotals({
      items,
      charges: charges || [],
      discount_type: rest.discount_type || null,
      discount_value: rest.discount_value || 0,
      gst_treatment: rest.gst_treatment || "regular",
      isInterstate,
    });

    return this.repository.create({
      ...rest,
      ...calculated,
      bill_number: billNumber,
      business_id: businessId,
      created_by: userId,
    }, items, charges || []);
  }

  async validateAndUpdate(billId: string, body: any, businessId: string) {
    const parsed = UpdateSaleBillSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.flatten()));
    }

    const { items, charges, ...rest } = parsed.data;

    let isInterstate = false;
    if (rest.gstin && rest.gstin.length >= 2) {
      const { data: biz } = await this.repository.supabase
        .from("businesses")
        .select("gstin")
        .eq("id", businessId)
        .maybeSingle();

      if (biz?.gstin && biz.gstin.trim().substring(0, 2) !== rest.gstin.trim().substring(0, 2)) {
        isInterstate = true;
      }
    }

    const calculated = this.calculateTotals({
      items: items ?? [],
      charges: charges ?? [],
      discount_type: rest.discount_type || null,
      discount_value: rest.discount_value || 0,
      gst_treatment: rest.gst_treatment || "regular",
      isInterstate,
    });

    return this.repository.updateAtomic(billId, businessId, {
      ...rest,
      ...calculated,
    }, items ?? [], charges ?? []);
  }
}
