-- Migration: 20260822000000_production_lot_defect_aggregates_and_rework.sql
-- Description: Adds reworked_quantity, b_grade_quantity, scrapped_quantity to production_lots
--              and sent_for_rework to lot_defects, plus backfills from existing resolutions.

-- 1. Add aggregate tracking columns to production_lots
ALTER TABLE production_lots
  ADD COLUMN IF NOT EXISTS reworked_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS b_grade_quantity INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrapped_quantity INTEGER NOT NULL DEFAULT 0;

-- 2. Add sent_for_rework flag to lot_defects
ALTER TABLE lot_defects
  ADD COLUMN IF NOT EXISTS sent_for_rework BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Backfill from existing resolved defect_resolutions
UPDATE production_lots pl
SET
  reworked_quantity = COALESCE((
    SELECT SUM(dr.qty_recovered)
    FROM lot_defects ld
    JOIN defect_resolutions dr ON dr.defect_id = ld.id
    WHERE ld.lot_id = pl.id
      AND ld.deleted_at IS NULL
  ), 0),
  b_grade_quantity = COALESCE((
    SELECT SUM(dr.qty_b_grade)
    FROM lot_defects ld
    JOIN defect_resolutions dr ON dr.defect_id = ld.id
    WHERE ld.lot_id = pl.id
      AND ld.deleted_at IS NULL
  ), 0),
  scrapped_quantity = COALESCE((
    SELECT SUM(dr.qty_scrapped)
    FROM lot_defects ld
    JOIN defect_resolutions dr ON dr.defect_id = ld.id
    WHERE ld.lot_id = pl.id
      AND ld.deleted_at IS NULL
  ), 0);
