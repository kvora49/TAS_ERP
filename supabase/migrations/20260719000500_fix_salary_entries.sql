-- Migration: Fix salary_entries to reference parties instead of workers view
-- and add all required columns from the salary API

-- Drop old table (was referencing workers view which can't have FK constraints)
DROP TABLE IF EXISTS salary_entries CASCADE;

-- Recreate with correct schema referencing parties
CREATE TABLE salary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES parties(id),   -- worker stored in parties
  salary_month INTEGER NOT NULL CHECK (salary_month BETWEEN 1 AND 12),
  salary_year INTEGER NOT NULL,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer'
    CHECK (payment_mode IN ('cash','bank_transfer','upi','cheque','neft','rtgs')),
  payment_date DATE NOT NULL,
  bank_account_id UUID REFERENCES bank_accounts(id),
  reference_no TEXT,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, worker_id, salary_month, salary_year)
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

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_salary_entries_business_id ON salary_entries(business_id);
CREATE INDEX IF NOT EXISTS idx_salary_entries_worker_id ON salary_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_salary_entries_period ON salary_entries(business_id, salary_year, salary_month);

-- Also fix employee_advances to reference parties instead of workers
DROP TABLE IF EXISTS employee_advances CASCADE;

CREATE TABLE employee_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES parties(id),
  advance_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_mode TEXT,
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
