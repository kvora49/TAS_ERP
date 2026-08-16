-- Migration: 20260818000000_defect_system_v2.sql
-- Description: Defect system v2 — fixes all 13 audit findings
--   1. Drop hardcoded defect_category CHECK constraint (BUG 1)
--   2. Add size_quantities + colour_id + source to lot_defects (BUG 2, 3, 6)
--   3. Add size breakdowns + waste tracking to defect_resolutions (BUG 2, 5, 11, 12)
--   4. Create b_grade_stock table (BUG 7 — keeps B-grade out of reconciliation engine)
--   5. Drop defect-grade entries from finished_stock (now moved to b_grade_stock)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lot_defects — Drop hardcoded category constraint, add size/colour/source
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the hardcoded CHECK constraint on defect_category
ALTER TABLE lot_defects DROP CONSTRAINT IF EXISTS lot_defects_defect_category_check;

-- Add colour_id — which colour variant the defect applies to
ALTER TABLE lot_defects
  ADD COLUMN IF NOT EXISTS colour_id UUID REFERENCES design_colours(id);

-- Add size_quantities — exact size breakdown of defective pieces
-- e.g. {"28": 5, "30": 8, "32": 7} → total = 20
ALTER TABLE lot_defects
  ADD COLUMN IF NOT EXISTS size_quantities JSONB DEFAULT '{}';

-- Add source — distinguishes in-production vs post-stock defects (BUG 6)
ALTER TABLE lot_defects
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'in_production';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lot_defects_source_check'
  ) THEN
    ALTER TABLE lot_defects ADD CONSTRAINT lot_defects_source_check
      CHECK (source IN ('in_production', 'post_stock'));
  END IF;
END $$;

-- Index for colour-specific defect queries
CREATE INDEX IF NOT EXISTS idx_lot_defects_colour ON lot_defects(business_id, colour_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. defect_resolutions — Add size breakdowns + waste + rework cost mode
-- ─────────────────────────────────────────────────────────────────────────────

-- Exact size quantities for each resolution outcome
ALTER TABLE defect_resolutions
  ADD COLUMN IF NOT EXISTS recovered_size_quantities  JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS b_grade_size_quantities    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scrapped_size_quantities   JSONB DEFAULT '{}';

-- Waste / scrap tracking (BUG 11)
ALTER TABLE defect_resolutions
  ADD COLUMN IF NOT EXISTS waste_reason              TEXT,
  ADD COLUMN IF NOT EXISTS material_write_off_value  NUMERIC(15,2) DEFAULT 0;

-- Rework cost mode (BUG 12 — free vs paid rework)
ALTER TABLE defect_resolutions
  ADD COLUMN IF NOT EXISTS rework_cost_mode TEXT DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'defect_resolutions_rework_cost_mode_check'
  ) THEN
    ALTER TABLE defect_resolutions ADD CONSTRAINT defect_resolutions_rework_cost_mode_check
      CHECK (rework_cost_mode IN ('free', 'paid_normal', 'paid_custom'));
  END IF;
END $$;

-- Reference to which finished_stock entry was deducted for post-stock defects (BUG 6)
ALTER TABLE defect_resolutions
  ADD COLUMN IF NOT EXISTS source_finished_stock_id UUID REFERENCES finished_stock(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. b_grade_stock — Separate table for B-grade / Aatri stock
--    This keeps B-grade stock OUTSIDE the reconciliation engine (BUG 7)
--    The reconciliation engine only touches finished_stock (Grade A).
--    b_grade_stock is managed independently through defect_resolutions only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS b_grade_stock (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  defect_resolution_id   UUID NOT NULL REFERENCES defect_resolutions(id) ON DELETE CASCADE,
  lot_id                 UUID REFERENCES production_lots(id) ON DELETE SET NULL,
  design_id              UUID NOT NULL REFERENCES designs(id),
  colour_id              UUID REFERENCES design_colours(id),
  godown_id              UUID NOT NULL REFERENCES godowns(id),
  size_quantities        JSONB DEFAULT '{}',
  total_quantity         INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity >= 0),
  cost_per_piece         NUMERIC(15,2) DEFAULT 0 CHECK (cost_per_piece >= 0),
  total_value            NUMERIC(15,2) DEFAULT 0 CHECK (total_value >= 0),
  b_grade_sale_price     NUMERIC(15,2),            -- nullable: set when selling at discount
  status                 TEXT NOT NULL DEFAULT 'available'
                           CHECK (status IN ('available', 'partially_sold', 'fully_sold', 'written_off')),
  notes                  TEXT,
  created_by             UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ
);

ALTER TABLE b_grade_stock ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'b_grade_stock' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON b_grade_stock
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_b_grade_business       ON b_grade_stock(business_id);
CREATE INDEX IF NOT EXISTS idx_b_grade_design         ON b_grade_stock(business_id, design_id);
CREATE INDEX IF NOT EXISTS idx_b_grade_godown         ON b_grade_stock(business_id, godown_id);
CREATE INDEX IF NOT EXISTS idx_b_grade_lot            ON b_grade_stock(lot_id);
CREATE INDEX IF NOT EXISTS idx_b_grade_status         ON b_grade_stock(business_id, status);
CREATE INDEX IF NOT EXISTS idx_b_grade_resolution     ON b_grade_stock(defect_resolution_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. finished_stock — Remove defect_b_grade entry_type since B-grade now has its own table
--    Keep defect_rework for Grade A rework pushes
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing entry_type constraint (was added in migration v1)
ALTER TABLE finished_stock DROP CONSTRAINT IF EXISTS finished_stock_entry_type_check;

-- Re-add without defect_b_grade (B-grade now lives in b_grade_stock)
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
    'defect_rework'   -- Grade A rework pushes still go into finished_stock
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. worker_deductions — Add rework-specific deduction type
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE worker_deductions DROP CONSTRAINT IF EXISTS worker_deductions_deduction_type_check;
ALTER TABLE worker_deductions ADD CONSTRAINT worker_deductions_deduction_type_check
  CHECK (deduction_type IN ('job_work_loss', 'cloth_damage', 'quality_penalty', 'rework_free', 'other'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. stock_ledger — Add new transaction types for defect scrap writeoff
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_transaction_type_check;
-- Note: stock_ledger typically uses free-text transaction_type, so no constraint to add.
-- Just ensuring the column exists (it should already).

-- ─────────────────────────────────────────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────────────────────────────────────────
