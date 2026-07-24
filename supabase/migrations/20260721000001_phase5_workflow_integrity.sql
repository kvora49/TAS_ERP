-- Phase 5 Workflow Integrity Migration
-- 1. Add idempotency_key to financial tables
ALTER TABLE sales_bills ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;
ALTER TABLE party_payments ADD COLUMN IF NOT EXISTS idempotency_key text UNIQUE;

-- Create index on idempotency keys for fast lookup
CREATE INDEX IF NOT EXISTS idx_sales_bills_idempotency ON sales_bills(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_idempotency ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_party_payments_idempotency ON party_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

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

CREATE POLICY "Users can view audit history of their business"
  ON financial_record_history
  FOR SELECT
  USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Authenticated users can insert audit records for their business"
  ON financial_record_history
  FOR INSERT
  WITH CHECK (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
  );
