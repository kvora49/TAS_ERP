-- Migration: 20260711000015_lot_spec_sheet.sql
-- Create lot_spec_sheet table

CREATE TABLE IF NOT EXISTS lot_spec_sheet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES design_spec_templates(id) ON DELETE CASCADE,
  spec_values JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lot_spec_sheet ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lot_spec_sheet' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON lot_spec_sheet
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_lot_spec_sheet_business ON lot_spec_sheet(business_id);
CREATE INDEX IF NOT EXISTS idx_lot_spec_sheet_lot ON lot_spec_sheet(lot_id);
