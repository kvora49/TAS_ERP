-- =========================================================
-- MASTER COMBINED MIGRATION SCRIPT FOR TAS ERP (ALL PHASES)
-- Run this script once in your Supabase SQL Editor Dashboard.
-- =========================================================

-- ---------------------------------------------------------
-- MIGRATION: 20260624000000_settings_phase2.sql
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- MIGRATION: 20260624100000_whatsapp_setup.sql
-- ---------------------------------------------------------

-- Add whatsapp_number to parties table
ALTER TABLE parties ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, code)
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_templates' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON whatsapp_templates
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER tr_whatsapp_templates_updated_at BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create whatsapp_logs table
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  template_code TEXT,
  message_generated TEXT NOT NULL,
  status TEXT DEFAULT 'Opened In WhatsApp',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_logs' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON whatsapp_logs
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Seed mock parties and default templates for existing businesses
DO $$
DECLARE
  b_rec RECORD;
BEGIN
  FOR b_rec IN SELECT id FROM businesses LOOP
    -- Seed mock parties
    IF NOT EXISTS (SELECT 1 FROM parties WHERE business_id = b_rec.id AND name = 'ABC Textiles') THEN
      INSERT INTO parties (business_id, name, type, phone, is_active)
      VALUES (b_rec.id, 'ABC Textiles', ARRAY['customer'], '919876543210', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parties WHERE business_id = b_rec.id AND name = 'XYZ Yarn Suppliers') THEN
      INSERT INTO parties (business_id, name, type, phone, is_active)
      VALUES (b_rec.id, 'XYZ Yarn Suppliers', ARRAY['supplier'], '918765432109', true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM parties WHERE business_id = b_rec.id AND name = 'John Doe (Tailoring)') THEN
      INSERT INTO parties (business_id, name, type, phone, is_active)
      VALUES (b_rec.id, 'John Doe (Tailoring)', ARRAY['employee'], '917654321098', true);
    END IF;

    -- Seed default templates
    -- 1. PAYMENT_REMINDER
    IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE business_id = b_rec.id AND code = 'PAYMENT_REMINDER') THEN
      INSERT INTO whatsapp_templates (business_id, name, code, category, content)
      VALUES (b_rec.id, 'Payment Reminder', 'PAYMENT_REMINDER', 'Payment', 
              'Hello {{party_name}},\n\nThis is a friendly reminder that invoice {{invoice_no}} for the amount of ₹{{amount}} is due on {{due_date}}.\n\nKindly arrange payment at your earliest convenience.\n\nRegards,\n{{company_name}}');
    END IF;

    -- 2. DISPATCH_NOTIFICATION
    IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE business_id = b_rec.id AND code = 'DISPATCH_NOTIFICATION') THEN
      INSERT INTO whatsapp_templates (business_id, name, code, category, content)
      VALUES (b_rec.id, 'Dispatch Notification', 'DISPATCH_NOTIFICATION', 'Logistics', 
              'Hello {{party_name}},\n\nYour order related to {{invoice_no}} has been dispatched. Track details or contact us for any assistance.\n\nRegards,\n{{company_name}}');
    END IF;

    -- 3. PURCHASE_ORDER
    IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE business_id = b_rec.id AND code = 'PURCHASE_ORDER') THEN
      INSERT INTO whatsapp_templates (business_id, name, code, category, content)
      VALUES (b_rec.id, 'Purchase Order', 'PURCHASE_ORDER', 'Procurement', 
              'Hello {{party_name}},\n\nPlease find attached our Purchase Order {{invoice_no}} for the amount of ₹{{amount}}.\n\nKindly confirm receipt and dispatch schedule.\n\nRegards,\n{{company_name}}');
    END IF;

    -- 4. QUOTATION
    IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE business_id = b_rec.id AND code = 'QUOTATION') THEN
      INSERT INTO whatsapp_templates (business_id, name, code, category, content)
      VALUES (b_rec.id, 'Quotation', 'QUOTATION', 'Sales', 
              'Hello {{party_name}},\n\nHere is our quotation {{invoice_no}} for the requested items. Total amount is ₹{{amount}}.\n\nLooking forward to your order.\n\nRegards,\n{{company_name}}');
    END IF;

    -- 5. ORDER_CONFIRMATION
    IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE business_id = b_rec.id AND code = 'ORDER_CONFIRMATION') THEN
      INSERT INTO whatsapp_templates (business_id, name, code, category, content)
      VALUES (b_rec.id, 'Order Confirmation', 'ORDER_CONFIRMATION', 'Sales', 
              'Hello {{party_name}},\n\nWe are pleased to confirm your order {{invoice_no}} for the amount of ₹{{amount}}.\n\nWe will update you once dispatch starts.\n\nRegards,\n{{company_name}}');
    END IF;

    -- 6. STATEMENT_REQUEST
    IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE business_id = b_rec.id AND code = 'STATEMENT_REQUEST') THEN
      INSERT INTO whatsapp_templates (business_id, name, code, category, content)
      VALUES (b_rec.id, 'Statement Request', 'STATEMENT_REQUEST', 'Account', 
              'Hello {{party_name}},\n\nCould you please share the ledger statement for our account up to {{due_date}}? We want to reconcile outstanding balances.\n\nRegards,\n{{company_name}}');
    END IF;

    -- 7. FOLLOW_UP
    IF NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE business_id = b_rec.id AND code = 'FOLLOW_UP') THEN
      INSERT INTO whatsapp_templates (business_id, name, code, category, content)
      VALUES (b_rec.id, 'Follow Up', 'FOLLOW_UP', 'General', 
              'Hello {{party_name}},\n\nJust following up on our previous conversation regarding outstanding invoice {{invoice_no}}.\n\nLet us know if you need any assistance.\n\nRegards,\n{{company_name}}');
    END IF;

  END LOOP;
