-- Migration: 20260729000003_sync_workers_deprecated.sql
-- Populate workers_deprecated table to satisfy stage_entries_worker_id_fkey foreign key constraint in live schema.

-- 1. Sync existing workers into workers_deprecated
INSERT INTO workers_deprecated (id, business_id, name, worker_id, type, phone, address, remarks, is_active, created_at, updated_at)
SELECT 
  w.id,
  w.business_id,
  w.name,
  w.worker_id || '_dep',
  w.type,
  w.phone,
  w.address,
  w.remarks,
  COALESCE(w.is_active, true),
  COALESCE(w.created_at, NOW()),
  COALESCE(w.updated_at, NOW())
FROM workers w
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Sync existing worker parties into workers_deprecated
INSERT INTO workers_deprecated (id, business_id, name, worker_id, type, phone, address, remarks, is_active, created_at, updated_at)
SELECT 
  p.id,
  p.business_id,
  p.name,
  COALESCE(NULLIF(p.code, ''), 'WRK') || '_' || SUBSTRING(p.id::text, 1, 6) || '_dep',
  CASE 
    WHEN 'job_worker' = ANY(p.type) THEN 'job_worker'
    WHEN 'worker' = ANY(p.type) THEN 'permanent'
    ELSE 'job_worker'
  END AS type,
  p.phone,
  p.billing_address_line1 AS address,
  p.remarks,
  COALESCE(p.is_active, true),
  COALESCE(p.created_at, NOW()),
  COALESCE(p.updated_at, NOW())
FROM parties p
WHERE ('worker' = ANY(p.type) OR 'job_worker' = ANY(p.type))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
