import * as z from "zod";

export const partySchema = z.object({
  name: z.string().min(2, "Party Name must be at least 2 characters"),
  type: z.array(z.string()).min(1, "Select at least one Party Type"),
  code: z.string().min(1, "Party Code is required"),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  company_name: z.string().optional(),
  email: z.string().email("Invalid email format").or(z.literal("")),
  website: z.string().url("Invalid website URL").or(z.literal("")),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  aadhar: z.string().optional(),
  msme_number: z.string().optional(),
  tan: z.string().optional(),
  billing_address_line1: z.string().optional(),
  billing_address_line2: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_pincode: z.string().optional(),
  shipping_address_line1: z.string().optional(),
  shipping_address_line2: z.string().optional(),
  shipping_city: z.string().optional(),
  shipping_state: z.string().optional(),
  shipping_pincode: z.string().optional(),
  payment_terms: z.string(),
  credit_limit: z.coerce.number().min(0),
  opening_balance: z.coerce.number(),
  opening_balance_date: z.string().optional(),
  currency: z.string(),
  default_purchase_account: z.string().optional(),
  default_godown_id: z.string().optional(),
  remarks: z.string().optional(),
  status: z.string(),
  // Worker fields
  stage_specialty: z.array(z.string()).optional(),
  wage_type: z.string().optional().nullable(),
  wage_rate: z.coerce.number().optional().nullable(),
  worker_type: z.string().optional().nullable(),
  preferred_stage_id: z.string().optional().nullable(),
  working_since: z.string().optional().nullable(),
  contact_numbers: z.array(
    z.object({
      label: z.string().min(1, "Label is required"),
      number: z.string().min(1, "Phone number is required"),
      is_primary: z.boolean(),
    })
  ).optional(),
  bank_details: z.array(
    z.object({
      bank_name: z.string().min(1, "Bank name is required"),
      account_number: z.string().min(5, "Account number must be at least 5 digits"),
      ifsc_code: z.string().min(11, "IFSC must be 11 characters"),
      branch: z.string().optional(),
      is_primary: z.boolean(),
    })
  ).optional(),
});

export type PartyFormValues = z.infer<typeof partySchema>;

export interface Godown {
  id: string;
  name: string;
}

export interface Stage {
  id: string;
  name: string;
  type: string;
}
