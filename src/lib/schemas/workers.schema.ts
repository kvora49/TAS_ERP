import { z } from "zod";

export const CreateWorkerSchema = z.object({
  name: z.string().trim().min(2, "Worker name must be at least 2 characters").max(100),
  worker_code: z.string().trim().max(50).optional().nullable(),
  phone: z.string().trim().max(25).optional().nullable(),
  role: z.string().trim().max(50).optional().nullable(),
  process_type: z.string().trim().max(50).optional().nullable(),
  salary_type: z.enum(["monthly", "per_piece", "daily"]).default("monthly"),
  monthly_salary: z.number().nonnegative().optional().default(0),
  piece_rate: z.number().nonnegative().optional().default(0),
  opening_balance: z.number().optional().default(0),
  opening_balance_type: z.enum(["to_receive", "to_pay"]).default("to_pay"),
  status: z.enum(["active", "inactive"]).default("active"),
  is_active: z.boolean().default(true),
});

export const UpdateWorkerSchema = CreateWorkerSchema.partial();

export const WorkerAttendanceSchema = z.object({
  worker_id: z.string().uuid("Invalid worker ID"),
  attendance_date: z.string().min(1, "Date is required"),
  status: z.enum(["present", "absent", "half_day", "overtime", "paid_leave"]),
  overtime_hours: z.number().nonnegative().optional().default(0),
  notes: z.string().trim().max(200).optional().nullable(),
});
