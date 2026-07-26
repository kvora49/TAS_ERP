-- ====================================================================
-- Migration: 20260729000005_replace_workers_deprecated_with_physical_workers_table.sql
-- Purpose: Convert `workers` view into a clean physical table, repoint all foreign keys,
--          and safely drop `workers_deprecated` table forever.
-- ====================================================================

-- 1. Drop old views and constraints
DROP VIEW IF EXISTS public.workers CASCADE;
ALTER TABLE IF EXISTS stage_entries DROP CONSTRAINT IF EXISTS stage_entries_worker_id_fkey;
ALTER TABLE IF EXISTS job_work_payments DROP CONSTRAINT IF EXISTS job_work_payments_worker_id_fkey;
ALTER TABLE IF EXISTS lot_stage_workers DROP CONSTRAINT IF EXISTS lot_stage_workers_worker_id_fkey;

-- 2. Create proper physical `workers` table
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('job_worker', 'permanent')),
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  gstin TEXT,
  pan TEXT,
  aadhaar TEXT,
  specialization TEXT,
  preferred_stage_id UUID REFERENCES public.production_stages(id),
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
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, worker_id)
);

-- Enable RLS and Tenant Isolation on `workers` table
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workers' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON public.workers
      FOR ALL USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END
$$;

-- 3. Populate physical `workers` table from existing `workers_deprecated` and `parties`
INSERT INTO public.workers (id, business_id, name, worker_id, type, phone, address, remarks, is_active, created_at, updated_at)
SELECT 
  p.id,
  p.business_id,
  p.name,
  COALESCE(NULLIF(p.code, ''), 'WRK') || '_' || SUBSTRING(p.id::text, 1, 6) AS worker_id,
  CASE 
    WHEN 'job_worker' = ANY(p.type) THEN 'job_worker'
    WHEN 'worker' = ANY(p.type) THEN 'permanent'
    ELSE 'job_worker'
  END AS type,
  p.phone,
  p.billing_address_line1 AS address,
  p.remarks,
  COALESCE(p.is_active, true) AS is_active,
  COALESCE(p.created_at, NOW()) AS created_at,
  COALESCE(p.updated_at, NOW()) AS updated_at
FROM public.parties p
WHERE ('worker' = ANY(p.type) OR 'job_worker' = ANY(p.type))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 4. Repoint Foreign Key constraints to physical `workers(id)`
ALTER TABLE public.stage_entries 
  ADD CONSTRAINT stage_entries_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;

ALTER TABLE public.job_work_payments 
  ADD CONSTRAINT job_work_payments_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;

ALTER TABLE public.lot_stage_workers 
  ADD CONSTRAINT lot_stage_workers_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;

-- 5. Drop deprecated table
DROP TABLE IF EXISTS public.workers_deprecated CASCADE;

-- 6. Create Party-to-Worker DB trigger for automatic sync
CREATE OR REPLACE FUNCTION tr_sync_party_to_worker()
RETURNS TRIGGER AS $$
BEGIN
  IF ('worker' = ANY(NEW.type) OR 'job_worker' = ANY(NEW.type)) THEN
    INSERT INTO public.workers (id, business_id, name, worker_id, type, phone, address, remarks, is_active, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.business_id,
      NEW.name,
      COALESCE(NULLIF(NEW.code, ''), 'WRK') || '_' || SUBSTRING(NEW.id::text, 1, 6),
      CASE 
        WHEN 'job_worker' = ANY(NEW.type) THEN 'job_worker'
        WHEN 'worker' = ANY(NEW.type) THEN 'permanent'
        ELSE 'job_worker'
      END,
      NEW.phone,
      NEW.billing_address_line1,
      NEW.remarks,
      COALESCE(NEW.is_active, true),
      COALESCE(NEW.created_at, NOW()),
      COALESCE(NEW.updated_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_party_to_worker ON public.parties;
CREATE TRIGGER tr_sync_party_to_worker
  AFTER INSERT OR UPDATE ON public.parties
  FOR EACH ROW
  EXECUTE FUNCTION tr_sync_party_to_worker();
