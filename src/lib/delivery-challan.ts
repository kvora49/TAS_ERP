import { z } from "zod";

export interface DeliveryRow {
  key: string; kind: "roll" | "garment" | "other"; name: string; design: string;
  colour: string; size: string; serial: string; quantity: number; unit: string;
  weight: number | null; width: string; quality: string;
}
export interface DeliveryDocument {
  number: string; date: string; billId: string; billNumber: string; billDate: string;
  company: { name: string; address: string; gstin: string; phone: string; email: string };
  customer: { name: string; company: string; address: string; gstin: string; phone: string };
  shippingName: string; shippingAddress: string; transporter: string; vehicle: string; lrNumber: string;
  notes: string; rows: DeliveryRow[];
}
const text = (value: unknown) => value == null ? "" : String(value);
const finite = (value: unknown): number | null => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const address = (party: any, prefix: string) => [party?.[`${prefix}_address_line1`], party?.[`${prefix}_address_line2`], party?.[`${prefix}_city`], party?.[`${prefix}_state`], party?.[`${prefix}_pincode`]].filter(Boolean).join(", ");
export const challanDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value; });
export const deliveryChallanInput = z.object({
  sourceUpdatedAt: z.string().nullable(),
  date: challanDate,
  shippingName: z.string().trim().min(1).max(200),
  shippingAddress: z.string().trim().min(5).max(1500),
  transporter: z.string().trim().max(200), vehicle: z.string().trim().max(60), lrNumber: z.string().trim().max(100), notes: z.string().trim().max(1500),
  details: z.array(z.object({ key: z.string().max(160), serial: z.string().trim().max(120), weight: z.number().finite().nonnegative().max(1000000).nullable(), width: z.string().trim().max(60), quality: z.string().trim().max(200) }).strict()).max(1000),
}).strict();
export type DeliveryChallanInput = z.infer<typeof deliveryChallanInput>;

/** Quantity, item identity and bill reference always come from the saved invoice. */
export function buildDeliveryDocument(bill: any, company: any, items: any[], rolls: any[], purchaseRolls: any[] = []): DeliveryDocument {
  const party = bill.party || {};
  const purchases = new Map(purchaseRolls.map(roll => [roll.id, roll]));
  const byItem = new Map<string, any[]>();
  for (const roll of rolls) byItem.set(roll.sale_item_id, [...(byItem.get(roll.sale_item_id) || []), roll]);
  const rows: DeliveryRow[] = [];
  for (const item of items) {
    const fabric = item.item_type === "fabric" || !!item.material_type_id || !!item.raw_material_type_id || /met(er|re)|mtr/i.test(item.unit || "");
    const base = { name: text(item.item_name || item.design?.name || item.material_type?.name || item.description || "Item"), design: text(item.design?.design_number || item.design_code), colour: text(item.colour?.colour_name || item.colour_name), quality: text(item.quality || item.material_type?.name), width: "", weight: null, serial: "", size: "" };
    const itemRolls = byItem.get(item.id) || [];
    if (fabric && itemRolls.length) {
      for (const roll of itemRolls) {
        const source = purchases.get(roll.purchase_roll_id) || {};
        rows.push({ ...base, key: `${item.id}:${roll.id}`, kind: "roll", serial: text(roll.roll_number), quantity: Number(roll.meters), unit: "m", colour: text(roll.shade || base.colour), width: roll.width ? `${roll.width} in` : text(source.width), weight: finite(roll.weight), quality: text(roll.quality || source.quality || base.quality) });
      }
      const sum = itemRolls.reduce((total, roll) => total + Number(roll.meters), 0);
      if (Math.abs(sum - Number(item.quantity)) > 0.01) throw new Error("Roll meters do not match the invoice quantity. Correct the sales bill roll details first.");
    } else if (!fabric && item.size_quantities && Object.keys(item.size_quantities).length) {
      const sizes = Object.entries(item.size_quantities).filter(([, qty]) => Number(qty) > 0);
      if (Math.abs(sizes.reduce((sum, [, qty]) => sum + Number(qty), 0) - Number(item.quantity)) > 0.01) throw new Error("Size quantities do not match the invoice quantity. Correct the sales bill first.");
      for (const [size, qty] of sizes) rows.push({ ...base, key: `${item.id}:${size}`, kind: "garment", size, quantity: Number(qty), unit: "pcs" });
    } else {
      rows.push({ ...base, key: item.id, kind: fabric ? "roll" : item.item_type === "finished_goods" || item.design ? "garment" : "other", size: text(item.size), serial: text(item.serial_no), quantity: Number(item.quantity), unit: fabric ? "m" : text(item.unit || "pcs") });
    }
  }
  if (!rows.length || rows.some(row => !Number.isFinite(row.quantity) || row.quantity <= 0)) throw new Error("The invoice must contain positive item quantities.");
  return {
    number: `DC-${bill.bill_number}`, date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    billId: bill.id, billNumber: bill.bill_number, billDate: bill.bill_date,
    company: { name: text(company?.name), address: text(company?.address), gstin: text(company?.gstin), phone: text(company?.phone), email: text(company?.email) },
    customer: { name: text(party.name), company: text(party.company_name), address: text(bill.billing_address || address(party, "billing")), gstin: text(bill.gstin || party.gstin), phone: text(bill.phone || party.phone) },
    shippingName: text(bill.consignee_name || party.company_name || party.name),
    shippingAddress: text((bill.ship_to_same_as_bill_to !== true && bill.consignee_address) || address(party, "shipping")),
    transporter: text(bill.dispatched_through || bill.transporter_name), vehicle: text(bill.vehicle_no), lrNumber: text(bill.lr_number || bill.lr_awb_no), notes: "", rows,
  };
}

export function finalizeDeliveryDocument(draft: DeliveryDocument, input: DeliveryChallanInput): DeliveryDocument {
  if (input.date < draft.billDate) throw new Error("Challan date cannot be before the sales bill date.");
  const details = new Map(input.details.map(row => [row.key, row]));
  if (details.size !== input.details.length || details.size !== draft.rows.length || draft.rows.some(row => !details.has(row.key))) throw new Error("The invoice items changed. Reload and review the challan.");
  const { details: _, sourceUpdatedAt: _version, ...header } = input;
  return { ...draft, ...header, rows: draft.rows.map(row => {
    const detail = details.get(row.key)!;
    return { ...row, ...detail, serial: row.kind === "roll" && row.serial ? row.serial : detail.serial };
  }) };
}

export function deliveryTotals(rows: DeliveryRow[]): string {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.unit, (totals.get(row.unit) || 0) + row.quantity);
  return Array.from(totals, ([unit, quantity]) => `${Number(quantity.toFixed(4))} ${unit}`).join(" / ");
}
