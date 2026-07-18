-- Payments (unified — receive & pay, customer & supplier & worker)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('received','paid')),
  party_id UUID NOT NULL REFERENCES parties(id),
  contact_person TEXT,
  payment_date DATE NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash','bank_transfer','upi','cheque','neft','rtgs')),
  reference_no TEXT,
  cheque_utr_ref_date DATE,
  bank_account_id UUID REFERENCES bank_accounts(id),
  amount NUMERIC(15,2) NOT NULL,
  unallocated_amount NUMERIC(15,2) DEFAULT 0, -- becomes advance if > 0
  is_advance BOOLEAN DEFAULT false,
  remarks TEXT,
  attachments TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'completed' CHECK (status IN ('draft','completed','cancelled')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, payment_number)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON payments
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Payment allocations (which bills this payment was applied to)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('sale_bill','purchase_bill','raw_material_purchase','job_work_entry')),
  bill_id UUID NOT NULL, -- polymorphic reference, resolved by bill_type
  allocated_amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_allocations' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON payment_allocations
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Advance payments (tracked separately for advance-specific views)
CREATE TABLE IF NOT EXISTS advance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  party_id UUID NOT NULL REFERENCES parties(id),
  advance_amount NUMERIC(15,2) NOT NULL,
  settled_amount NUMERIC(15,2) DEFAULT 0,
  remaining_amount NUMERIC(15,2) NOT NULL,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'advance_payments' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON advance_payments
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Direct payment links (sold to A, paid worker directly from that receipt)
CREATE TABLE IF NOT EXISTS direct_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_payment_id UUID NOT NULL REFERENCES payments(id), -- the money received
  target_payment_id UUID NOT NULL REFERENCES payments(id), -- the money paid out using it
  linked_amount NUMERIC(15,2) NOT NULL,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_payment_links ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'direct_payment_links' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON direct_payment_links
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Write-offs
CREATE TABLE IF NOT EXISTS write_offs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('sale_bill','purchase_bill','raw_material_purchase')),
  bill_id UUID NOT NULL,
  write_off_type TEXT NOT NULL CHECK (write_off_type IN ('loss','gain','nil')),
  amount NUMERIC(15,2) NOT NULL,
  remarks TEXT NOT NULL,
  written_off_by UUID REFERENCES users(id),
  written_off_at TIMESTAMPTZ DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id),
  reversal_reason TEXT
);

ALTER TABLE write_offs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'write_offs' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON write_offs
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Expenses (extends Phase 1 expense_types)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  expense_number TEXT NOT NULL,
  expense_type_id UUID NOT NULL REFERENCES expense_types(id),
  expense_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  gst_percent NUMERIC(5,2) DEFAULT 0,
  gst_amount NUMERIC(15,2) DEFAULT 0,
  paid_from_account_id UUID REFERENCES bank_accounts(id),
  vendor_name TEXT,
  vendor_invoice_no TEXT,
  notes TEXT,
  attachments TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, expense_number)
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON expenses
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Misc income
CREATE TABLE IF NOT EXISTS misc_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  income_number TEXT NOT NULL,
  income_type TEXT NOT NULL CHECK (income_type IN ('scrap_sale','machinery_rental','commission','other')),
  income_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  received_in_account_id UUID REFERENCES bank_accounts(id),
  party_id UUID REFERENCES parties(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, income_number)
);

ALTER TABLE misc_income ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'misc_income' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON misc_income
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Salary entries
CREATE TABLE IF NOT EXISTS salary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES parties(id), -- permanent workers from Phase 4
  salary_month INTEGER NOT NULL CHECK (salary_month BETWEEN 1 AND 12),
  salary_year INTEGER NOT NULL,
  gross_salary NUMERIC(12,2) NOT NULL,
  advance_deducted NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  deduction_reason TEXT,
  net_salary NUMERIC(12,2) NOT NULL,
  paid_from_account_id UUID REFERENCES bank_accounts(id),
  payment_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processed','paid')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, employee_id, salary_month, salary_year)
);

ALTER TABLE salary_entries ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'salary_entries' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON salary_entries
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Employee advances (separate from job-work worker advances in Phase 4)
CREATE TABLE IF NOT EXISTS employee_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES parties(id),
  advance_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  mode TEXT,
  notes TEXT,
  is_settled BOOLEAN DEFAULT false,
  settled_in_salary_id UUID REFERENCES salary_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employee_advances' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON employee_advances
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- Reminder rules (extends Phase 2 notification_rules with WhatsApp specifics)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('bill_share','payment_reminder','overdue_reminder','pdc_reminder')),
  template_text TEXT NOT NULL, -- supports {{variables}}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, template_type)
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
END $$;

-- RPC Stubs
CREATE OR REPLACE FUNCTION get_balance_sheet(p_business_id UUID, p_as_on_date DATE)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'assets', json_build_object(
      'current', json_build_array(),
      'non_current', json_build_array()
    ),
    'liabilities', json_build_object(
      'current', json_build_array(),
      'non_current', json_build_array()
    ),
    'equity', json_build_array()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_profit_loss(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'income', json_build_array(),
    'cogs', json_build_array(),
    'expenses', json_build_array(),
    'net_profit', 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_gst_summary(p_business_id UUID, p_from DATE, p_to DATE)
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'output_tax', json_build_array(),
    'input_tax', json_build_array(),
    'net_payable', 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
