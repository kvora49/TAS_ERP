-- Migration: 20260711000006_production_templates.sql
-- Create production_templates table, add template_id and order_index to production_stages,
-- create default template per business, and backfill existing stages.

CREATE TABLE IF NOT EXISTS production_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE production_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'production_templates' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON production_templates
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Index
CREATE INDEX IF NOT EXISTS idx_production_templates_business ON production_templates(business_id);

-- Alter production_stages
ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES production_templates(id);
ALTER TABLE production_stages ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- Insert default "Standard" template for every existing business (skip if one already exists)
INSERT INTO production_templates (business_id, name, description, is_default)
SELECT b.id, 'Standard Template', 'Default production template containing migrated stages', true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM production_templates pt
  WHERE pt.business_id = b.id AND pt.is_default = true
);

-- Backfill existing production_stages to point to the newly created standard template
UPDATE production_stages ps
SET template_id = pt.id,
    order_index = ps.sort_order
FROM production_templates pt
WHERE ps.business_id = pt.business_id 
  AND pt.is_default = true 
  AND ps.template_id IS NULL;

-- Enforce NOT NULL constraint on template_id (only if column is currently nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'production_stages'
      AND column_name = 'template_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE production_stages ALTER COLUMN template_id SET NOT NULL;
  END IF;
END $$;