END
$$;


-- ---------------------------------------------------------
-- MIGRATION: 20260625000000_phase3_raw_materials_parties.sql
-- ---------------------------------------------------------

-- Extend parties table with Phase 3 columns
ALTER TABLE parties ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS pan TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS aadhar TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS msme_number TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS tan TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS billing_address_line2 TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS billing_city TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS billing_state TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS billing_pincode TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS shipping_address_line1 TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS shipping_address_line2 TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS shipping_city TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS shipping_state TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS shipping_pincode TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT '30_days';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2) DEFAULT 0;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS opening_balance_date DATE;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS default_purchase_account TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS default_godown_id UUID REFERENCES godowns(id);
ALTER TABLE parties ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add hsn_code and gst_percent to raw_material_types to support auto-fills in Purchases
ALTER TABLE raw_material_types ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE raw_material_types ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2) DEFAULT 18;

-- Add trigger for parties updated_at if not exists
DROP TRIGGER IF EXISTS tr_parties_updated_at ON parties;
CREATE TRIGGER tr_parties_updated_at BEFORE UPDATE ON parties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Party bank details
CREATE TABLE IF NOT EXISTS party_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  branch TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE party_bank_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'party_bank_details' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON party_bank_details
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Raw material purchases
CREATE TABLE IF NOT EXISTS raw_material_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES parties(id),
  invoice_no TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  delivery_date DATE,
  payment_terms TEXT DEFAULT '30_days',
  due_date DATE,
  reference TEXT,
  transporter TEXT,
  place_of_supply TEXT,
  gst_type TEXT DEFAULT 'with_gst' CHECK (gst_type IN ('with_gst','without_gst','reverse_charge')),
  notes TEXT,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_taxable_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_gst_amount NUMERIC(15,2) DEFAULT 0,
  freight NUMERIC(15,2) DEFAULT 0,
  loading_unloading NUMERIC(15,2) DEFAULT 0,
  other_charges NUMERIC(15,2) DEFAULT 0,
  total_other_charges NUMERIC(15,2) DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_in_words TEXT,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','cancelled')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','draft','cancelled')),
  attachments TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, purchase_number)
);
ALTER TABLE raw_material_purchases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_purchases' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON raw_material_purchases
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_raw_material_purchases_updated_at ON raw_material_purchases;
CREATE TRIGGER tr_raw_material_purchases_updated_at BEFORE UPDATE ON raw_material_purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Purchase line items
CREATE TABLE IF NOT EXISTS raw_material_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES raw_material_purchases(id) ON DELETE CASCADE,
  material_type_id UUID NOT NULL REFERENCES raw_material_types(id),
  hsn_sac TEXT,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  taxable_value NUMERIC(15,2) NOT NULL,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  gst_amount NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE raw_material_purchase_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_purchase_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON raw_material_purchase_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Purchase payments
