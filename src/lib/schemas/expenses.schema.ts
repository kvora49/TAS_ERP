import { z } from "zod";

export const CreateExpenseSchema = z.object({
  expense_type_id: z.string().uuid("Invalid expense type ID").optional().nullable(),
  category: z.string().trim().min(2, "Category is required").max(100),
  amount: z.number().positive("Amount must be greater than 0"),
  expense_date: z.string().min(1, "Expense date is required"),
  payment_mode: z.string().default("cash"),
  bank_account_id: z.string().uuid("Invalid bank account ID").optional().nullable(),
  paid_to: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  attachment_url: z.string().optional().nullable(),
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

export const MiscIncomeSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(120),
  category: z.string().trim().max(100).optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0"),
  income_date: z.string().min(1, "Income date is required"),
  payment_mode: z.string().default("cash"),
  bank_account_id: z.string().uuid("Invalid bank account ID").optional().nullable(),
  received_from: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});
