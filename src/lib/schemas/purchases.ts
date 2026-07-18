import { z } from "zod";

export const CreatePurchaseBillSchema = z.object({
  supplier_id: z.string().uuid("Invalid supplier ID"),
  invoice_no: z.string().optional().nullable(),
  invoice_date: z.string().min(1, "Invoice date is required"),
  grand_total: z.number().nonnegative("Grand total must be a non-negative number"),
  paid_amount: z.number().nonnegative("Paid amount must be a non-negative number").optional().default(0),
});

export const UpdatePurchaseBillSchema = CreatePurchaseBillSchema.partial();
