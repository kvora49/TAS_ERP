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
