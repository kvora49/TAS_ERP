-- Phase 5 Workflow Integrity Migration
-- 1. Add idempotency_key to financial tables
ALTER TABLE sale_bills ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
ALTER TABLE raw_material_purchases ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
ALTER TABLE purchase_bills ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;

-- Create index on idempotency keys for fast lookup
CREATE INDEX IF NOT EXISTS idx_sale_bills_idempotency ON sale_bills(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_material_purchases_idempotency ON raw_material_purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_bills_idempotency ON purchase_bills(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Audit trail on financial record edits
CREATE TABLE IF NOT EXISTS financial_record_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at timestamptz NOT NULL DEFAULT now(),
  previous_values jsonb NOT NULL,
  new_values jsonb NOT NULL
);

-- RLS for financial_record_history
ALTER TABLE financial_record_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit history of their business" ON financial_record_history;
CREATE POLICY "Users can view audit history of their business"
  ON financial_record_history
  FOR SELECT
  USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert audit records for their business" ON financial_record_history;
CREATE POLICY "Authenticated users can insert audit records for their business"
  ON financial_record_history
  FOR INSERT
  WITH CHECK (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
  );

