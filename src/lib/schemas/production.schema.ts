import { z } from "zod";

export const CreateLotSchema = z.object({
  lot_number: z.string().trim().max(50).optional().nullable(),
  lot_name: z.string().trim().min(2, "Lot name is required").max(100),
  design_id: z.string().uuid("Invalid design ID"),
  brand_id: z.string().uuid("Invalid brand ID").optional().nullable(),
  planned_quantity: z.number().int().positive("Planned quantity must be greater than 0"),
  target_date: z.string().optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
  rolls: z.array(z.any()).optional().default([]),
  accessories: z.array(z.any()).optional().default([]),
});

export const UpdateLotSchema = CreateLotSchema.partial();

export const MoveToStockSchema = z.object({
  godown_id: z.string().uuid("Invalid godown ID"),
  total_pieces: z.number().int().positive("Total pieces must be greater than 0"),
  size_quantities: z.record(z.string(), z.number()).optional().default({}),
  cost_per_piece: z.number().nonnegative().optional().default(0),
});

export const StageEntrySchema = z.object({
  lot_id: z.string().uuid("Invalid lot ID"),
  stage_id: z.string().uuid("Invalid stage ID"),
  worker_id: z.string().uuid("Invalid worker/contractor ID"),
  input_quantity: z.number().int().positive(),
  output_quantity: z.number().int().nonnegative(),
  rate_per_piece: z.number().nonnegative().optional().default(0),
  entry_date: z.string().min(1, "Entry date is required"),
  remarks: z.string().trim().max(300).optional().nullable(),
});
