import { z } from "zod";

export const SalaryPaymentSchema = z.object({
  worker_id: z.string().uuid("Invalid worker ID"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2050),
  basic_salary: z.number().nonnegative(),
  overtime_amount: z.number().nonnegative().optional().default(0),
  bonus: z.number().nonnegative().optional().default(0),
  deductions: z.number().nonnegative().optional().default(0),
  net_salary: z.number().nonnegative(),
  paid_amount: z.number().positive("Paid amount must be greater than 0"),
  payment_mode: z.string().default("cash"),
  bank_account_id: z.string().uuid("Invalid bank account ID").optional().nullable(),
  payment_date: z.string().min(1, "Payment date is required"),
  remarks: z.string().trim().max(300).optional().nullable(),
});

export const SalaryAdvanceSchema = z.object({
  worker_id: z.string().uuid("Invalid worker ID"),
  amount: z.number().positive("Advance amount must be greater than 0"),
  advance_date: z.string().min(1, "Date is required"),
  payment_mode: z.string().default("cash"),
  bank_account_id: z.string().uuid("Invalid bank account ID").optional().nullable(),
  remarks: z.string().trim().max(300).optional().nullable(),
});
