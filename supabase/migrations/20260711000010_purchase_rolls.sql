-- Migration: 20260711000010_purchase_rolls.sql
-- Create purchase_rolls table to track roll-wise raw material items

CREATE TABLE IF NOT EXISTS purchase_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_item_id UUID NOT NULL REFERENCES raw_material_purchase_items(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  meters NUMERIC(12,4) NOT NULL,
  shade TEXT NOT NULL,
  comment TEXT,
  width NUMERIC(8,2),
  weight_unit TEXT CHECK (weight_unit IN ('oz', 'gsm')),
  weight_value NUMERIC(10,2),
  remaining_meters NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE purchase_rolls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_rolls' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON purchase_rolls
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_purchase_rolls_business ON purchase_rolls(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_rolls_item ON purchase_rolls(purchase_item_id);
