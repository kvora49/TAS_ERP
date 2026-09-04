import { z } from "zod";

export const SaleBillItemSchema = z.object({
  item_type: z.enum(["finished_goods", "fabric", "accessory", "others", "b_grade"]).optional().nullable().default("finished_goods"),
  design_id: z.string().optional().nullable(),
  material_type_id: z.string().optional().nullable(),
  b_grade_stock_id: z.string().optional().nullable(),
  is_b_grade: z.boolean().optional().default(false),
  item_name: z.string().optional().nullable(),
  colour_id: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  size_quantities: z.record(z.string(), z.number()).optional().nullable(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  rate: z.number().nonnegative("Rate must be a non-negative number"),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  tax_percent: z.number().min(0).max(100).optional().default(0),
  amount: z.number().nonnegative().optional(),
  unit: z.string().optional().nullable(),
  cost_per_piece: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  hsn_sac: z.string().optional().nullable(),
  rolls: z.array(z.any()).optional().nullable(),
});

export const SaleBillChargeSchema = z.object({
  charge_name: z.string().min(1, "Charge name is required"),
  charge_type: z.enum(["flat", "per_qty", "percentage"]),
  amount: z.number().nonnegative("Amount must be a non-negative number"),
  is_taxable: z.boolean().default(false),
});

export const CreateSaleBillSchema = z.object({
  bill_type: z.enum(["pakka", "kacha"]),
  party_id: z.string().uuid("Invalid party ID"),
  bill_date: z.string().min(1, "Bill date is required"),
  due_date: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  reference_no: z.string().optional().nullable(),
  billing_address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  gst_treatment: z.string().optional().nullable(),
  transporter_name: z.string().optional().nullable(),
  vehicle_no: z.string().optional().nullable(),
  salesman: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  discount_type: z.enum(["flat", "percentage"]).nullable().optional(),
  discount_value: z.number().nonnegative().optional().default(0),
  status: z.enum(["active", "draft"]).default("draft"),
  is_temporary: z.boolean().optional().default(false),
  items: z.array(SaleBillItemSchema).min(1, "At least one item is required"),
  charges: z.array(SaleBillChargeSchema).optional().default([]),
  // Consignee / Ship-To
  ship_to_same_as_bill_to: z.boolean().optional().default(true),
  consignee_name: z.string().optional().nullable(),
  consignee_address: z.string().optional().nullable(),
  consignee_gstin: z.string().optional().nullable(),
  consignee_state: z.string().optional().nullable(),
  consignee_state_code: z.string().optional().nullable(),
  // Dispatch details
  buyer_order_no: z.string().optional().nullable(),
  buyer_order_date: z.string().optional().nullable(),
  dispatch_doc_no: z.string().optional().nullable(),
  delivery_note: z.string().optional().nullable(),
  delivery_note_date: z.string().optional().nullable(),
  dispatched_through: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  terms_of_delivery: z.string().optional().nullable(),
  mode_of_payment: z.string().optional().nullable(),
  // Print exclusions (JSONB)
  print_exclusions: z.record(z.string(), z.boolean()).optional().default({}),
});

export const UpdateSaleBillSchema = CreateSaleBillSchema.partial();
