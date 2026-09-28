-- Migration: GST E-Invoicing & E-Way Bill Schema Additions
-- File: supabase/migrations/20260927000000_gst_einvoicing_and_eway.sql

-- 1. Extend sale_bills with e-invoicing & e-way bill fields
ALTER TABLE sale_bills
  ADD COLUMN IF NOT EXISTS irn TEXT,
  ADD COLUMN IF NOT EXISTS irn_status TEXT DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS ack_no TEXT,
  ADD COLUMN IF NOT EXISTS ack_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_qr_data TEXT,
  ADD COLUMN IF NOT EXISTS signed_invoice_json JSONB,
  ADD COLUMN IF NOT EXISTS irn_cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS irn_cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ewb_no TEXT,
  ADD COLUMN IF NOT EXISTS ewb_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ewb_valid_till TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_for_edit BOOLEAN DEFAULT false;

-- Add check constraint for irn_status if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sale_bills_irn_status'
  ) THEN
    ALTER TABLE sale_bills
      ADD CONSTRAINT chk_sale_bills_irn_status
      CHECK (irn_status IN ('not_applicable', 'pending', 'registered', 'cancelled', 'failed'));
  END IF;
END $$;

-- Index for quick lookup of IRN and IRN status
CREATE INDEX IF NOT EXISTS idx_sale_bills_irn ON sale_bills(irn) WHERE irn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sale_bills_irn_status ON sale_bills(business_id, irn_status);

-- 2. Extend businesses table with e-invoicing profile & IRP credentials
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS einvoice_applicability TEXT DEFAULT 'not_enabled',
  ADD COLUMN IF NOT EXISTS aato_bracket TEXT DEFAULT 'below_5cr',
  ADD COLUMN IF NOT EXISTS irp_client_id TEXT,
  ADD COLUMN IF NOT EXISTS irp_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS irp_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS irp_token_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS irp_onboarding_status TEXT DEFAULT 'not_started';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_businesses_einvoice_applicability'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT chk_businesses_einvoice_applicability
      CHECK (einvoice_applicability IN ('mandatory', 'voluntary_enabled', 'not_enabled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_businesses_aato_bracket'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT chk_businesses_aato_bracket
      CHECK (aato_bracket IN ('below_5cr', '5cr_to_10cr', '10cr_and_above'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_businesses_irp_onboarding_status'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT chk_businesses_irp_onboarding_status
      CHECK (irp_onboarding_status IN ('not_started', 'otp_pending', 'authorized', 'revoked'));
  END IF;
END $$;

-- 3. Dynamic GST e-invoice thresholds and reference rules config table
CREATE TABLE IF NOT EXISTS gst_einvoice_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed baseline regulatory thresholds (configurable by admin or GSTN updates)
INSERT INTO gst_einvoice_config (key, value, description) VALUES
  ('aato_mandatory_threshold', '{"amount": 50000000, "currency": "INR"}'::jsonb, 'Turnover threshold above which e-invoicing is mandatory (₹5 Cr)'),
  ('aato_30day_window_threshold', '{"amount": 100000000, "currency": "INR"}'::jsonb, 'Turnover threshold above which 30-day reporting window applies (₹10 Cr)'),
  ('reporting_window_days', '{"days": 30}'::jsonb, 'Maximum invoice age allowed for IRP reporting for >= ₹10 Cr businesses'),
  ('eway_threshold', '{"amount": 50000, "currency": "INR"}'::jsonb, 'Consignment value threshold requiring mandatory e-way bill generation (₹50,000)'),
  ('hsn_min_digits_low_aato', '{"digits": 4}'::jsonb, 'Minimum HSN digits required for businesses <= ₹5 Cr turnover'),
  ('hsn_min_digits_high_aato', '{"digits": 6}'::jsonb, 'Minimum HSN digits required for businesses > ₹5 Cr turnover'),
  ('max_invoice_line_items', '{"limit": 1000}'::jsonb, 'Maximum allowed line items per IRP standard INV-01 payload'),
  ('rounding_tolerance', '{"amount": 1.0}'::jsonb, 'Allowed total discrepancy tolerance between taxable + tax and grand total (₹1.00)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. E-Invoice Error Log Table
CREATE TABLE IF NOT EXISTS einvoice_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES sale_bills(id) ON DELETE CASCADE,
  irp_error_code TEXT,
  friendly_message TEXT NOT NULL,
  raw_response TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE einvoice_error_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'einvoice_error_log' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON einvoice_error_log
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_einvoice_error_log_invoice ON einvoice_error_log(invoice_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_einvoice_error_log_business ON einvoice_error_log(business_id, occurred_at DESC);
