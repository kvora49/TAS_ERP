-- Migration: Support Finished Goods and Accessories in Purchase Return items
ALTER TABLE purchase_return_items ALTER COLUMN material_type_id DROP NOT NULL;

ALTER TABLE purchase_return_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'fabric',
  ADD COLUMN IF NOT EXISTS design_id UUID REFERENCES designs(id),
  ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id),
  ADD COLUMN IF NOT EXISTS size_quantities JSONB DEFAULT '{}'::jsonb;
