-- Migration: 20260808000001_raw_material_transfers.sql
-- Description: Database tables and RLS for Raw Material & Accessories Godown Transfers

-- 1. Raw material transfers header table
CREATE TABLE IF NOT EXISTS raw_material_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL,
  from_godown_id UUID NOT NULL REFERENCES godowns(id),
  to_godown_id UUID NOT NULL REFERENCES godowns(id) CHECK (from_godown_id <> to_godown_id),
  reference_no TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('Stock Rebalancing', 'Production Requirement', 'Godown Consolidation', 'Other')),
  remarks TEXT,
  total_quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, transfer_number)
);

ALTER TABLE raw_material_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_transfers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON raw_material_transfers
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_raw_material_transfers_updated_at ON raw_material_transfers;
CREATE TRIGGER tr_raw_material_transfers_updated_at BEFORE UPDATE ON raw_material_transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Raw material transfer line items table
CREATE TABLE IF NOT EXISTS raw_material_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES raw_material_transfers(id) ON DELETE CASCADE,
  material_type_id UUID NOT NULL REFERENCES raw_material_types(id),
  unit TEXT NOT NULL DEFAULT 'meter',
  quantity NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE raw_material_transfer_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_transfer_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON raw_material_transfer_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rm_transfers_business ON raw_material_transfers(business_id);
CREATE INDEX IF NOT EXISTS idx_rm_transfers_from_godown ON raw_material_transfers(from_godown_id);
CREATE INDEX IF NOT EXISTS idx_rm_transfers_to_godown ON raw_material_transfers(to_godown_id);
CREATE INDEX IF NOT EXISTS idx_rm_transfer_items_transfer ON raw_material_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_rm_transfer_items_material ON raw_material_transfer_items(material_type_id);
