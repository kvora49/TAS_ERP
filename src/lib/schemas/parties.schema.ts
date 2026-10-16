import { z } from "zod";
import { validateGSTINInput } from "@/lib/gst-utils";

export const CreatePartySchema = z.object({
  name: z.string().trim().min(2, "Party name must be at least 2 characters").max(120),
  type: z.array(z.string().trim().min(1).max(40)).min(1, "At least one party type is required").max(4),
  code: z.string().trim().max(40).optional().nullable(),
  company_name: z.string().trim().max(150).optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  whatsapp_number: z.string().trim().max(25).optional().nullable(),
  email: z.string().trim().email("Invalid email address").max(120).optional().nullable().or(z.literal("")),
  website: z.string().trim().url("Invalid website URL").max(250).optional().nullable().or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val || val === "URP") return true;
      return validateGSTINInput(val).isValid;
    }, {
      message: "GSTIN must be exactly 15 characters (e.g. 24ABCDE1234F1Z5) with a valid state code",
    }),
  pan: z.string().trim().max(20).optional().nullable(),
  aadhar: z.string().trim().max(20).optional().nullable(),
  msme_number: z.string().trim().max(50).optional().nullable(),
  tan: z.string().trim().max(20).optional().nullable(),
  billing_address_line1: z.string().trim().max(300).optional().nullable(),
  billing_address_line2: z.string().trim().max(300).optional().nullable(),
  billing_city: z.string().trim().max(100).optional().nullable(),
  billing_state: z.string().trim().max(100).optional().nullable(),
  billing_pincode: z.string().trim().max(12).optional().nullable(),
  shipping_address_line1: z.string().trim().max(300).optional().nullable(),
  shipping_address_line2: z.string().trim().max(300).optional().nullable(),
  shipping_city: z.string().trim().max(100).optional().nullable(),
  shipping_state: z.string().trim().max(100).optional().nullable(),
  shipping_pincode: z.string().trim().max(12).optional().nullable(),
  payment_terms: z.string().trim().max(50).optional().nullable(),
  credit_limit: z.coerce.number().finite().nonnegative().optional(),
  opening_balance: z.coerce.number().finite().optional(),
  opening_balance_date: z.string().date().optional().nullable().or(z.literal("")),
  currency: z.string().trim().length(3).optional().nullable(),
  default_purchase_account: z.string().trim().max(100).optional().nullable(),
  default_godown_id: z.string().uuid().optional().nullable().or(z.literal("")),
  remarks: z.string().trim().max(2_000).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional().nullable(),
  contact_numbers: z.array(z.object({
    label: z.string().trim().min(1).max(50),
    number: z.string().trim().min(1).max(25),
    is_primary: z.boolean(),
  })).max(10).optional(),
  bank_details: z.array(z.object({
    bank_name: z.string().trim().min(1).max(120),
    account_number: z.string().trim().min(5).max(40),
    ifsc_code: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"),
    branch: z.string().trim().max(120).optional().nullable(),
    is_primary: z.boolean(),
  })).max(10).optional(),
  stage_specialty: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  wage_type: z.string().trim().max(50).optional().nullable(),
  wage_rate: z.coerce.number().finite().nonnegative().optional().nullable(),
  worker_type: z.string().trim().max(50).optional().nullable(),
  preferred_stage_id: z.string().uuid().optional().nullable().or(z.literal("")),
  working_since: z.string().date().optional().nullable().or(z.literal("")),
});

export const UpdatePartySchema = CreatePartySchema.partial();
