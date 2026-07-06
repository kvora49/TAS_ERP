-- Drop existing tables if they exist to allow clean re-runs
DROP TABLE IF EXISTS cheques CASCADE;
DROP TABLE IF EXISTS debit_notes CASCADE;
DROP TABLE IF EXISTS credit_notes CASCADE;
DROP TABLE IF EXISTS sales_returns CASCADE;
DROP TABLE IF EXISTS sale_orders CASCADE;
DROP TABLE IF EXISTS purchase_bills CASCADE;
DROP TABLE IF EXISTS bill_profit CASCADE;
DROP TABLE IF EXISTS sale_bill_charges CASCADE;
DROP TABLE IF EXISTS sale_bill_items CASCADE;
DROP TABLE IF EXISTS sale_bills CASCADE;
DROP TABLE IF EXISTS brand_bill_config CASCADE;
DROP TABLE IF EXISTS bill_templates CASCADE;

-- 1. Bill templates (system + custom)
CREATE TABLE bill_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, -- NULL = system template
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('classic','modern','compact','traditional_tax_invoice','custom')),
  is_system_template BOOLEAN DEFAULT false,
  layout_config JSONB NOT NULL DEFAULT '{}', -- column order, field visibility, positions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 4 system templates
INSERT INTO bill_templates (id, business_id, name, template_type, is_system_template, layout_config) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'Classic Template', 'classic', true, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000002', NULL, 'Modern Template', 'modern', true, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000003', NULL, 'Compact Template', 'compact', true, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000004', NULL, 'Traditional Tax Invoice', 'traditional_tax_invoice', true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for bill_templates
ALTER TABLE bill_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON bill_templates
  FOR ALL USING (business_id IS NULL OR business_id = (SELECT business_id FROM users WHERE id = auth.uid()));


-- 2. Per-brand bill configuration
CREATE TABLE brand_bill_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  pakka_template_id UUID REFERENCES bill_templates(id),
  kacha_template_id UUID REFERENCES bill_templates(id),
  primary_color TEXT DEFAULT '#6366F1',
  header_text TEXT,
  footer_text TEXT,
  signature_name TEXT,
  signature_designation TEXT,
  show_hsn BOOLEAN DEFAULT true,
  show_batch_no BOOLEAN DEFAULT false,
  show_discount_column BOOLEAN DEFAULT true,
  show_transport_details BOOLEAN DEFAULT true,
  bank_account_id UUID REFERENCES bank_accounts(id),
  uploaded_reference_file_url TEXT, -- the PDF/Excel they uploaded for auto-extract
  extracted_config JSONB, -- parsed result from upload
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, brand_id)
);
ALTER TABLE brand_bill_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON brand_bill_config
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS tr_brand_bill_config_updated_at ON brand_bill_config;
CREATE TRIGGER tr_brand_bill_config_updated_at BEFORE UPDATE ON brand_bill_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 3. Sale bills
CREATE TABLE sale_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('pakka','kacha')),
  party_id UUID NOT NULL REFERENCES parties(id),
  brand_ids UUID[] NOT NULL DEFAULT '{}',
  bill_date DATE NOT NULL,
  due_date DATE,
  reference_no TEXT,
  price_list_id UUID, -- text select/ref placeholder
  payment_terms TEXT,
  gst_treatment TEXT DEFAULT 'regular',
  transport_details JSONB,
  salesman TEXT,
  remarks TEXT,
  item_total NUMERIC(15,2) DEFAULT 0,
  charges_total NUMERIC(15,2) DEFAULT 0,
  sub_total NUMERIC(15,2) DEFAULT 0,
  discount_type TEXT, -- 'flat' or 'percentage', NULL if no discount
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  taxable_amount NUMERIC(15,2) DEFAULT 0,
  cgst NUMERIC(15,2) DEFAULT 0,
  sgst NUMERIC(15,2) DEFAULT 0,
  igst NUMERIC(15,2) DEFAULT 0,
  round_off NUMERIC(8,2) DEFAULT 0,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_in_words TEXT,
  generate_eway_bill BOOLEAN DEFAULT false,
  eway_transporter TEXT,
  eway_vehicle_no TEXT,
  eway_place_of_supply TEXT,
  eway_valid_till TIMESTAMPTZ,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','overdue')),
  paid_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, bill_number)
);
ALTER TABLE sale_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON sale_bills
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS tr_sale_bills_updated_at ON sale_bills;
CREATE TRIGGER tr_sale_bills_updated_at BEFORE UPDATE ON sale_bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 4. Sale bill items
CREATE TABLE sale_bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES sale_bills(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES designs(id),
  colour_id UUID REFERENCES design_colours(id),
  size TEXT,
  brand_id UUID REFERENCES brands(id),
  hsn_sac TEXT,
  quantity NUMERIC(10,2) NOT NULL,
  unit TEXT DEFAULT 'Pcs',
  rate NUMERIC(12,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL,
  cost_per_piece NUMERIC(12,2), -- hidden, for profit calc
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sale_bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON sale_bill_items
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));