CREATE TABLE IF NOT EXISTS purchase_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES raw_material_purchases(id),
  supplier_id UUID NOT NULL REFERENCES parties(id),
  payment_date DATE NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('bank_transfer','upi','cash','cheque','neft','rtgs')),
  reference_no TEXT,
  paid_amount NUMERIC(15,2) NOT NULL,
  bank_account_id UUID REFERENCES bank_accounts(id),
  remarks TEXT,
  status TEXT DEFAULT 'success',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_payments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON purchase_payments
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Purchase returns
CREATE TABLE IF NOT EXISTS purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL,
  purchase_id UUID NOT NULL REFERENCES raw_material_purchases(id),
  supplier_id UUID NOT NULL REFERENCES parties(id),
  return_date DATE NOT NULL,
  return_type TEXT CHECK (return_type IN ('material_return','quality_issue','excess_material','other')),
  reason TEXT,
  godown_id UUID REFERENCES godowns(id),
  challan_no TEXT,
  remarks TEXT,
  total_taxable_value NUMERIC(15,2) DEFAULT 0,
  total_discount NUMERIC(15,2) DEFAULT 0,
  taxable_after_discount NUMERIC(15,2) DEFAULT 0,
  cgst NUMERIC(15,2) DEFAULT 0,
  sgst NUMERIC(15,2) DEFAULT 0,
  igst NUMERIC(15,2) DEFAULT 0,
  round_off NUMERIC(8,2) DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_in_words TEXT,
  generate_debit_note BOOLEAN DEFAULT true,
  debit_note_id UUID,
  attachments TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, return_number)
);
ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_returns' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON purchase_returns
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_purchase_returns_updated_at ON purchase_returns;
CREATE TRIGGER tr_purchase_returns_updated_at BEFORE UPDATE ON purchase_returns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Purchase return items
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  purchase_item_id UUID REFERENCES raw_material_purchase_items(id),
  material_type_id UUID NOT NULL REFERENCES raw_material_types(id),
  hsn_sac TEXT,
  unit TEXT NOT NULL,
  invoice_qty NUMERIC(12,2) NOT NULL,
  returned_qty NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  taxable_value NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'purchase_return_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON purchase_return_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Raw material stock entries
CREATE TABLE IF NOT EXISTS raw_material_stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stock_entry_number TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('stock_in','stock_out','adjustment')),
  reference_type TEXT CHECK (reference_type IN ('purchase_invoice','manual','return','transfer')),
  reference_id UUID,
  reference_no TEXT,
  reference_date DATE,
  godown_id UUID NOT NULL REFERENCES godowns(id),
  posting_date DATE NOT NULL,
  remarks TEXT,
  notes TEXT,
  total_items_value NUMERIC(15,2) DEFAULT 0,
  freight NUMERIC(15,2) DEFAULT 0,
  loading_unloading NUMERIC(15,2) DEFAULT 0,
  other_charges NUMERIC(15,2) DEFAULT 0,
  total_additional_charges NUMERIC(15,2) DEFAULT 0,
  grand_total NUMERIC(15,2) DEFAULT 0,
  amount_in_words TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  attachments TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, stock_entry_number)
);
ALTER TABLE raw_material_stock_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_stock_entries' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON raw_material_stock_entries
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_raw_material_stock_entries_updated_at ON raw_material_stock_entries;
CREATE TRIGGER tr_raw_material_stock_entries_updated_at BEFORE UPDATE ON raw_material_stock_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Stock entry items
CREATE TABLE IF NOT EXISTS raw_material_stock_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stock_entry_id UUID NOT NULL REFERENCES raw_material_stock_entries(id) ON DELETE CASCADE,
  material_type_id UUID NOT NULL REFERENCES raw_material_types(id),
  hsn_sac TEXT,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  batch_lot_no TEXT,
  expiry_date DATE,
  amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE raw_material_stock_entry_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_stock_entry_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON raw_material_stock_entry_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Raw material current stock
