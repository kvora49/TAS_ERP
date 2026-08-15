import { z } from "zod";

export const CreatePartySchema = z.object({
  name: z.string().trim().min(2, "Party name must be at least 2 characters").max(120),
  company_name: z.string().trim().max(150).optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  email: z.string().trim().email("Invalid email address").max(120).optional().nullable().or(z.literal("")),
  type: z.array(z.string()).min(1, "At least one party type is required"),
  gstin: z.string().trim().max(20).optional().nullable(),
  billing_address: z.string().trim().max(300).optional().nullable(),
  shipping_address: z.string().trim().max(300).optional().nullable(),
  state: z.string().trim().max(50).optional().nullable(),
  state_code: z.string().trim().max(5).optional().nullable(),
  pan_number: z.string().trim().max(20).optional().nullable(),
  opening_balance: z.number().optional().default(0),
  opening_balance_type: z.enum(["to_receive", "to_pay"]).default("to_receive"),
  credit_period_days: z.number().int().nonnegative().optional().default(30),
  credit_limit: z.number().nonnegative().optional().default(0),
});

export const UpdatePartySchema = CreatePartySchema.partial();
