-- Phase 5 Barcode Security Addendum Schema Migration
-- 1. Ensure qr_uuid exists on finished_stock
ALTER TABLE finished_stock ADD COLUMN IF NOT EXISTS qr_uuid UUID UNIQUE DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_finished_stock_qr_uuid ON finished_stock(qr_uuid);

-- 2. Create or update barcode_scan_history table according to Barcode Security Spec
CREATE TABLE IF NOT EXISTS barcode_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  qr_uuid_scanned UUID NOT NULL,
  finished_stock_id UUID REFERENCES finished_stock(id) ON DELETE SET NULL,
  scan_result TEXT NOT NULL CHECK (scan_result IN ('found','not_found')),
  action_taken TEXT,
  scanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for barcode_scan_history
ALTER TABLE barcode_scan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON barcode_scan_history;
CREATE POLICY "tenant_isolation" ON barcode_scan_history
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