CREATE TABLE IF NOT EXISTS raw_material_current_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  material_type_id UUID NOT NULL REFERENCES raw_material_types(id),
  godown_id UUID NOT NULL REFERENCES godowns(id),
  opening_stock NUMERIC(12,2) DEFAULT 0,
  inward_qty NUMERIC(12,2) DEFAULT 0,
  outward_qty NUMERIC(12,2) DEFAULT 0,
  current_stock NUMERIC(12,2) DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  stock_value NUMERIC(15,2) DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, material_type_id, godown_id)
);
ALTER TABLE raw_material_current_stock ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'raw_material_current_stock' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON raw_material_current_stock
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Trigger functions to maintain raw_material_current_stock
CREATE OR REPLACE FUNCTION fn_update_current_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_entry_type TEXT;
  v_godown_id UUID;
  v_business_id UUID;
  v_status TEXT;
BEGIN
  -- Get the entry details
  SELECT entry_type, godown_id, business_id, status 
  INTO v_entry_type, v_godown_id, v_business_id, v_status
  FROM raw_material_stock_entries
  WHERE id = COALESCE(NEW.stock_entry_id, OLD.stock_entry_id);

  IF v_status = 'cancelled' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- For INSERT:
  IF TG_OP = 'INSERT' THEN
    INSERT INTO raw_material_current_stock (
      business_id,
      material_type_id,
      godown_id,
      inward_qty,
      outward_qty,
      current_stock,
      unit_cost,
      stock_value,
      last_updated_at
    ) VALUES (
      v_business_id,
      NEW.material_type_id,
      v_godown_id,
      CASE WHEN v_entry_type = 'stock_in' THEN NEW.quantity ELSE 0 END,
      CASE WHEN v_entry_type = 'stock_out' THEN NEW.quantity ELSE 0 END,
      CASE WHEN v_entry_type = 'stock_in' THEN NEW.quantity ELSE -NEW.quantity END,
      NEW.rate,
      CASE WHEN v_entry_type = 'stock_in' THEN NEW.quantity * NEW.rate ELSE -NEW.quantity * NEW.rate END,
      NOW()
    ) ON CONFLICT (business_id, material_type_id, godown_id) DO UPDATE SET
      inward_qty = raw_material_current_stock.inward_qty + CASE WHEN v_entry_type = 'stock_in' THEN EXCLUDED.inward_qty ELSE 0 END,
      outward_qty = raw_material_current_stock.outward_qty + CASE WHEN v_entry_type = 'stock_out' THEN EXCLUDED.outward_qty ELSE 0 END,
      current_stock = raw_material_current_stock.current_stock + EXCLUDED.current_stock,
      unit_cost = CASE WHEN v_entry_type = 'stock_in' AND EXCLUDED.current_stock > 0 THEN EXCLUDED.unit_cost ELSE raw_material_current_stock.unit_cost END,
      stock_value = raw_material_current_stock.stock_value + EXCLUDED.stock_value,
      last_updated_at = NOW();
  
  -- For DELETE:
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE raw_material_current_stock SET
      inward_qty = inward_qty - CASE WHEN v_entry_type = 'stock_in' THEN OLD.quantity ELSE 0 END,
      outward_qty = outward_qty - CASE WHEN v_entry_type = 'stock_out' THEN OLD.quantity ELSE 0 END,
      current_stock = current_stock - CASE WHEN v_entry_type = 'stock_in' THEN OLD.quantity ELSE -OLD.quantity END,
      stock_value = stock_value - CASE WHEN v_entry_type = 'stock_in' THEN OLD.quantity * OLD.rate ELSE -OLD.quantity * OLD.rate END,
      last_updated_at = NOW()
    WHERE business_id = v_business_id AND material_type_id = OLD.material_type_id AND godown_id = v_godown_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_current_stock ON raw_material_stock_entry_items;
CREATE TRIGGER tr_update_current_stock
AFTER INSERT OR DELETE ON raw_material_stock_entry_items
FOR EACH ROW EXECUTE FUNCTION fn_update_current_stock();

