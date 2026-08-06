-- Migration: 20260807000001_lot_accessories.sql
-- Description: Add accessory allocation to production lots and stage entry issuance tracking

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. production_lot_accessories
--    Stores the accessory pool allocated to a production lot during lot creation.
--    Mirrors lot_rolls (fabric) but for accessories (item_type='accessory').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_lot_accessories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id             UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  purchase_item_id   UUID NOT NULL REFERENCES raw_material_purchase_items(id),
  item_name          TEXT NOT NULL,           -- denormalized for fast display
  unit               TEXT NOT NULL DEFAULT 'Pcs',
  godown_id          UUID REFERENCES godowns(id),  -- source godown for stock deduction
  allocated_qty      NUMERIC(12,4) NOT NULL CHECK (allocated_qty > 0),
  unit_rate          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  total_issued_qty   NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (total_issued_qty >= 0),
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, lot_id, purchase_item_id)  -- one allocation per item per lot
);

ALTER TABLE production_lot_accessories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'production_lot_accessories' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON production_lot_accessories
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_lot_acc_lot      ON production_lot_accessories(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_acc_business  ON production_lot_accessories(business_id);
CREATE INDEX IF NOT EXISTS idx_lot_acc_item      ON production_lot_accessories(purchase_item_id);
CREATE INDEX IF NOT EXISTS idx_lot_acc_godown    ON production_lot_accessories(godown_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. stage_entry_accessories
--    Records actual accessory issuances to job workers during stage entries.
--    One row per accessory item per stage entry (partial issuance allowed).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_entry_accessories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stage_entry_id    UUID NOT NULL REFERENCES stage_entries(id) ON DELETE CASCADE,
  lot_accessory_id  UUID NOT NULL REFERENCES production_lot_accessories(id),
  lot_id            UUID NOT NULL REFERENCES production_lots(id),  -- denormalized
  worker_id         UUID REFERENCES workers(id),
  item_name         TEXT NOT NULL,    -- denormalized for display
  unit              TEXT NOT NULL DEFAULT 'Pcs',
  godown_id         UUID REFERENCES godowns(id),
  issued_qty        NUMERIC(12,4) NOT NULL CHECK (issued_qty > 0),
  unit_rate         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES users(id)
);

ALTER TABLE stage_entry_accessories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'stage_entry_accessories' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stage_entry_accessories
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_sea_stage_entry  ON stage_entry_accessories(stage_entry_id);
CREATE INDEX IF NOT EXISTS idx_sea_lot_acc      ON stage_entry_accessories(lot_accessory_id);
CREATE INDEX IF NOT EXISTS idx_sea_lot          ON stage_entry_accessories(lot_id);
CREATE INDEX IF NOT EXISTS idx_sea_business     ON stage_entry_accessories(business_id);
CREATE INDEX IF NOT EXISTS idx_sea_worker       ON stage_entry_accessories(worker_id);
