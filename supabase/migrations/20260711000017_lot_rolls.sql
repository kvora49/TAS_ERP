-- Migration: 20260711000017_lot_rolls.sql
-- Create lot_rolls table to track allocated purchase rolls

CREATE TABLE IF NOT EXISTS lot_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  purchase_roll_id UUID NOT NULL REFERENCES purchase_rolls(id) ON DELETE CASCADE,
  allocated_meters NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lot_rolls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lot_rolls' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON lot_rolls
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_lot_rolls_business ON lot_rolls(business_id);
CREATE INDEX IF NOT EXISTS idx_lot_rolls_lot ON lot_rolls(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_rolls_roll ON lot_rolls(purchase_roll_id);