-- Trigger function to handle cancellation of stock entries
CREATE OR REPLACE FUNCTION fn_update_current_stock_on_entry_cancel()
RETURNS TRIGGER AS $$
DECLARE
  r_item RECORD;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    FOR r_item IN SELECT * FROM raw_material_stock_entry_items WHERE stock_entry_id = NEW.id LOOP
      UPDATE raw_material_current_stock SET
        inward_qty = inward_qty - CASE WHEN NEW.entry_type = 'stock_in' THEN r_item.quantity ELSE 0 END,
        outward_qty = outward_qty - CASE WHEN NEW.entry_type = 'stock_out' THEN r_item.quantity ELSE 0 END,
        current_stock = current_stock - CASE WHEN NEW.entry_type = 'stock_in' THEN r_item.quantity ELSE -r_item.quantity END,
        stock_value = stock_value - CASE WHEN NEW.entry_type = 'stock_in' THEN r_item.quantity * r_item.rate ELSE -r_item.quantity * r_item.rate END,
        last_updated_at = NOW()
      WHERE business_id = NEW.business_id AND material_type_id = r_item.material_type_id AND godown_id = NEW.godown_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_current_stock_on_entry_cancel ON raw_material_stock_entries;
CREATE TRIGGER tr_update_current_stock_on_entry_cancel
AFTER UPDATE ON raw_material_stock_entries
FOR EACH ROW EXECUTE FUNCTION fn_update_current_stock_on_entry_cancel();


-- ---------------------------------------------------------
-- MIGRATION: 20260627150000_performance_indexes.sql
-- ---------------------------------------------------------

-- Database performance optimization indexes for TAS ERP
-- Execute these in your Supabase SQL Editor to improve query and RLS performance.

