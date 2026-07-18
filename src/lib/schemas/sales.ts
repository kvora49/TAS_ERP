import { z } from "zod";

export const SaleBillItemSchema = z.object({
  design_id: z.string().uuid("Invalid design ID"),
  colour_id: z.string().uuid("Invalid colour ID").nullable().optional(),
  size: z.string().min(1, "Size is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  rate: z.number().nonnegative("Rate must be a non-negative number"),
  discount_percent: z.number().min(0).max(100).default(0),
  tax_percent: z.number().min(0).max(100).default(0),
  amount: z.number().nonnegative().optional(),
  unit: z.string().optional().nullable(),
  cost_per_piece: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  hsn_sac: z.string().optional().nullable(),
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
  items: z.array(SaleBillItemSchema).min(1, "At least one item is required"),
  charges: z.array(SaleBillChargeSchema).optional().default([]),
});

export const UpdateSaleBillSchema = CreateSaleBillSchema.partial();
