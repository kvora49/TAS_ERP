import { z } from "zod";

export const StockAdjustmentSchema = z.object({
  item_type: z.enum(["raw_material", "finished_goods", "accessory"]),
  item_id: z.string().uuid("Invalid item ID"),
  godown_id: z.string().uuid("Invalid godown ID"),
  adjustment_type: z.enum(["add", "reduce", "reconcile", "set"]),
  quantity: z.number().positive("Quantity must be greater than 0"),
  reason: z.string().trim().min(3, "Reason is required").max(300),
  size_quantities: z.record(z.string(), z.number()).optional().nullable(),
});

export const StockTransferSchema = z.object({
  from_godown_id: z.string().uuid("Invalid source godown ID"),
  to_godown_id: z.string().uuid("Invalid destination godown ID"),
  item_type: z.enum(["raw_material", "finished_goods", "accessory"]),
  item_id: z.string().uuid("Invalid item ID"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  transfer_date: z.string().min(1, "Date is required"),
  notes: z.string().trim().max(300).optional().nullable(),
});