-- 1. Indexes on business_id (for RLS performance on tables without composite unique keys starting with business_id)
CREATE INDEX IF NOT EXISTS idx_purchase_items_business_id ON raw_material_purchase_items(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_business_id ON purchase_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_return_items_business_id ON purchase_return_items(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_entry_items_business_id ON raw_material_stock_entry_items(business_id);
CREATE INDEX IF NOT EXISTS idx_party_bank_details_business_id ON party_bank_details(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_business_id ON whatsapp_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_business_id ON backup_history(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_business_id ON audit_log(business_id);

-- 2. Foreign Key Indexes (to prevent sequential scans on joins and filter lookups)
-- Parties & Payments
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON raw_material_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_supplier_id ON purchase_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payments_purchase_id ON purchase_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_returns_supplier_id ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_party_bank_details_party_id ON party_bank_details(party_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_party_id ON whatsapp_logs(party_id);

-- Stock & Entries
CREATE INDEX IF NOT EXISTS idx_stock_entries_godown_id ON raw_material_stock_entries(godown_id);
CREATE INDEX IF NOT EXISTS idx_stock_entry_items_entry_id ON raw_material_stock_entry_items(stock_entry_id);
CREATE INDEX IF NOT EXISTS idx_stock_entry_items_material_type ON raw_material_stock_entry_items(material_type_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_material_type ON raw_material_purchase_items(material_type_id);
CREATE INDEX IF NOT EXISTS idx_current_stock_godown_id ON raw_material_current_stock(godown_id);
CREATE INDEX IF NOT EXISTS idx_current_stock_material_type ON raw_material_current_stock(material_type_id);

-- 3. Ordering / Range Query Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_date ON raw_material_purchases(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_entries_posting_date ON raw_material_stock_entries(posting_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);


-- ---------------------------------------------------------
-- MIGRATION: 20260629000000_phase4_production.sql
-- ---------------------------------------------------------

-- Workers table (full spec — extends Phase 3 skeleton parties)
CREATE TABLE IF NOT EXISTS workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  worker_id TEXT NOT NULL, -- auto: JW-0001, PW-0001
  type TEXT NOT NULL CHECK (type IN ('job_worker','permanent')),
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  gstin TEXT,
  pan TEXT,
  aadhaar TEXT,
  specialization TEXT, -- e.g. "Stitching"
  preferred_stage_id UUID REFERENCES production_stages(id),
  default_rate NUMERIC(10,2) DEFAULT 0,
  max_capacity_per_day INTEGER,
  payment_mode TEXT DEFAULT 'bank_transfer',
  payment_cycle TEXT DEFAULT 'weekly',
  working_since DATE,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  account_holder_name TEXT,
  remarks TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, worker_id)
);
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON workers
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_workers_updated_at ON workers;
CREATE TRIGGER tr_workers_updated_at BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Worker documents
CREATE TABLE IF NOT EXISTS worker_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL, -- aadhaar, pan, bank_passbook, other
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes INTEGER,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE worker_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'worker_documents' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON worker_documents
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Worker attendance
CREATE TABLE IF NOT EXISTS worker_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','half_day','holiday')),
  check_in TIME,
  check_out TIME,
  total_hours INTERVAL,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, worker_id, attendance_date)
);
ALTER TABLE worker_attendance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'worker_attendance' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON worker_attendance
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Production lots
CREATE TABLE IF NOT EXISTS production_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  brand_id UUID NOT NULL REFERENCES brands(id),
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID REFERENCES design_colours(id),
  size_set_id UUID REFERENCES size_sets(id),
  lot_date DATE NOT NULL,
  season TEXT,
  buyer_order_ref TEXT,
  target_start_date DATE,
  target_dispatch_date DATE,
  target_due_date DATE,
  production_type TEXT DEFAULT 'regular',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
  total_quantity INTEGER NOT NULL DEFAULT 0,
  completed_quantity INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','on_hold','cancelled')),
  current_stage_id UUID REFERENCES production_stages(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  allow_rework BOOLEAN DEFAULT false,
  notes TEXT,
  internal_notes TEXT,
  customer_ref TEXT,
  po_date DATE,
  attachments TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, lot_number)
);
ALTER TABLE production_lots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'production_lots' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON production_lots
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_production_lots_updated_at ON production_lots;
CREATE TRIGGER tr_production_lots_updated_at BEFORE UPDATE ON production_lots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lot size quantities
CREATE TABLE IF NOT EXISTS lot_size_quantities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, lot_id, size)
);
ALTER TABLE lot_size_quantities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lot_size_quantities' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON lot_size_quantities
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Lot production stages (per-lot stage assignments)
CREATE TABLE IF NOT EXISTS lot_production_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES production_stages(id),
  stage_name TEXT NOT NULL,
  stage_type TEXT DEFAULT 'in_house',
  sequence_no INTEGER NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, lot_id, sequence_no)
);
ALTER TABLE lot_production_stages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lot_production_stages' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON lot_production_stages
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Stage entries
CREATE TABLE IF NOT EXISTS stage_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  lot_id UUID NOT NULL REFERENCES production_lots(id),
  lot_stage_id UUID NOT NULL REFERENCES lot_production_stages(id),
  entry_date DATE NOT NULL,
  shift TEXT DEFAULT 'day',
  qty_in INTEGER NOT NULL DEFAULT 0,
  qty_out INTEGER NOT NULL DEFAULT 0,
  wastage_qty INTEGER DEFAULT 0,
  wastage_percent NUMERIC(6,4) DEFAULT 0,
  qty_balance INTEGER DEFAULT 0,
  job_work_type TEXT,
  job_work_rate NUMERIC(10,2) DEFAULT 0,
  total_job_work_amount NUMERIC(15,2) DEFAULT 0,
  payment_type TEXT DEFAULT 'piece_rate',
  worker_id UUID REFERENCES workers(id),
  worker_type TEXT,
  no_of_workers INTEGER DEFAULT 1,
  total_labor_cost NUMERIC(15,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  paid_amount NUMERIC(15,2) DEFAULT 0,
  remarks TEXT,
  custom_field_values JSONB DEFAULT '{}',
  attachments TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, entry_number)
);
ALTER TABLE stage_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stage_entries' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stage_entries
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS tr_stage_entries_updated_at ON stage_entries;
CREATE TRIGGER tr_stage_entries_updated_at BEFORE UPDATE ON stage_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Job work payments
CREATE TABLE IF NOT EXISTS job_work_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  worker_id UUID NOT NULL REFERENCES workers(id),
  payment_date DATE NOT NULL,
  payment_mode TEXT NOT NULL,
  reference_no TEXT,
  paid_amount NUMERIC(15,2) NOT NULL,
  bank_name TEXT,
  account_name TEXT,
  remarks TEXT,
  attachments TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'success',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, payment_number)
);
ALTER TABLE job_work_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_work_payments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON job_work_payments
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Job work payment entries link (payment → stage entries)
CREATE TABLE IF NOT EXISTS job_work_payment_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES job_work_payments(id),
  stage_entry_id UUID NOT NULL REFERENCES stage_entries(id),
  amount_applied NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE job_work_payment_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'job_work_payment_entries' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON job_work_payment_entries
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;


