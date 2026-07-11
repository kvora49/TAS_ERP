-- Migration: 20260711000008_design_spec_templates.sql
-- Create design_spec_templates table with tenant isolation, foreign keys, unique constraint, and RLS

CREATE TABLE IF NOT EXISTS design_spec_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  garment_type_id UUID NOT NULL REFERENCES garment_types(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT unique_business_garment_type UNIQUE (business_id, garment_type_id)
);

-- Enable RLS
ALTER TABLE design_spec_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'design_spec_templates' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON design_spec_templates
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_design_spec_templates_business ON design_spec_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_design_spec_templates_garment_type ON design_spec_templates(garment_type_id);
