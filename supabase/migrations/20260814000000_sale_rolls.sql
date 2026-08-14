-- Migration: 20260814000000_sale_rolls.sql
-- Create sale_rolls table to track roll-wise raw material items for sales bills

CREATE TABLE IF NOT EXISTS sale_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_bill_items(id) ON DELETE CASCADE,
  purchase_roll_id UUID REFERENCES purchase_rolls(id) ON DELETE SET NULL,
  roll_number TEXT NOT NULL,
  meters NUMERIC(12,4) NOT NULL,
  shade TEXT,
  width NUMERIC(8,2),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sale_rolls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sale_rolls' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON sale_rolls
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sale_rolls_business ON sale_rolls(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_rolls_item ON sale_rolls(sale_item_id);
