-- ====================================================================
-- TAS ERP - MASTER DATABASE SCHEMA PATCH FOR PURCHASES & FINISHED GOODS
-- Run this script ONCE in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ====================================================================

-- 1. Update raw_material_purchase_items to support Finished Goods, Accessories & Assets
ALTER TABLE raw_material_purchase_items ALTER COLUMN material_type_id DROP NOT NULL;

ALTER TABLE raw_material_purchase_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'fabric',
  ADD COLUMN IF NOT EXISTS design_id UUID REFERENCES designs(id),
  ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id),
  ADD COLUMN IF NOT EXISTS size_quantities JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS other_item_name TEXT,
  ADD COLUMN IF NOT EXISTS other_category TEXT,
  ADD COLUMN IF NOT EXISTS asset_tag TEXT;

-- 2. Update purchase_return_items to support Finished Goods & Accessories
ALTER TABLE purchase_return_items ALTER COLUMN material_type_id DROP NOT NULL;

ALTER TABLE purchase_return_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'fabric',
  ADD COLUMN IF NOT EXISTS design_id UUID REFERENCES designs(id),
  ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id),
  ADD COLUMN IF NOT EXISTS size_quantities JSONB DEFAULT '{}'::jsonb;

-- 3. Add purchase references to expenses table for purchase-linked expense tracking
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES raw_material_purchases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS purchase_item_id UUID REFERENCES raw_material_purchase_items(id) ON DELETE CASCADE;

-- 4. Ensure finished_stock entry_type constraint includes purchase and manual
ALTER TABLE finished_stock DROP CONSTRAINT IF EXISTS finished_stock_entry_type_check;

ALTER TABLE finished_stock ADD CONSTRAINT finished_stock_entry_type_check 
  CHECK (entry_type IN ('production', 'manual', 'adjustment', 'purchase', 'transfer_in', 'transfer_out', 'challan_in', 'challan_out'));

-- 5. Ensure barcode & QR UUID fields exist on finished_stock
ALTER TABLE finished_stock
  ADD COLUMN IF NOT EXISTS qr_uuid UUID DEFAULT gen_random_uuid();

-- 6. Update sale_bill_items to support Fabric Rolls & Raw Material Sales
ALTER TABLE sale_bill_items ALTER COLUMN design_id DROP NOT NULL;

ALTER TABLE sale_bill_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'finished_goods',
  ADD COLUMN IF NOT EXISTS material_type_id UUID REFERENCES raw_material_types(id);

-- 7. Create sale_rolls table for tracking sold fabric rolls
CREATE TABLE IF NOT EXISTS sale_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_bill_items(id) ON DELETE CASCADE,
  purchase_roll_id UUID REFERENCES purchase_rolls(id) ON DELETE SET NULL,
  roll_number TEXT NOT NULL,
  meters NUMERIC NOT NULL DEFAULT 0,
  shade TEXT,
  width NUMERIC,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_sale_rolls_sale_item_id ON sale_rolls(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_sale_rolls_purchase_roll_id ON sale_rolls(purchase_roll_id);

-- 8. Add colour_id to lot_rolls table if missing
ALTER TABLE lot_rolls ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id);

-- 9. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

