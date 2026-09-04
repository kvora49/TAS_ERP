-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260904000000_b_grade_sales_billing.sql
-- Description: Adds b_grade_stock_id and is_b_grade to sale_bill_items
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sale_bill_items
  ADD COLUMN IF NOT EXISTS b_grade_stock_id UUID REFERENCES b_grade_stock(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_b_grade BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_sale_bill_items_b_grade ON sale_bill_items(business_id, b_grade_stock_id) WHERE is_b_grade = TRUE;
