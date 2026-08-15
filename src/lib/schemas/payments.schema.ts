import { z } from "zod";

export const PaymentAllocationItemSchema = z.object({
  billId: z.string().uuid("Invalid bill ID").optional(),
  bill_id: z.string().uuid("Invalid bill ID").optional(),
  allocatedAmount: z.number().nonnegative().optional(),
  allocated_amount: z.number().nonnegative().optional(),
  billType: z.string().optional(),
  bill_type: z.string().optional(),
});

export const RecordPaymentSchema = z.object({
  party_id: z.string().uuid("Invalid party ID"),
  amount: z.number().positive("Payment amount must be greater than 0"),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_mode: z.enum(["cash", "bank_transfer", "cheque", "neft", "rtgs", "upi", "card", "pdc", "other"]).default("cash"),
  reference_no: z.string().trim().max(100).optional().nullable(),
  bank_account_id: z.string().uuid("Invalid bank account ID").optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
  allocations: z.array(PaymentAllocationItemSchema).optional().default([]),
  debit_note_allocations: z.array(z.any()).optional().default([]),
});

export const SettleAdvanceSchema = z.object({
  advance_id: z.string().uuid("Invalid advance payment ID"),
  allocations: z.array(PaymentAllocationItemSchema).min(1, "At least one settlement allocation is required"),
});

export const WriteOffSchema = z.object({
  party_id: z.string().uuid("Invalid party ID"),
  bill_id: z.string().uuid("Invalid bill ID"),
  bill_type: z.string().min(1, "Bill type is required"),
  amount: z.number().positive("Write-off amount must be greater than 0"),
  reason: z.string().trim().min(3, "Reason is required").max(300),
});
