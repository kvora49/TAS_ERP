import { z } from "zod";

export const BankAccountSchema = z.object({
  name: z.string().trim().min(2, "Account title is required").max(100),
  bank_name: z.string().trim().max(100).optional().nullable(),
  account_number: z.string().trim().max(50).optional().nullable(),
  ifsc_code: z.string().trim().max(20).optional().nullable(),
  branch_name: z.string().trim().max(100).optional().nullable(),
  sub_label: z.string().trim().max(100).optional().nullable(),
  type: z.enum(["current", "savings", "cash", "upi", "od", "other"]).default("current"),
  account_category: z.enum(["pakka", "kacha"]).default("pakka"),
  opening_balance: z.number().optional().default(0),
  is_default: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

export const BrandSchema = z.object({
  name: z.string().trim().min(2, "Brand name is required").max(100),
  gstin: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  email: z.string().trim().email("Invalid email").max(120).optional().nullable().or(z.literal("")),
  logo_url: z.string().optional().nullable(),
  is_primary: z.boolean().optional().default(false),
});

export const GodownSchema = z.object({
  name: z.string().trim().min(2, "Godown name is required").max(100),
  code: z.string().trim().max(30).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  is_default: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

export const RawMaterialTypeSchema = z.object({
  name: z.string().trim().min(2, "Material name is required").max(100),
  category: z.enum(["fabric", "accessory", "thread", "packaging", "others"]).default("fabric"),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  hsn_code: z.string().trim().max(20).optional().nullable(),
  reorder_level: z.number().nonnegative().optional().default(10),
  description: z.string().trim().max(300).optional().nullable(),
});
