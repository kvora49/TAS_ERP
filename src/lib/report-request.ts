import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Invalid date");

export const reportRequestSchema = z.object({
  from: date.optional(),
  to: date.optional(),
  bill_type: z.enum(["all", "kacha", "pakka"]).optional(),
  party_id: z.union([z.uuid(), z.literal("all")]).optional(),
  brand_id: z.union([z.uuid(), z.literal("all")]).optional(),
  design_id: z.union([z.uuid(), z.literal("all")]).optional(),
  worker_id: z.union([z.uuid(), z.literal("all")]).optional(),
  selected_worker_id: z.union([z.uuid(), z.literal("all")]).optional(),
  lot_id: z.union([z.uuid(), z.literal("all")]).optional(),
  godown_id: z.union([z.uuid(), z.literal("all")]).optional(),
  account_id: z.union([z.uuid(), z.literal("all")]).optional(),
  aging_bucket: z.enum(["all", "0-30", "31-60", "61-90", "90+"]).optional(),
  direction: z.enum(["all", "received", "paid"]).optional(),
  account_category: z.enum(["all", "both", "kacha", "pakka"]).optional(),
  compare: z.enum(["prev_period", "prev_month", "prev_quarter", "prev_fy", "none"]).optional(),
  tab: z.enum(["receivables", "payables", "receipts", "payments", "accounts", "cheques", "advances", "transfers", "all_transactions", "combined", "upi", "bank", "cash"]).optional(),
}).refine(({ from, to }) => !from || !to || from <= to, "Start date must precede end date");

export function validReportRequest(params: URLSearchParams): boolean {
  return reportRequestSchema.safeParse(Object.fromEntries(params)).success;
}
