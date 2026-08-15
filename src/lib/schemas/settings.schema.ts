import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(120),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(["owner", "admin", "manager", "accountant", "staff", "intern"]),
  password: z.string().min(6, "Password must be at least 6 characters").optional().nullable(),
});

export const UpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  role: z.enum(["owner", "admin", "manager", "accountant", "staff", "intern"]).optional(),
  password: z.string().min(6).optional().nullable(),
});

export const DeactivateUserActionSchema = z.object({
  action: z.enum(["activate", "deactivate"]).default("deactivate"),
});

export const RolePermissionItemSchema = z.object({
  role: z.string().min(1),
  module: z.string().min(1),
  can_view: z.boolean().default(false),
  can_add: z.boolean().default(false),
  can_edit: z.boolean().default(false),
  can_delete: z.boolean().default(false),
  can_approve: z.boolean().default(false),
  can_export: z.boolean().default(false),
});

export const UpdateRolePermissionsSchema = z.object({
  permissions: z.array(RolePermissionItemSchema).min(1, "Permissions list cannot be empty"),
});

export const GeneralSettingsSchema = z.object({
  enable_gst: z.boolean().optional(),
  enable_kacha_billing: z.boolean().optional(),
  enable_batch_tracking: z.boolean().optional(),
  allow_negative_stock: z.boolean().optional(),
  low_stock_alerts: z.boolean().optional(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
  theme_color: z.string().optional(),
  date_format: z.string().optional(),
  fiscal_year_start: z.string().optional(),
});

export const FinancialSettingsSchema = z.object({
  default_credit_period_days: z.number().int().nonnegative().optional(),
  enable_payment_reminders: z.boolean().optional(),
  round_off_sales_invoices: z.boolean().optional(),
  interest_rate_overdue_percent: z.number().nonnegative().optional(),
});
