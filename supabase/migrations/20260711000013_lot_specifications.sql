-- Migration: 20260711000013_lot_specifications.sql
-- Create lot_specifications table

CREATE TABLE IF NOT EXISTS lot_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  additional_details TEXT,
  design_reference_text TEXT,
  design_reference_photos TEXT[] DEFAULT '{}',
  custom_qa JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lot_specifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lot_specifications' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON lot_specifications
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_lot_specifications_business ON lot_specifications(business_id);
CREATE INDEX IF NOT EXISTS idx_lot_specifications_lot ON lot_specifications(lot_id);