-- ---------------------------------------------------------
-- MIGRATION: 20260630000000_phase5_finished_stock.sql
-- ---------------------------------------------------------

-- 1. Finished stock ledger table (keeps chronological stock entry logs)
CREATE TABLE IF NOT EXISTS finished_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size_set_id UUID REFERENCES size_sets(id),
  lot_id UUID REFERENCES production_lots(id),
  godown_id UUID NOT NULL REFERENCES godowns(id),
  entry_type TEXT DEFAULT 'production' CHECK (entry_type IN ('production','manual','adjustment','transfer_in','transfer_out','challan_in','challan_out')),
  size_quantities JSONB NOT NULL DEFAULT '{}', -- {S:200,M:300,L:300,XL:200,XXL:200}
  total_quantity INTEGER NOT NULL DEFAULT 0,
  cost_per_piece NUMERIC(12,2) DEFAULT 0,
  total_value NUMERIC(15,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE finished_stock ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'finished_stock' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON finished_stock
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_finished_stock_updated_at ON finished_stock;
CREATE TRIGGER tr_finished_stock_updated_at BEFORE UPDATE ON finished_stock
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 2. Stock adjustments (individual garment piece correction, damage, scrap, or samples)
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  adjustment_number TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('damage','sample','scrap','correction','other')),
  adjustment_date DATE NOT NULL,
  godown_id UUID NOT NULL REFERENCES godowns(id),
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size TEXT NOT NULL,
  quantity_change INTEGER NOT NULL, -- negative=reduce, positive=add
  unit_cost NUMERIC(12,2) NOT NULL,
  value_impact NUMERIC(15,2) NOT NULL,
  reason TEXT NOT NULL, -- Free TEXT to avoid DB-level check constraints on vocabulary
  remarks TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, adjustment_number)
);
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_adjustments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stock_adjustments
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_stock_adjustments_updated_at ON stock_adjustments;
CREATE TRIGGER tr_stock_adjustments_updated_at BEFORE UPDATE ON stock_adjustments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3. Stock transfers (moves stock between godowns)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  transfer_date DATE NOT NULL,
  from_godown_id UUID NOT NULL REFERENCES godowns(id),
  to_godown_id UUID NOT NULL REFERENCES godowns(id) CHECK (from_godown_id <> to_godown_id),
  reference_no TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('Stock Rebalancing','Sales Order','Godown Consolidation','Other')),
  remarks TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_transit','completed','cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, transfer_number)
);
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_transfers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stock_transfers
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_stock_transfers_updated_at ON stock_transfers;
CREATE TRIGGER tr_stock_transfers_updated_at BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4. Stock transfer items (individual items transferred)
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stock_transfer_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON stock_transfer_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;


-- 5. Challans (Inward and outward stock transit documents to third parties)
CREATE TABLE IF NOT EXISTS challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  challan_number TEXT NOT NULL,
  challan_date DATE NOT NULL,
  challan_type TEXT NOT NULL CHECK (challan_type IN ('inward','outward')),
  from_godown_id UUID NOT NULL REFERENCES godowns(id),
  to_party_id UUID NOT NULL REFERENCES parties(id),
  reference_no TEXT,
  remarks TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_transit','dispatched','received','completed','cancelled')),
  transporter TEXT,
  lr_awb_no TEXT,
  dispatched_by UUID REFERENCES users(id),
  eway_bill_no TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, challan_number)
);
ALTER TABLE challans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challans' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON challans
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS tr_challans_updated_at ON challans;
CREATE TRIGGER tr_challans_updated_at BEFORE UPDATE ON challans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 6. Challan items (individual items added to a challan)
CREATE TABLE IF NOT EXISTS challan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  challan_id UUID NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID NOT NULL REFERENCES design_colours(id),
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE challan_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challan_items' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON challan_items
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;


