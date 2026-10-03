import { z } from "zod";

import { sourceDate, recordedTaxSchema } from "@/lib/report-source-fields";

export const CreatePurchaseBillSchema = recordedTaxSchema.extend({
  supplier_id: z.string().uuid("Invalid supplier ID"),
  invoice_no: z.string().optional().nullable(),
  invoice_date: sourceDate,
  due_date: sourceDate.nullable().optional(),
  bill_type: z.enum(["pakka", "kacha"]).nullable().optional(),
  grand_total: z.number().nonnegative("Grand total must be a non-negative number"),
  paid_amount: z.number().nonnegative("Paid amount must be a non-negative number").optional().default(0),
});

// Partial edits must not apply the create-only paid_amount default to an invoice.
export const UpdatePurchaseBillSchema = CreatePurchaseBillSchema.omit({ paid_amount: true }).partial().extend({
  paid_amount: z.number().finite().nonnegative().optional(),
});
