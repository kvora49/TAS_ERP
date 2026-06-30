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