-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_finished_stock_design_colour ON finished_stock (business_id, design_id, colour_id);
CREATE INDEX IF NOT EXISTS idx_finished_stock_godown ON finished_stock (business_id, godown_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_filter ON stock_adjustments (business_id, adjustment_date);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_filter ON stock_transfers (business_id, transfer_date);
CREATE INDEX IF NOT EXISTS idx_challans_filter ON challans (business_id, challan_date);


-- SQL RPC Function for optimized performance of dashboard stats
CREATE OR REPLACE FUNCTION get_finished_stock_stats(p_business_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_stock BIGINT;
  v_total_designs BIGINT;
  v_total_colours BIGINT;
  v_total_sizes BIGINT;
  v_total_value NUMERIC(15,2);
  v_active_godowns BIGINT;
  v_godown_breakdown JSONB;
  v_size_breakdown JSONB;
  v_top_designs JSONB;
  v_result JSONB;
BEGIN
  -- 1. Base aggregations
  SELECT 
    COALESCE(SUM(total_quantity), 0),
    COALESCE(SUM(total_value), 0)
  INTO v_total_stock, v_total_value
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  -- 2. Counts
  SELECT COUNT(DISTINCT design_id) INTO v_total_designs
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT colour_id) INTO v_total_colours
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT godown_id) INTO v_active_godowns
  FROM finished_stock
  WHERE business_id = p_business_id AND deleted_at IS NULL;

  -- Sizes count
  SELECT COUNT(DISTINCT size_key) INTO v_total_sizes
  FROM finished_stock f,
  LATERAL jsonb_object_keys(f.size_quantities) AS size_key
  WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    AND (f.size_quantities->>size_key)::integer <> 0;

  -- 3. Godown breakdown (donut chart)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_godown_breakdown
  FROM (
    SELECT 
      g.name AS godown_name,
      SUM(f.total_quantity) AS quantity,
      COALESCE(SUM(f.total_value), 0) AS value
    FROM finished_stock f
    JOIN godowns g ON f.godown_id = g.id
    WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    GROUP BY g.name
    ORDER BY quantity DESC
  ) t;

  -- 4. Size breakdown (bar chart)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_size_breakdown
  FROM (
    SELECT 
      size_key AS size,
      SUM((f.size_quantities->>size_key)::integer) AS quantity
    FROM finished_stock f,
    LATERAL jsonb_object_keys(f.size_quantities) AS size_key
    WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    GROUP BY size_key
    ORDER BY 
      CASE size_key
        WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4
        WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 WHEN 'XXXL' THEN 7 ELSE 8
      END
  ) t;

  -- 5. Top 10 designs table
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_designs
  FROM (
    SELECT 
      d.id AS design_id,
      d.code AS design_code,
      d.name AS design_name,
      SUM(f.total_quantity) AS total_quantity,
      COALESCE(SUM(f.total_value), 0) AS total_value,
      (
        SELECT jsonb_agg(DISTINCT c2.colour_hex) 
        FROM finished_stock f2
        JOIN design_colours c2 ON f2.colour_id = c2.id
        WHERE f2.design_id = d.id AND f2.business_id = p_business_id AND f2.deleted_at IS NULL
      ) AS colours,
      (
        SELECT jsonb_agg(DISTINCT size_key) 
        FROM finished_stock f2,
        LATERAL jsonb_object_keys(f2.size_quantities) AS size_key
        WHERE f2.design_id = d.id AND f2.business_id = p_business_id AND f2.deleted_at IS NULL
      ) AS sizes,
      COUNT(DISTINCT f.godown_id) AS godown_count,
      MAX(g.name) AS godown_name
    FROM finished_stock f
    JOIN designs d ON f.design_id = d.id
    JOIN godowns g ON f.godown_id = g.id
    WHERE f.business_id = p_business_id AND f.deleted_at IS NULL
    GROUP BY d.id, d.code, d.name
    ORDER BY total_quantity DESC
    LIMIT 10
  ) t;

  -- 6. Combine results
  v_result := jsonb_build_object(
    'total_stock', v_total_stock,
    'total_designs', v_total_designs,
    'total_colours', v_total_colours,
    'total_sizes', v_total_sizes,
    'total_value', v_total_value,
    'active_godowns', v_active_godowns,
    'godown_breakdown', v_godown_breakdown,
    'size_breakdown', v_size_breakdown,
    'top_designs', v_top_designs
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------
-- POST-MIGRATION GRANTS & SCHEMA REFRESH
-- ---------------------------------------------------------

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
