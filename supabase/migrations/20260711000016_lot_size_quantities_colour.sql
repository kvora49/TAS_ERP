-- Migration: 20260711000016_lot_size_quantities_colour.sql
-- Add colour_id to lot_size_quantities and update unique constraints

ALTER TABLE lot_size_quantities ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id);

-- Drop old unique constraint
ALTER TABLE lot_size_quantities DROP CONSTRAINT IF EXISTS lot_size_quantities_business_id_lot_id_size_key;

-- Add new unique constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lot_size_quantities_business_id_lot_id_colour_id_size_key'
  ) THEN
    ALTER TABLE lot_size_quantities ADD CONSTRAINT lot_size_quantities_business_id_lot_id_colour_id_size_key UNIQUE (business_id, lot_id, colour_id, size);
  END IF;
END $$;

