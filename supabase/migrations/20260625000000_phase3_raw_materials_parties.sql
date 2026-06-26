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
