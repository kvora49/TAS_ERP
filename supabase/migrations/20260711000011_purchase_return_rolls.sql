-- Migration: 20260711000011_purchase_return_rolls.sql
-- Create purchase_return_rolls table to track roll-wise returns

CREATE TABLE IF NOT EXISTS purchase_return_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  return_item_id UUID NOT NULL REFERENCES purchase_return_items(id) ON DELETE CASCADE,
  purchase_roll_id UUID NOT NULL REFERENCES purchase_rolls(id) ON DELETE CASCADE,
  returned_meters NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE purchase_return_rolls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_return_rolls' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON purchase_return_rolls
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_purchase_return_rolls_business ON purchase_return_rolls(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_rolls_item ON purchase_return_rolls(return_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_rolls_roll ON purchase_return_rolls(purchase_roll_id);