-- 5. Bill charges
CREATE TABLE sale_bill_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES sale_bills(id) ON DELETE CASCADE,
  charge_name TEXT NOT NULL,
  charge_type TEXT DEFAULT 'flat' CHECK (charge_type IN ('flat','per_qty','percentage')),
  is_taxable BOOLEAN DEFAULT false,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sale_bill_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON sale_bill_charges
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));


-- 6. bill_profit (restricted - owner/admin only)
CREATE TABLE bill_profit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL UNIQUE REFERENCES sale_bills(id) ON DELETE CASCADE,
  cogs NUMERIC(15,2) NOT NULL,
  sale_value NUMERIC(15,2) NOT NULL,
  net_profit NUMERIC(15,2) NOT NULL,
  profit_margin_percent NUMERIC(8,4) NOT NULL,
  deduction_breakdown JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bill_profit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profit_owner_admin_only" ON bill_profit
  FOR ALL USING (
    business_id = (SELECT business_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner','admin')
  );


-- 7. Purchase bills (finished goods purchases)
CREATE TABLE purchase_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES parties(id),
  invoice_no TEXT,
  invoice_date DATE NOT NULL,
  grand_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, bill_number)
);
ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON purchase_bills
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS tr_purchase_bills_updated_at ON purchase_bills;
CREATE TRIGGER tr_purchase_bills_updated_at BEFORE UPDATE ON purchase_bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 8. Draft orders
CREATE TABLE sale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  order_date DATE NOT NULL,
  expected_delivery DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_process','ready','dispatched','cancelled')),
  total_amount NUMERIC(15,2) DEFAULT 0,
  converted_bill_id UUID REFERENCES sale_bills(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, order_number)
);
ALTER TABLE sale_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON sale_orders
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS tr_sale_orders_updated_at ON sale_orders;
CREATE TRIGGER tr_sale_orders_updated_at BEFORE UPDATE ON sale_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- 9. Sales returns
CREATE TABLE sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  original_bill_id UUID REFERENCES sale_bills(id),
  return_date DATE NOT NULL,
  return_reason TEXT,
  grand_total NUMERIC(15,2) DEFAULT 0,
  credit_note_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, return_number)
);
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON sales_returns
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));


-- 10. Credit notes
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cn_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  return_id UUID REFERENCES sales_returns(id),
  cn_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, cn_number)
);
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON credit_notes
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));


-- 11. Debit notes (for sales/purchase corrections)
CREATE TABLE debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  dn_number TEXT NOT NULL,
  party_id UUID NOT NULL REFERENCES parties(id),
  related_purchase_return_id UUID REFERENCES purchase_returns(id),
  dn_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, dn_number)
);
ALTER TABLE debit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON debit_notes
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));


-- 12. Cheques / PDC
CREATE TABLE cheques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cheque_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('received','issued')),
  party_id UUID REFERENCES parties(id),
  bank_name TEXT NOT NULL,
  account_no TEXT,
  cheque_date DATE NOT NULL,
  due_date DATE,
  amount NUMERIC(15,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','deposited','cleared','bounced','cancelled')),
  received_account_id UUID REFERENCES bank_accounts(id),
  deposited_date DATE,
  cleared_date DATE,
  bounce_reason TEXT,
  bounce_charges NUMERIC(10,2) DEFAULT 0,
  cheque_image_url TEXT,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, cheque_number)
);
ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON cheques
  FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS tr_cheques_updated_at ON cheques;
CREATE TRIGGER tr_cheques_updated_at BEFORE UPDATE ON cheques
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 13. finished_stock constraint updates to support sales_bill & sales_return audit logs
ALTER TABLE finished_stock DROP CONSTRAINT IF EXISTS finished_stock_entry_type_check;
ALTER TABLE finished_stock ADD CONSTRAINT finished_stock_entry_type_check 
  CHECK (entry_type IN ('production','manual','adjustment','transfer_in','transfer_out','challan_in','challan_out','sales_bill','sales_return'));
