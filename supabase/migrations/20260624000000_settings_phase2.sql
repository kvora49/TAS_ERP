-- Supabase Database Schema for Settings, Users & Roles, Backup & Audit Logs
-- Run these in your Supabase SQL Editor

-- 1. Helper function for set_updated_at if it does not already exist
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. business_settings
CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  default_credit_days INTEGER DEFAULT 0,
  default_payment_terms TEXT DEFAULT '30_days',
  late_payment_interest BOOLEAN DEFAULT false,
  late_payment_rate NUMERIC(5,2) DEFAULT 0,
  default_gst_type TEXT DEFAULT 'intrastate',
  round_off_method TEXT DEFAULT 'two_decimals',
  default_tds_type TEXT DEFAULT '194C',
  enable_cash_rounding BOOLEAN DEFAULT true,
  default_godown_id UUID REFERENCES godowns(id),
  low_stock_threshold NUMERIC(12,2) DEFAULT 10,
  stock_valuation_method TEXT DEFAULT 'fifo',
  enable_batch_tracking BOOLEAN DEFAULT true,
  enable_serial_numbers BOOLEAN DEFAULT false,
  allow_negative_stock BOOLEAN DEFAULT false,
  enable_barcode_qr BOOLEAN DEFAULT false,
  auto_deduct_on_bill BOOLEAN DEFAULT true,
  job_work_default_bill_type TEXT DEFAULT 'kacha',
  job_work_auto_calculate BOOLEAN DEFAULT true,
  require_worker_assignment BOOLEAN DEFAULT false,
  auto_complete_lot BOOLEAN DEFAULT false,
  lock_completed_lots BOOLEAN DEFAULT true,
  allow_back_date_production BOOLEAN DEFAULT false,
  lot_number_prefix TEXT DEFAULT 'LOT',
  notif_default_time TEXT DEFAULT '09:00',
  notif_email_sender_name TEXT,
  notif_email_reply_to TEXT,
  notif_weekend BOOLEAN DEFAULT true,
  notif_holiday BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON business_settings
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_business_settings_updated_at ON business_settings;
CREATE TRIGGER tr_business_settings_updated_at BEFORE UPDATE ON business_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. notification_rules
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'payment_due','overdue','pdc_reminder','low_stock',
    'cheque_bounce','stage_delay','lot_complete','write_off_alert'
  )),
  is_enabled BOOLEAN DEFAULT true,
  days_before INTEGER DEFAULT 0,
  target_roles TEXT[] DEFAULT '{owner,admin}',
  enable_email BOOLEAN DEFAULT true,
  enable_sms BOOLEAN DEFAULT false,
  enable_in_app BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, type)
);
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notification_rules' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON notification_rules
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER tr_notification_rules_updated_at BEFORE UPDATE ON notification_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_add BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, role, module)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON role_permissions
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER tr_role_permissions_updated_at BEFORE UPDATE ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. backup_history
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('manual','automatic')),
  file_key TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress','completed','failed')),
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'backup_history' AND policyname = 'backup_owner_admin'
  ) THEN
    CREATE POLICY "backup_owner_admin" ON backup_history
      FOR ALL USING (
        business_id = (SELECT business_id FROM users WHERE id = auth.uid())
        AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner','admin')
      );
  END IF;
END
$$;
