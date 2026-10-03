import { z } from "zod";
import { sourceDate } from "@/lib/report-source-fields";

export const openingAccountKinds = ["cash", "bank", "receivables", "raw_inventory", "finished_inventory", "wip", "fixed_assets", "other_assets", "payables", "worker_payables", "expense_payables", "loans", "other_liabilities", "equity"] as const;
export const openingLineSchema = z.object({
  kind: z.enum(openingAccountKinds),
  label: z.string().trim().min(1).max(120),
  debit: z.number().finite().nonnegative().max(999999999999),
  credit: z.number().finite().nonnegative().max(999999999999),
  quantity: z.number().finite().nonnegative().nullable().optional(),
  unit: z.string().trim().max(30).optional(),
  reference: z.string().trim().max(500),
}).strict().refine(line => !(line.debit > 0 && line.credit > 0), "Use either debit or credit on a line");
export const openingDraftSchema = z.object({
  as_of: sourceDate,
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(4000),
  lines: z.array(openingLineSchema).min(1).max(100),
}).strict();
export type OpeningDraft = z.infer<typeof openingDraftSchema>;
export function openingTotals(lines: OpeningDraft["lines"]) {
  const debit = Math.round(lines.reduce((sum, line) => sum + line.debit, 0) * 100) / 100;
  const credit = Math.round(lines.reduce((sum, line) => sum + line.credit, 0) * 100) / 100;
  return { debit, credit, difference: Math.round((debit - credit) * 100) / 100 };
}
export const openingActionSchema = z.object({
  id: z.string().uuid().nullable(), version: z.number().int().nonnegative(),
  action: z.enum(["save", "submit", "approve", "reject", "revise"]),
  draft: openingDraftSchema.optional(), review_note: z.string().trim().max(4000).optional(), complete_position: z.boolean().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === "save" && !value.draft) ctx.addIssue({code:"custom",path:["draft"],message:"Draft is required"});
  if (value.action !== "save" && !value.id) ctx.addIssue({code:"custom",path:["id"],message:"Saved entry is required"});
  if (["approve", "reject"].includes(value.action) && (value.review_note?.length ?? 0) < 10) ctx.addIssue({code:"custom",path:["review_note"],message:"Explain the review with at least ten characters"});
  if (value.action === "approve" && value.complete_position !== true) ctx.addIssue({code:"custom",path:["complete_position"],message:"Confirm the complete company position"});
});
