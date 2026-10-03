import { z } from "zod";

export const sourceDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !value.startsWith("0000-") && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const money = z.number().finite().nonnegative().max(999999999999);
export const recordedTaxSchema = z.object({
  taxable_amount: money.nullable().optional(),
  cgst: money.nullable().optional(),
  sgst: money.nullable().optional(),
  igst: money.nullable().optional(),
});

/** Omitted components stay unknown; an explicitly recorded zero stays zero. */
export function recordedTaxFields(input: z.infer<typeof recordedTaxSchema>) {
  return Object.fromEntries(Object.keys(recordedTaxSchema.shape).map(key => [key, input[key as keyof typeof input] ?? null]));
}

export const manualNoteSchema = recordedTaxSchema.extend({
  party_id: z.string().uuid(),
  cn_date: sourceDate.optional(),
  dn_date: sourceDate.optional(),
  amount: money.positive(),
  reason: z.string().max(2000).nullable().optional(),
}).superRefine((value, ctx) => {
  if ([value.taxable_amount, value.cgst, value.sgst, value.igst].every(v => v != null)) {
    const recorded = value.taxable_amount! + value.cgst! + value.sgst! + value.igst!;
    if (Math.abs(recorded - value.amount) > 1) ctx.addIssue({code: "custom", path: ["amount"], message: "Recorded taxable value and tax must match the note total (within rounding)"});
  }
});
