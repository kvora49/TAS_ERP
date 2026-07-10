-- Migration: 20260711000001_stock_ledger.sql
-- Create stock_ledger table + trigger, and disable old triggers to prevent double-counting.

CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('raw_material', 'finished_good')),
  item_id UUID NOT NULL, -- references raw_material_types(id) or designs(id) / design_colours(id)
  godown_id UUID NOT NULL REFERENCES godowns(id),
  transaction_type TEXT NOT NULL, -- e.g. 'purchase', 'purchase_return', 'production_lot_allocation', 'production_lot_finished_good_push', 'stock_in', 'stock_out', 'adjustment', 'transfer'
  quantity_delta NUMERIC(12, 4) NOT NULL DEFAULT 0,
  value_delta NUMERIC(15, 4) NOT NULL DEFAULT 0,
  reference_table TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- RLS
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_ledger' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stock_ledger
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_ledger_business ON stock_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_item ON stock_ledger(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_godown ON stock_ledger(godown_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_reference ON stock_ledger(reference_table, reference_id);

-- Trigger function to update denormalized raw_material_current_stock
CREATE OR REPLACE FUNCTION fn_update_current_stock_from_ledger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_type = 'raw_material' THEN
    INSERT INTO raw_material_current_stock (
      business_id,
      material_type_id,
      godown_id,
      inward_qty,
      outward_qty,
      current_stock,
      unit_cost,
      stock_value,
      last_updated_at
    ) VALUES (
      NEW.business_id,
      NEW.item_id,
      NEW.godown_id,
      CASE WHEN NEW.quantity_delta > 0 THEN NEW.quantity_delta ELSE 0 END,
      CASE WHEN NEW.quantity_delta < 0 THEN -NEW.quantity_delta ELSE 0 END,
      NEW.quantity_delta,
      CASE WHEN NEW.quantity_delta > 0 AND NEW.value_delta > 0 THEN (NEW.value_delta / NEW.quantity_delta) ELSE 0 END,
      NEW.value_delta,
      NOW()
    ) ON CONFLICT (business_id, material_type_id, godown_id) DO UPDATE SET
      inward_qty = raw_material_current_stock.inward_qty + CASE WHEN EXCLUDED.inward_qty > 0 THEN EXCLUDED.inward_qty ELSE 0 END,
      outward_qty = raw_material_current_stock.outward_qty + CASE WHEN EXCLUDED.outward_qty > 0 THEN EXCLUDED.outward_qty ELSE 0 END,
      current_stock = raw_material_current_stock.current_stock + EXCLUDED.current_stock,
      unit_cost = CASE WHEN EXCLUDED.current_stock > 0 THEN (EXCLUDED.stock_value / EXCLUDED.current_stock) ELSE raw_material_current_stock.unit_cost END,
      stock_value = raw_material_current_stock.stock_value + EXCLUDED.stock_value,
      last_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_stock_ledger_insert ON stock_ledger;
CREATE TRIGGER tr_stock_ledger_insert
AFTER INSERT ON stock_ledger
FOR EACH ROW EXECUTE FUNCTION fn_update_current_stock_from_ledger();

-- Disable old direct stock updating triggers on raw_material_stock_entry_items and raw_material_stock_entries
DROP TRIGGER IF EXISTS tr_update_current_stock ON raw_material_stock_entry_items;
DROP TRIGGER IF EXISTS tr_update_current_stock_on_entry_cancel ON raw_material_stock_entries;
