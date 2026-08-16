-- Migration: 20260817000000_production_defects.sql
-- Description: Comprehensive defect tracking, rework resolution, worker deductions, and B-grade finished stock management

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend finished_stock & production_lots tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Add stock_grade to finished_stock ('A' = fresh/regular, 'B' = aatri/second)
ALTER TABLE finished_stock 
  ADD COLUMN IF NOT EXISTS stock_grade TEXT DEFAULT 'A';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finished_stock_grade_check'
  ) THEN
    ALTER TABLE finished_stock ADD CONSTRAINT finished_stock_grade_check CHECK (stock_grade IN ('A', 'B'));
  END IF;
END $$;

-- Update finished_stock entry_type check to include defect resolution entry types
ALTER TABLE finished_stock DROP CONSTRAINT IF EXISTS finished_stock_entry_type_check;
ALTER TABLE finished_stock ADD CONSTRAINT finished_stock_entry_type_check
  CHECK (entry_type IN (
    'production',
    'manual',
    'adjustment',
    'purchase',
    'return',
    'sale_return',
    'purchase_deduction',
    'transfer_in',
    'transfer_out',
    'challan_in',
    'challan_out',
    'sales_bill',
    'sales_return',
    'defect_rework',
    'defect_b_grade'
  ));

-- Add defect summary counters to production_lots
ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS defect_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reworked_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS b_grade_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrapped_quantity INTEGER DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. lot_defects table
--    Logs issues/defects detected at any production stage or final inspection
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lot_defects (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id                 UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  defect_number          TEXT NOT NULL,
  defect_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  detected_at_stage_id   UUID REFERENCES lot_production_stages(id),
  defect_category        TEXT NOT NULL CHECK (defect_category IN ('washing_issue', 'embroidery_issue', 'silai_issue', 'aatri', 'fully_damaged', 'fabric_defect', 'other')),
  quantity               INTEGER NOT NULL CHECK (quantity > 0),
  description            TEXT,
  responsible_worker_id  UUID REFERENCES parties(id),
  responsible_stage_id   UUID REFERENCES lot_production_stages(id),
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent_for_rework', 'reworked_fixed', 'rework_failed', 'moved_to_b_grade', 'written_off', 'resolved')),
  created_by             UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ,
  UNIQUE(business_id, defect_number)
);

ALTER TABLE lot_defects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lot_defects' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON lot_defects
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lot_defects_business     ON lot_defects(business_id);
CREATE INDEX IF NOT EXISTS idx_lot_defects_lot          ON lot_defects(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_defects_status       ON lot_defects(business_id, status);
CREATE INDEX IF NOT EXISTS idx_lot_defects_worker       ON lot_defects(responsible_worker_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. defect_resolutions table
--    Records resolution outcome (rework result, grade assignment, godown, deductions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS defect_resolutions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  defect_id              UUID NOT NULL REFERENCES lot_defects(id) ON DELETE CASCADE,
  resolution_type        TEXT NOT NULL CHECK (resolution_type IN ('reworked_to_lot', 'reworked_to_stock_grade_a', 'moved_to_b_grade', 'worker_deduction_and_scrap', 'partial_recovery')),
  resolution_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  qty_recovered          INTEGER DEFAULT 0 CHECK (qty_recovered >= 0),
  qty_b_grade            INTEGER DEFAULT 0 CHECK (qty_b_grade >= 0),
  qty_scrapped           INTEGER DEFAULT 0 CHECK (qty_scrapped >= 0),
  rework_worker_id       UUID REFERENCES parties(id),
  rework_cost            NUMERIC(15,2) DEFAULT 0 CHECK (rework_cost >= 0),
  deduction_amount       NUMERIC(15,2) DEFAULT 0 CHECK (deduction_amount >= 0),
  cloth_cost_recovery    NUMERIC(15,2) DEFAULT 0 CHECK (cloth_cost_recovery >= 0),
  target_godown_id       UUID REFERENCES godowns(id),
  remarks                TEXT,
  created_by             UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE defect_resolutions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'defect_resolutions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON defect_resolutions
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_defect_res_business ON defect_resolutions(business_id);
CREATE INDEX IF NOT EXISTS idx_defect_res_defect   ON defect_resolutions(defect_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. worker_deductions table
--    Direct ledger debit entries applied to workers for damaged pieces/penalties
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_deductions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  deduction_number TEXT NOT NULL,
  worker_id        UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  defect_id        UUID REFERENCES lot_defects(id) ON DELETE SET NULL,
  lot_id           UUID REFERENCES production_lots(id) ON DELETE SET NULL,
  deduction_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  deduction_type   TEXT NOT NULL CHECK (deduction_type IN ('job_work_loss', 'cloth_damage', 'quality_penalty', 'other')),
  amount           NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'reversed')),
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, deduction_number)
);

ALTER TABLE worker_deductions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'worker_deductions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON worker_deductions
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_worker_ded_business ON worker_deductions(business_id);
CREATE INDEX IF NOT EXISTS idx_worker_ded_worker   ON worker_deductions(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_ded_lot      ON worker_deductions(lot_id);
CREATE INDEX IF NOT EXISTS idx_worker_ded_date     ON worker_deductions(business_id, deduction_date);
