-- Migration to support Finished Goods and Others purchase tabs
-- 1. Make material_type_id nullable in raw_material_purchase_items (since FG and Others do not use material_type_id)
ALTER TABLE raw_material_purchase_items ALTER COLUMN material_type_id DROP NOT NULL;

-- 2. Add item_type and relevant columns to raw_material_purchase_items
ALTER TABLE raw_material_purchase_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'fabric' CHECK (item_type IN ('fabric', 'accessory', 'finished_goods', 'others')),
  ADD COLUMN IF NOT EXISTS design_id UUID REFERENCES designs(id),
  ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id),
  ADD COLUMN IF NOT EXISTS size_quantities JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS other_item_name TEXT,
  ADD COLUMN IF NOT EXISTS other_category TEXT CHECK (other_category IN ('capital_asset', 'office_expense', 'consumable')),
  ADD COLUMN IF NOT EXISTS asset_tag TEXT;

-- 3. Add purchase references to expenses table for purchase-linked expense tracking
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES raw_material_purchases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS purchase_item_id UUID REFERENCES raw_material_purchase_items(id) ON DELETE CASCADE;
